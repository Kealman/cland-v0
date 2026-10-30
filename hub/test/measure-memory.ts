/** Manual, report-only Mac memory probe. See --help. Never a suite benchmark. */
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, lstat, copyFile, appendFile, writeFile, open, readFile } from 'node:fs/promises';
import fs from 'node:fs';
import { Session } from 'node:inspector';
import { Tracker } from '../src/tracker/tracker.ts';
import { HubCore } from '../src/hub/core.ts';
import { readStartupJournal } from '../src/hub/journal.ts';
import { Store } from '../src/hub/store.ts';
import { syncBuiltinESMExports } from 'node:module';
import { join, resolve } from 'node:path';
import { tmpdir, loadavg } from 'node:os';
import { execFileSync } from 'node:child_process';
import { DatabaseSync, backup } from 'node:sqlite';
import { getHeapStatistics } from 'node:v8';
import { fixtureEnvironment } from './fixture-environment.ts';
import { projectHub } from './harness.ts';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { realClock } from '../src/hub/clock.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { memoryProducer } from './memory-producer.ts';
export { requestMemoryStop } from './memory-producer.ts';

export function swapPercent(text: string): number {
  const match = /total = ([\d.]+)([MG])\s+used = ([\d.]+)([MG])/.exec(text);
  if (!match) throw new Error('unusable vm.swapusage receipt');
  const total = Number(match[1]) * (match[2] === 'G' ? 1024 : 1);
  const used = Number(match[3]) * (match[4] === 'G' ? 1024 : 1);
  return total === 0 ? 0 : 100 * used / total;
}

/** No symlinks, credentials, config, sockets, worktrees or external paths. */
export async function copyTree(source: string, target: string, sparse = false, dry = false): Promise<{ files: number; bytes: number }> {
  const info = await lstat(source);
  if (info.isSymbolicLink()) return { files: 0, bytes: 0 };
  if (info.isDirectory()) {
    if (!dry) await mkdir(target, { recursive: true, mode: 0o700 });
    const total = { files: 0, bytes: 0 };
    for (const name of await readdir(source)) {
      if (/secret|credential|cookie|token|\.env/i.test(name)) continue;
      const part = await copyTree(join(source, name), join(target, name), sparse, dry);
      total.files += part.files; total.bytes += part.bytes;
    }
    return total;
  }
  if (!info.isFile()) return { files: 0, bytes: 0 };
  if (!dry) {
    if (sparse) { const file = await open(target, 'wx', 0o600); try { await file.truncate(info.size); } finally { await file.close(); } }
    else await copyFile(source, target);
  }
  return { files: 1, bytes: info.size };
}

