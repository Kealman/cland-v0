// The same bounded receipt is produced on the machine and retained by the hub.
import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, readSync, realpathSync, renameSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { spawn, type ChildProcess } from 'node:child_process';
import { constants } from 'node:os';

import { cpuSample, cpuDelta, withMachineMetrics, appendMachineMetrics, ownPackage, type CpuSample } from './metrics.ts';
export { cpuSample, cpuDelta, type CpuSample } from './metrics.ts';
export type MachineHealth = {
  version: 1;
  temp: { root: string; kind: 'tmpfs' | 'disk'; capBytes: number | null; fallback: string | null };
  storage: { disk: { fsyncMs: number; sqliteMs: number } | null; temp: { fsyncMs: number; sqliteMs: number } | null };
  cpu: (CpuSample & { iowaitPct: number; stealPct: number }) | null;
};
export type ShardMachineHealth = { run: string; shard: string; machine: { name?: string; size?: string; region?: string } | null; health: MachineHealth | null };
export function machineHealthFromLog(log: string): MachineHealth | undefined {
  let health: MachineHealth | undefined;
  for (const line of log.split('\n')) {
    if (!line.startsWith('suite machine health ') || line.length > 8192) continue;
    try {
      const value = JSON.parse(line.slice('suite machine health '.length)) as MachineHealth;
      const number = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
      const probe = (p: MachineHealth['storage']['disk']) => p === null || p && number(p.fsyncMs) && number(p.sqliteMs);
      if (value.version !== 1 || !value.temp || typeof value.temp.root !== 'string' || !['tmpfs', 'disk'].includes(value.temp.kind)
        || !(value.temp.capBytes === null || number(value.temp.capBytes) && value.temp.capBytes <= 4294967296)
        || !(value.temp.fallback === null || ['tmpfs mount unavailable', 'tmpfs setup unavailable'].includes(value.temp.fallback))
        || !value.storage || !probe(value.storage.disk) || !probe(value.storage.temp)
        || !(value.cpu === null || value.cpu && Object.values(value.cpu).every(number) && value.cpu.iowaitPct <= 100 && value.cpu.stealPct <= 100)) continue;
      health = value;
    } catch { /* A partial final line never replaces the last complete receipt. */ }
  }
  return health;
}
export function machineHealthSummary(health?: MachineHealth, shards?: ShardMachineHealth[]): string {
  if (shards) return shards.map(source => `${source.shard} · ${source.run} · ${source.machine?.name ?? 'machine unavailable'}: ${machineHealthSummary(source.health ?? undefined)}`).join('\n');
  if (!health) return 'Machine health: unavailable';
  const disk = health.storage.disk, temp = health.storage.temp;
  return `Machine health: disk fsync ${disk ? disk.fsyncMs + ' ms' : 'unavailable'} · SQLite ${disk ? disk.sqliteMs + ' ms' : 'unavailable'}; temp ${health.temp.root} ${health.temp.kind === 'tmpfs' ? `tmpfs cap ${health.temp.capBytes} bytes` : `disk fallback: ${health.temp.fallback}`} · fsync ${temp ? temp.fsyncMs + ' ms' : 'unavailable'} · SQLite ${temp ? temp.sqliteMs + ' ms' : 'unavailable'}; iowait ${health.cpu ? health.cpu.iowaitPct + '%' : 'unavailable'} · steal ${health.cpu ? health.cpu.stealPct + '%' : 'unavailable'}`;
}
function probe(root: string): MachineHealth['storage']['disk'] {
  let dir: string | undefined;
  try {
    dir = mkdtempSync(join(root, 'health-'));
    const fd = openSync(join(dir, 'sync'), 'w');
    const began = performance.now();
    try { for (let i = 0; i < 4; i++) { writeSync(fd, Buffer.alloc(1024)); fsyncSync(fd); } }
    finally { closeSync(fd); }
    const fsyncMs = Math.round((performance.now() - began) * 100) / 100;
    const sqliteStarted = performance.now();
    const db = new DatabaseSync(join(dir, 'probe.db'));
    try {
      db.exec('pragma journal_mode=wal; pragma synchronous=full; create table probe (n integer)');
      const insert = db.prepare('insert into probe values (?)');
      for (let i = 0; i < 8; i++) insert.run(i);
    } finally { db.close(); }
    return { fsyncMs, sqliteMs: Math.round((performance.now() - sqliteStarted) * 100) / 100 };
  } catch { return null; }
  finally { if (dir) rmSync(dir, { recursive: true, force: true }); }
}
function readCpu(): CpuSample | null {
  try { return cpuSample(readFileSync('/proc/stat', 'utf8')); } catch { return null; }
}
async function receipt(action: string, dir: string) {
  if (action === 'append') {
    const fd = openSync(join(dir, 'metrics.log'), 'r'), chunk = Buffer.alloc(16384);
    try { appendMachineMetrics(() => { const n = readSync(fd, chunk); return n ? chunk.toString('utf8', 0, n) : null; }, text => { writeSync(1, text); }); }
    finally { closeSync(fd); }
    return;
  }
  if (action === 'supervise') {
    let fd: number | undefined;
    try { fd = openSync(join(dir, 'metrics.log'), 'a'); } catch { /* advisory sink unavailable */ }
    try {
      let child: ChildProcess | undefined;
      let interrupted: (signal: string) => void = () => {};
      const result = await withMachineMetrics({ now: Date.now,
        every: (ms, callback) => { const timer = setInterval(callback, ms); return () => clearInterval(timer); },
        read: () => ({ stat: readFileSync('/proc/stat', 'utf8'), loadavg: readFileSync('/proc/loadavg', 'utf8') }),
        write: line => { if (fd !== undefined) writeSync(fd, line); },
      }, () => ownPackage({
        observe: listener => {
          interrupted = listener;
          const term = () => listener('SIGTERM'), int = () => listener('SIGINT');
          process.on('SIGTERM', term); process.on('SIGINT', int);
          return () => { process.off('SIGTERM', term); process.off('SIGINT', int); };
        },
        after: (ms, callback) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); },
        handoff: () => { child?.unref(); },
        launch: () => new Promise<number>(resolve => {
          child = spawn('bash', [], { stdio: 'inherit' });
          let launchFailed = false;
          child.once('error', () => { launchFailed = true; });
          child.once('close', (code, signal) => {
            if (signal) interrupted(signal);
            resolve(launchFailed ? 127 : code ?? (signal ? 128 + constants.signals[signal] : 1));
          });
        }),
      }));
      if (result.state === 'closed') {
        writeFileSync(join(dir, 'package-closed.tmp'), 'closed\n');
        renameSync(join(dir, 'package-closed.tmp'), join(dir, 'package-closed'));
        process.exitCode = result.code;
      } else process.exitCode = result.signal === 'SIGINT' ? 130 : result.signal ? 143 : 1;
    } finally {
      try { if (fd !== undefined) closeSync(fd); } catch { /* never replace the package outcome */ }
    }
    return;
  }
  const path = join(dir, 'health.json');
  const save = (health: MachineHealth) => {
    writeFileSync(path + '.tmp', JSON.stringify(health)); renameSync(path + '.tmp', path);
    process.stdout.write(`suite machine health ${JSON.stringify(health)}\n`);
  };
  if (action === 'start') {
    let temp: MachineHealth['temp'] = { root: process.env.TMPDIR ?? '/tmp', kind: 'disk', capBytes: null, fallback: 'tmpfs setup unavailable' };
    try { temp = JSON.parse(readFileSync(join(dir, 'temp.json'), 'utf8')); } catch { /* The unprivileged worker retains a clear fallback if root setup failed. */ }
    const health: MachineHealth = { version: 1, temp, storage: { disk: null, temp: null }, cpu: null };
    // Persist before probing: the external ten-second bound can kill a slow probe.
    save(health);
    health.storage.disk = probe(dir); health.storage.temp = probe(temp.root);
    save(health);
    writeFileSync(join(dir, 'cpu-start.json'), JSON.stringify(readCpu()));
  } else if (action === 'finish') {
    const health = JSON.parse(readFileSync(path, 'utf8')) as MachineHealth;
    let before: CpuSample | null = null;
    try { before = JSON.parse(readFileSync(join(dir, 'cpu-start.json'), 'utf8')); } catch { /* A probe timed out before its baseline. */ }
    health.cpu = cpuDelta(before, readCpu()); save(health);
  }
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await receipt(process.argv[2]!, process.argv[3]!);
