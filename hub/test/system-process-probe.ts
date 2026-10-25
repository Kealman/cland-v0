// Shared isolated native-process boundary; all OS processes and signals inside the child are synthetic.
import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory } from './process-cleanup.ts';

const entry = fileURLToPath(new URL('../src/system-processes.ts', import.meta.url));
export async function systemProcessProbe(body: string, platform: 'darwin' | 'linux' = 'darwin') {
  const source = `
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import nativeFiles from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { syncBuiltinESMExports } from 'node:module';
Object.defineProperty(process, 'platform', { value: ${JSON.stringify(platform)} });
const boot = '11111111-2222-3333-4444-555555555555';
const nativeBirth = r => r && process.platform === 'linux' ? 'linux:' + boot + ':' + (r.ticks ?? 90001) : r ? 'darwin:' + Math.floor(Date.parse(r.started + ' UTC') / 1000) + ':' + (r.micros ?? 200001) : null;
const start = 'Mon Oct 5 12:00:00 2026';
const row = (pid, parent, group, started = start) => ({ pid, parent, group, started, state: 'S', command: 'node fixture' });
let onNative = async () => {}, nativeFailure = false, nativePid = pid => pid;
let rows = [], onProbe = () => {}, onSignal = () => {}, onTable = () => {}, onChildren = () => {}, cwdOf = () => '', tableOutput;
const signals = []; const listings = []; const liveness = [];
let onStat = async () => {};
if (process.platform === 'linux') {
 const read = nativeFiles.readFile;
 nativeFiles.readFile = async (path, ...args) => {
  if (path === '/proc/sys/kernel/random/boot_id') return boot;
  const match = /^\\/proc\\/(\\d+)\\/stat$/.exec(String(path));
  if (!match) return read(path, ...args);
  const pid = Number(match[1]), error = await onStat(pid);
  if (error) throw Object.assign(new Error('stat unavailable'), { code: error });
  const r = pid === process.pid ? row(pid, 1, pid) : rows.find(r => r.pid === pid);
  if (!r) throw Object.assign(new Error('gone'), { code: 'ENOENT' });
  return r.pid + ' (fixture with ) name) ' + (r.nativeState ?? r.state) + ' ' + r.parent + ' ' + r.group + ' ' + Array(16).fill('0').join(' ') + ' ' + (r.ticks ?? 90001) + ' 0';
 };
}
const bounded = async (promise, ms, label) => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' timed out')), ms); })]); } finally { clearTimeout(timer); } };
cp.spawn = (bin, args) => {
  assert.ok(bin === 'ps' || bin === 'lsof' || bin === 'pgrep' || bin === '/usr/bin/perl');
  if (bin === '/usr/bin/perl' && nativeFailure === 'missing') throw Object.assign(new Error('missing perl'), { code: 'ENOENT' });
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  queueMicrotask(async () => {
    let output;
    if (bin === '/usr/bin/perl') {
      if (nativeFailure) { child.stdout.end(); child.stderr.end('native interpreter failed'); child.emit('close', 2); return; }
      await onNative();
      const selected = args.slice(args.indexOf('--') + 1).map(Number);
      const records = [];
      for (const pid of selected) {
        if (selected.length === 1 && pid !== process.pid && await onProbe(pid) === false) continue;
        const r = pid === process.pid ? row(process.pid, 1, process.pid) : rows.find(p => p.pid === pid);
        if (!r || r.micros === null) continue;
        const bytes = Buffer.alloc(648);
        bytes.writeBigInt64LE(BigInt(Math.floor(Date.parse(r.started + ' UTC') / 1000)), 0);
        bytes.writeInt32LE(r.micros ?? 200001, 8); bytes.writeInt32LE(nativePid(pid), 40);
        bytes.writeUInt8(r.nativeState === 'Z' ? 5 : 2, 36);
        records.push(bytes);
      }
      output = Buffer.concat(records);
    } else if (bin === 'pgrep') {
      await onChildren();
      const parents = args[args.indexOf('-P') + 1].split(',').map(Number);
      output = rows.filter(p => parents.includes(p.parent)).map(p => p.pid).join('\\n');
    } else if (bin === 'lsof') {
      output = 'fcwd\\nn' + cwdOf(Number(args[args.indexOf('-p') + 1]));
    } else if (args.includes('pid=,ppid=,pgid=,lstart=,stat=,command=')) {
      const selection = args.includes('-p') ? ['-p', args[args.indexOf('-p') + 1]] : ['-e'];
      assert.deepEqual(args, ['-ww', ...selection, '-o', 'pid=,ppid=,pgid=,lstart=,stat=,command=']);
      listings.push([...args]);
      if (await onTable() === false) { child.stdout.end(); child.stderr.end(); child.emit('close', 1); return; }
      const selected = args.includes('-p') ? args[args.indexOf('-p') + 1].split(',').map(Number) : null;
      output = tableOutput ?? [row(process.pid, 1, process.pid), ...rows].filter(p => !selected || selected.includes(p.pid)).map(p =>
        p.pid + ' ' + p.parent + ' ' + p.group + ' ' + p.started + ' ' + p.state + ' ' + p.command).join('\\n');
    } else {
      const identities = [];
      for (const pid of args[args.indexOf('-p') + 1].split(',').map(Number)) {
        const verified = undefined;
        const started = verified === false ? undefined : pid === process.pid ? start : rows.find(p => p.pid === pid)?.started;
        if (started) identities.push(args.includes('pid=,lstart=') ? pid + ' ' + started : started);
      }
      output = identities.join('\\n');
    }
    child.stdout.end(output); child.stderr.end(); child.emit('close', 0);
  });
  return child;
};
syncBuiltinESMExports();
process.kill = (pid, signal) => {
  if (signal === 0) {
    liveness.push(pid);
    if (pid === process.pid || rows.some(p => p.pid === pid)) return true;
    throw Object.assign(new Error('no process'), { code: 'ESRCH' });
  }
  signals.push({ pid, signal });
  if (onSignal(pid, signal) === false) return true;
  if (signal === 'SIGSTOP' || signal === 'SIGCONT') {
    const target = rows.find(p => p.pid === pid);
    if (target) target.state = signal === 'SIGSTOP' ? 'T' : 'S';
    return true;
  }
  const killed = new Set(rows.filter(p => pid < 0 ? p.group === -pid : p.pid === pid).map(p => p.pid));
  rows = rows.filter(p => !killed.has(p.pid)).map(p => ({ ...p, parent: killed.has(p.parent) ? 1 : p.parent }));
  return true;
};
const { endProcess: nativeEndProcess, systemProcesses } = await import(${JSON.stringify(entry)});
const endProcess = (p, ...args) => nativeEndProcess({ ...p, pidIdentity: Object.hasOwn(p, 'pidIdentity') ? p.pidIdentity : nativeBirth(rows.find(r => r.pid === p.pid)) }, ...args);
${body}
`;
  const root = await mkdtemp(join(tmpdir(), 'cland-process-identity-'));
  const cleanup = ownDirectory(undefined, root);
  try {
    await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], { timeout: 10_000, cwd: root, env: fixtureEnvironment(root, process.env) });
  } catch (error) {
    throw new Error((error as { stderr?: string }).stderr?.slice(-5000) || String(error));
  } finally { await cleanup(); }
}