async function prepareCopy(source: string, root: string): Promise<void> {
  const state = join(root, '.cland');
  await mkdir(state, { mode: 0o700 });
    const copied: Record<string, unknown> = {};
    for (const name of ['tasks', 'artifacts', 'journal.jsonl', 'log']) {
      try { copied[name] = await copyTree(join(resolve(source), '.cland', name), join(state, name), name === 'artifacts'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; copied[name] = 'absent'; }
    }
    const db = new DatabaseSync(join(resolve(source), '.cland/hub.db'), { readOnly: true });
    try { await backup(db, join(state, 'hub.db'), { rate: 256 }); } finally { db.close(); }
    await writeFile(join(root, 'manifest.json'), JSON.stringify({ copied, scriptSha256: createHash('sha256').update(await readFile(import.meta.filename)).digest('hex'), platform: process.platform, arch: process.arch, node: process.version,  exclusions: 'artifact body bytes (same-size sparse placeholders); live config/crew/roles/secrets/accounts/territory/worktrees; fake adapters, account and Git probes; no connected clients; snapshot GC pauses; no browser', source: resolve(source) }, null, 2));
}

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`Usage: node --max-old-space-size=8192 hub/test/measure-memory.ts --source PROJECT --run\nMac only; requires a Coordinator measurement slot. Copies tasks, sparse artifact placeholders (no bodies), journal and log plus a consistent SQLite backup to a private disposable root. Never reads secrets.toml or account config. Generated config disables remotes and verification. Fake adapters/probes exclude live harnesses, accounts, Git and external network. Startup only: one-second process samples, replay-stage checkpoints/counts and 1 MiB sampling heap profiles; stops at readiness. No full snapshots or rest phase. Preflight: load1 <=8, swap <=80%; every 30s request graceful stop over IPC above 90% swap, own and join setup/profile/sample writes, await hub stop and persist outcome before native exit/pipe closure. A bounded captured-process fallback records incomplete drainage. Approximately 1-2 minutes including copy. Private raw profiles remain in the printed scratch root; publish aggregate allocation sites only. Use --plan --source PROJECT for a dry inventory. No automatic budget enforcement.`);
} else if (args.includes('--plan')) {
  const source = resolve(args[args.indexOf('--source') + 1]!);
  const root = await mkdtemp(join(tmpdir(), 'cland-memory-plan-'));
  const env = fixtureEnvironment(root, process.env);
  const entries: Record<string, unknown> = {};
  for (const name of ['tasks', 'artifacts', 'journal.jsonl', 'log']) entries[name] = await copyTree(join(source, '.cland', name), join(root, name), name === 'artifacts', true);
  const db = await lstat(join(source, '.cland/hub.db'));
  console.log(JSON.stringify({ entries, databaseBytes: db.size, artifacts: 'same-size sparse placeholders; content bytes excluded; complete DB index retained', exclusions: 'secrets.toml, secret-shaped names, symlinks; no account/config directories', load1: loadavg()[0], swapPercent: swapPercent(execFileSync('/usr/sbin/sysctl', ['vm.swapusage'], { env, encoding: 'utf8', timeout: 2000 })) }, null, 2));
} else if (args.includes('--run') && !args.includes('--worker')) {
  test('manual memory supervisor', { timeout: 5 * 60_000 }, async t => {
  if (process.platform !== 'darwin') throw new Error('Mac measurement only');
  const root = await mkdtemp(join(tmpdir(), 'cland-memory-'));
  const env = fixtureEnvironment(root, process.env);
  const system = () => ({ load1: loadavg()[0]!, swapPercent: swapPercent(execFileSync('/usr/sbin/sysctl', ['vm.swapusage'], { env, encoding: 'utf8', timeout: 2000 })) });
  const before = system();
  if (before.load1 > 8 || before.swapPercent > 80) throw new Error(`preflight refused: ${JSON.stringify(before)}`);
  console.log(`PRIVATE_ROOT=${root}`);
  const source = args[args.indexOf('--source') + 1];
  if (!args.includes('--source') || !source) throw new Error('--source PROJECT required');
  await prepareCopy(source, root);
  const ready = system();
  if (ready.load1 > 8 || ready.swapPercent > 80) throw new Error(`post-copy preflight refused: ${JSON.stringify(ready)}; root=${root}`);
  const producer = memoryProducer(t, root, ['--max-old-space-size=8192', '--heap-prof', '--heap-prof-interval=1048576', `--heap-prof-dir=${root}`, '--heap-prof-name=startup.heapprofile', import.meta.filename, ...args, '--worker', '--root', root]);
  const writes = new Set<Promise<unknown>>();
  const ownWrite = <T>(work: Promise<T>) => { writes.add(work); void work.catch(() => {}); void work.finally(() => writes.delete(work)).catch(() => {}); producer.own(work); };
  let timer: ReturnType<typeof setInterval> | undefined;
  let rssTimer: ReturnType<typeof setInterval> | undefined;
  producer.close(async () => { clearInterval(timer); clearInterval(rssTimer); await Promise.allSettled([...writes]); });
  const child = producer.start();
  const interrupt = () => { void producer.dispose().catch(() => {}); };
  process.on('disconnect', interrupt);
  t.signal.addEventListener('abort', interrupt, { once: true });
  try {
    timer = setInterval(() => {
      try {
        const reading = system();
        ownWrite(appendFile(join(root, 'supervisor.jsonl'), JSON.stringify({ time: Date.now(), ...reading }) + '\n'));
        if (reading.swapPercent > 90) interrupt();
      } catch { interrupt(); }
    }, 30_000);
    rssTimer = setInterval(() => {
      if (!child.pid) return;
      try {
        const rssKiB = Number(execFileSync('/bin/ps', ['-o', 'rss=', '-p', String(child.pid)], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 2000 }).trim());
        ownWrite(appendFile(join(root, 'rss.jsonl'), JSON.stringify({ time: Date.now(), rssBytes: rssKiB * 1024 }) + '\n'));
      } catch { /* Missing native reading remains missing. */ }
    }, 1000);
    const receipt = await producer.join();
    if (receipt.code !== 0) throw new Error(`incomplete producer: exit=${receipt.code} signal=${receipt.signal}; ${producer.tail()}`);
  } finally {
    await producer.dispose();
    process.off('disconnect', interrupt);
    t.signal.removeEventListener('abort', interrupt);
  }
  });
} else if (args.includes('--run') && args.includes('--worker')) {
  const sourceArg = args[args.indexOf('--source') + 1];
  if (!args.includes('--source') || !sourceArg) throw new Error('--source PROJECT required');
  test('manual sealed startup memory measurement', { timeout: 5 * 60_000 }, async t => {
    const controlMode = args.includes('--control');
    if (!controlMode && process.platform !== 'darwin') throw new Error('Mac measurement only');
    const root = args[args.indexOf('--root') + 1]!;
    await mkdir(join(root, 'home'), { mode: 0o700 });
    const env = fixtureEnvironment(root, process.env);
    const system = () => ({ load1: loadavg()[0]!, swapPercent: swapPercent(execFileSync('/usr/sbin/sysctl', ['vm.swapusage'], { env, encoding: 'utf8', timeout: 2000 })) });
    const before = controlMode ? { load1: 0, swapPercent: 0 } : system();
    if (before.load1 > 8 || before.swapPercent > 80) throw new Error(`preflight refused: ${JSON.stringify(before)}; root=${root}`);
    console.log(`PRIVATE_ROOT=${root}`);
    let stopping = false;
    const lifetime = pacingOwner(t, { setupTimeoutMs: 120_000 });
    beforeDirectories(t, lifetime.dispose);
    const stopped = Promise.withResolvers<void>();
    const terminate = () => { stopping = true; stopped.resolve(); void lifetime.dispose().catch(() => {}); };
    const control = (message: unknown) => { if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'memory-stop') terminate(); };
    process.on('message', control);
    process.on('disconnect', terminate);
    process.send?.({ type: 'memory-started' });
    t.signal.addEventListener('abort', terminate, { once: true });
    t.after(() => { process.off('message', control); process.off('disconnect', terminate); t.signal.removeEventListener('abort', terminate); });
    const state = join(root, '.cland');
    const start = performance.now();
    let phase = 'startup';
    const inspector = new Session();
    inspector.connect();
    t.after(() => inspector.disconnect());
    let serial = 0;
    const replayCounts = { agentsNotices: 0, otherNotices: 0 };
    const checkpoint = (boundary: string, counts: Record<string, number> = {}) => {
      const ordinal = serial++;
      fs.appendFileSync(join(root, 'boundaries.jsonl'), JSON.stringify({ ordinal, ms: performance.now() - start, boundary, ...replayCounts, ...counts, ...process.memoryUsage(), v8: getHeapStatistics() }) + '\n');
      if (controlMode) return;
      const captured = Promise.withResolvers<void>();
      ownWrite(captured.promise);
      try {
        inspector.post('HeapProfiler.getSamplingProfile', (error, result) => {
          try {
            if (error) fs.appendFileSync(join(root, 'profile-errors.jsonl'), JSON.stringify({ ordinal, unavailable: error.message }) + '\n');
            else fs.writeFileSync(join(root, `stage-${ordinal}.heapprofile`), JSON.stringify(result.profile));
            captured.resolve();
          } catch (failure) { captured.reject(failure); }
        });
      } catch (failure) { captured.reject(failure); }
    };
    // Probe only: production Store and wire contracts stay unchanged. Record
    // first-call startup boundaries and counts without exporting row contents.
    for (const method of ['artifacts', 'topics', 'allSubscriptions', 'inboxMessages', 'inboxWaits', 'pendingApprovals', 'suiteJobHistory', 'meta'] as const) {
      const original = Store.prototype[method] as (...values: unknown[]) => unknown;
      const seen = new Set<string>();
      t.mock.method(Store.prototype, method, function(this: Store, ...values: unknown[]) {
        const label = method === 'meta' ? (values[0] === 'suite-jobs' ? 'meta-suite-jobs' : '') : method;
        if (!label || seen.has(label)) return original.apply(this, values);
        seen.add(label);
        checkpoint(`before-${label}`);
        const result = original.apply(this, values);
        const counts: Record<string, number> = Array.isArray(result) ? { records: result.length } : {};
        if (typeof result === 'string') counts.bytes = Buffer.byteLength(result);
        else if (Array.isArray(result) && result.every(value => typeof value === 'string')) counts.bytes = result.reduce((total, value) => total + Buffer.byteLength(value), 0);
        checkpoint(`after-${label}`, counts);
        return result;
      });
    }
    const originalStart = Tracker.prototype.start;
    t.mock.method(Tracker.prototype, 'start', async function(this: Tracker, options: Parameters<typeof originalStart>[0]) {
      checkpoint('before-tracker');
      await originalStart.call(this, options);
      checkpoint('after-tracker', { records: this.list().length });
    });
    for (const method of ['noticeTo', 'noticeInTopic'] as const) {
      const original = HubCore.prototype[method] as (...values: unknown[]) => unknown;
      t.mock.method(HubCore.prototype, method, function(this: HubCore, ...values: unknown[]) {
        if (values[0] === 'agents') replayCounts.agentsNotices++; else replayCounts.otherNotices++;
        return original.apply(this, values);
      });
    }
    const originalRead = fs.readFileSync;
    t.mock.method(fs, 'readFileSync', (...values: Parameters<typeof fs.readFileSync>) => {
      const result = originalRead(...values);
      if (values[0] === join(state, 'journal.jsonl')) {
        let records = 0;
        const text = String(result);
        for (let at = -1; (at = text.indexOf('\n', at + 1)) !== -1;) records++;
        checkpoint('journal-whole-read-returned', { records, bytes: Buffer.byteLength(text) });
      }
      return result;
    });
    syncBuiltinESMExports();
    t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
    const sample = async () => appendFile(join(root, 'samples.jsonl'), JSON.stringify({ ms: performance.now() - start, phase, ...process.memoryUsage(), v8: getHeapStatistics() }) + '\n');
    const native = async (stage: string) => {
      try {
        const summary = execFileSync('/usr/bin/vmmap', ['-summary', String(process.pid)], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024 });
        await writeFile(join(root, `${stage}-vmmap.txt`), summary);
      } catch { await writeFile(join(root, `${stage}-vmmap.txt`), 'unavailable: vmmap refused or timed out'); }
    };
    const writes = new Set<Promise<unknown>>();
    const writeFailures: string[] = [];
    const ownWrite = <T>(work: Promise<T>) => { writes.add(work); void work.catch(() => { writeFailures.push('sampling write failed'); terminate(); }); void work.finally(() => writes.delete(work)).catch(() => {}); return work; };
    lifetime.close(async () => { await Promise.allSettled([...writes]); });
    let pending = Promise.resolve();
    const timer = setInterval(() => { pending = ownWrite(pending.then(sample)); }, 1000);
    let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
    let startupJournal: Promise<void> | undefined;
    let outcome = 'incomplete';
    let lastSystem = 0;
    const watch = async () => {
      if (performance.now() - lastSystem < 30_000) return;
      lastSystem = performance.now();
      const reading = controlMode ? { load1: 0, swapPercent: 0 } : system();
      await appendFile(join(root, 'system.jsonl'), JSON.stringify({ ms: performance.now() - start, ...reading }) + '\n');
      if (reading.swapPercent > 90) { stopping = true; if (hub) await hub.stop(); }
    };
    const guard = setInterval(() => { pending = ownWrite(pending.then(watch)); }, 1000);
    try {
      if (stopping) throw new Error('swap stop during copy');
      await sample();
      const release = Promise.withResolvers<void>();
      lifetime.close(() => release.resolve(), { startupOnly: true });
      hub = await lifetime.start(root, {}, realClock, { hubOptions: {
        accountReader: async () => [],
        ...(args.includes('--control-held') ? { journalOpen: async (path: string) => { process.send?.({ type: 'memory-acquiring' }); await release.promise; return open(path, 'a+'); } } : {}),
        log: entry => {
          if (entry.event === 'hub-startup-step' || entry.event === 'serving') checkpoint(String(entry.step ?? entry.event));
          if (entry.event === 'hub-startup-step' && entry.step === 'reading startup journal' && !startupJournal) {
            const stats = { bytesRead: 0, peakBufferedBytes: 0 };
            // The daemon calls this same shared reader immediately after its log
            // callback; it joins this in-flight scan instead of scanning twice.
            startupJournal = readStartupJournal(join(state, 'journal.jsonl'), stats).then(records => {
              checkpoint('journal-selection-complete', { records: records.length, bytes: stats.bytesRead, peakBufferedBytes: stats.peakBufferedBytes });
            });
            ownWrite(startupJournal);
          }
        },
      } });
      phase = 'startup-ready'; await sample();
      await writeFile(join(root, 'startup-ready.json'), JSON.stringify({ ms: performance.now() - start, stoppedByGuard: stopping }));
      checkpoint('startup-ready');
      if (!args.includes('--control-omit-ready')) process.send?.({ type: 'memory-ready' });
      if (controlMode && !stopping) {
        if (args.includes('--control-write-failure')) ownWrite(Promise.reject(new Error('injected sampling write failure')));
        await stopped.promise;
      }
      if (!stopping && !controlMode) await native('startup');
      outcome = stopping ? 'guard-stopped' : 'complete';
    } finally {
      clearInterval(timer); clearInterval(guard);
      const results = await Promise.allSettled([pending, lifetime.dispose()]);
      const drained = results[1]?.status === 'fulfilled';
      if (writeFailures.length || !drained) outcome = 'incomplete';
      let finalSystem: ReturnType<typeof system> | { unavailable: string } | null;
      try {
        if (args.includes('--control-final-reading-failure')) throw new Error('injected sysctl refusal');
        finalSystem = controlMode ? null : system();
      } catch {
        finalSystem = { unavailable: 'final system reading failed' };
        outcome = 'incomplete';
      }
      await writeFile(join(root, 'outcome.json'), JSON.stringify({ outcome, stopping, stopped: drained, writeFailures, elapsedMs: performance.now() - start, finalSystem }));
      console.log(`PRIVATE_ROOT=${root}; outcome=${outcome}`);
      if (process.connected) process.disconnect();
    }
  });
}
