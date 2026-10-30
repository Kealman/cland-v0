/** Manual, report-only Mac memory probe. See --help. Never a suite benchmark. */
import { memoryInstrumentation } from './memory-instrumentation.ts';
import { readGuardedMachine, quietSlotReading } from './memory-machine-guard.ts';
import { sealMemoryDatabase } from './memory-seal.ts';
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
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync, backup } from 'node:sqlite';
import { getHeapStatistics } from 'node:v8';
import { fixtureEnvironment } from './fixture-environment.ts';
import { projectHub } from './harness.ts';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { realClock } from '../src/hub/clock.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { memoryStreaming } from './memory-streaming.ts';
import { memoryBudgetReport, DEFAULT_MEMORY_LIMITS, type MemoryReading, type MemoryLimits } from './memory-budget.ts';
import { memoryProducer, memoryStopReserveMs }  from './memory-producer.ts';
export { requestMemoryStop } from './memory-producer.ts';

export function swapPercent(text: string): number {
  const match = /total = ([\d.]+)([MG])\s+used = ([\d.]+)([MG])/.exec(text);
  if (!match) throw new Error('unusable vm.swapusage receipt');
  const total = Number(match[1]) * (match[2] === 'G' ? 1024 : 1);
  const used = Number(match[3]) * (match[4] === 'G' ? 1024 : 1);
  return total === 0 ? 0 : 100 * used / total;
}

/** vmmap's current physical footprint, never its peak value. */
export function physicalFootprint(text: string): number {
  const match = /^Physical footprint:\s*([\d.]+)([KMGT])?B?\s*$/mi.exec(text);
  if (!match) throw new Error('unusable physical footprint receipt');
  return Number(match[1]) * 1024 ** (match[2] ? 'KMGT'.indexOf(match[2].toUpperCase()) + 1 : 0);
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

export async function prepareCopy(source: string, root: string): Promise<void> {
  const state = join(root, '.cland');
  await mkdir(state, { mode: 0o700 });
    const copied: Record<string, unknown> = {};
    for (const name of ['tasks', 'artifacts', 'journal.jsonl', 'log']) {
      try { copied[name] = await copyTree(join(resolve(source), '.cland', name), join(state, name), name === 'artifacts'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; copied[name] = 'absent'; }
    }
    const db = new DatabaseSync(join(resolve(source), '.cland/hub.db'), { readOnly: true });
    try { await backup(db, join(state, 'hub.db'), { rate: 256 }); } finally { db.close(); }
    const sealing = sealMemoryDatabase(join(state, 'hub.db'), root);
    await writeFile(join(root, 'manifest.json'), JSON.stringify({ copied, sealing, scriptSha256: createHash('sha256').update(await readFile(import.meta.filename)).digest('hex'), platform: process.platform, arch: process.arch, node: process.version,  exclusions: 'suite recovery/artifact capabilities, artifact-index paths/redirects/entries and absolute/relative persisted suite paths (finished history row count retained); artifact body bytes (same-size sparse placeholders); live config/crew/roles/secrets/accounts/territory/worktrees; fake adapters, account and Git probes; no connected clients; snapshot GC pauses; no browser', source: resolve(source) }, null, 2));
}

const args = process.argv.slice(2);
const restSeconds = args.includes('--rest-seconds') ? Number(args[args.indexOf('--rest-seconds') + 1]) : 0;
if (!Number.isFinite(restSeconds) || restSeconds < 0 || restSeconds > 1800) throw new Error('--rest-seconds must be between 0 and 1800');
const streamRuns = args.includes('--stream-runs') ? Number(args[args.indexOf('--stream-runs') + 1]) : 0;
if (!Number.isInteger(streamRuns) || streamRuns < 0 || streamRuns > 12 || streamRuns && !restSeconds) throw new Error('--stream-runs requires rest and 1..12 fake runs');
const quietSlotUntil = args.includes('--quiet-slot-until') ? Date.parse(args[args.indexOf('--quiet-slot-until') + 1]!) : 0;
if (!Number.isFinite(quietSlotUntil)) throw new Error('--quiet-slot-until requires an ISO deadline granted by Coordinator');
const limits: MemoryLimits = { ...DEFAULT_MEMORY_LIMITS };
for (const [flag, key] of [['--heap-budget-mib', 'heap'], ['--rss-budget-mib', 'rss']] as const) {
  if (!args.includes(flag)) continue;
  const value = Number(args[args.indexOf(flag) + 1]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${flag} requires a positive MiB value`);
  limits[key] = value * 1024 * 1024;
}
const runTimeoutMs = (restSeconds + 300) * 1000;

if (args.includes('--help')) {
  console.log(`Usage: node --max-old-space-size=8192 hub/test/measure-memory.ts --source PROJECT --run\nMac only; requires a Coordinator measurement slot. Copies tasks, sparse artifact placeholders (no bodies), journal and log plus a consistent SQLite backup to a private disposable root. Never reads secrets.toml or account config. Preparation seals copied suite paths, PIDs, leases, shards and unfinished recovery; isolated recovery uses sealed owned roots and labels outside logs unavailable without reading them; manifest retains active/archive row counts. Generated config disables remotes and verification. Fake adapters/probes exclude live harnesses, accounts, Git and external network. Default startup only; --rest-seconds N adds up to 1800 seconds idle with ten-second heap/RSS/physical-footprint samples and rest boundary allocation profiles. No full snapshots. Missing native readings remain unavailable. --stream-runs N (1..12, requires rest) seeds synthetic runs after copy sealing and streams 4 KiB per run per ten seconds through production suite collection using fake receipts; no workers, network or droplets. Its phases are labelled streaming. Preflight: load1 <=8, swap <=80%; every 30s request graceful stop over IPC above 90% swap, own and join setup/profile/sample writes, await hub stop and persist outcome before native exit/pipe closure. A bounded captured-process fallback records incomplete drainage. Approximately 1-2 minutes plus requested rest including copy. Private raw profiles remain in the printed scratch root; publish aggregate allocation sites only. Use --plan --source PROJECT for a dry inventory. --heap-budget-mib N and --rss-budget-mib N write readiness/rest comparisons to memory-budget.json in report mode only; omitted budgets default to human-agreed heap256MiB/RSS768MiB, report only. Use human-agreed figures for C3. --quiet-slot-until ISO is only for an explicitly Coordinator-granted slot/used-swap waiver: it waives the used-swap thresholds, checks load1<=6, kern.memorystatus_vm_pressure_level<=1, no new swap-out pages and deadline every five seconds. vm.memory_pressure and free-memory percentage are context only. Independent preflights and persisted machine readings/refusal/native-failure causes apply. Slot admission and expiry use one full owned-shutdown reserve (75s by default); guard-interrupted child code zero is partial measurement evidence. No automatic budget enforcement.`);
} else if (args.includes('--plan')) {
  const source = resolve(args[args.indexOf('--source') + 1]!);
  const root = await mkdtemp(join(tmpdir(), 'cland-memory-plan-'));
  const env = fixtureEnvironment(root, process.env);
  const entries: Record<string, unknown> = {};
  for (const name of ['tasks', 'artifacts', 'journal.jsonl', 'log']) entries[name] = await copyTree(join(source, '.cland', name), join(root, name), name === 'artifacts', true);
  const db = await lstat(join(source, '.cland/hub.db'));
  console.log(JSON.stringify({ entries, databaseBytes: db.size, artifacts: 'same-size sparse placeholders; content bytes excluded; complete DB index retained', exclusions: 'secrets.toml, secret-shaped names, symlinks; no account/config directories', load1: loadavg()[0], swapPercent: swapPercent(execFileSync('/usr/sbin/sysctl', ['vm.swapusage'], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 2000 })) }, null, 2));
} else if (args.includes('--run') && !args.includes('--worker')) {
  test('manual memory supervisor', { timeout: runTimeoutMs }, async t => {
  if (process.platform !== 'darwin') throw new Error('Mac measurement only');
  const root = await mkdtemp(join(tmpdir(), 'cland-memory-'));
  const env = fixtureEnvironment(root, process.env);
  const system = () => ({ load1: loadavg()[0]!, swapPercent: swapPercent(execFileSync('/usr/sbin/sysctl', ['vm.swapusage'], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 2000 })), ...(quietSlotUntil ? quietSlotReading(root) : {}) });
  const before = await readGuardedMachine(root, 'parent-preflight', system, undefined, quietSlotUntil, () => {});
  if (!before) throw new Error('preflight refused; guard-stops.jsonl retains cause');
  console.log(`PRIVATE_ROOT=${root}`);
  const source = args[args.indexOf('--source') + 1];
  if (!args.includes('--source') || !source) throw new Error('--source PROJECT required');
  await prepareCopy(source, root);
  const ready = await readGuardedMachine(root, 'parent-post-copy', system, before.swapOuts, quietSlotUntil, () => {});
  if (!ready) throw new Error('post-copy preflight refused; guard-stops.jsonl retains cause');
  if (quietSlotUntil && Date.now() + restSeconds * 1000 + memoryStopReserveMs() >= quietSlotUntil) throw new Error('insufficient quiet slot time for rest and disposal');
  await writeFile(join(root, 'machine-preflight.json'), JSON.stringify({ before, afterCopy: ready, quietSlotUntil: quietSlotUntil || null, usedSwapWaived: Boolean(quietSlotUntil), shutdownReserveMs: memoryStopReserveMs() }));
  const producer = memoryProducer(t, root, ['--max-old-space-size=8192', '--heap-prof', '--heap-prof-interval=1048576', `--heap-prof-dir=${root}`, '--heap-prof-name=startup.heapprofile', import.meta.filename, ...args, '--worker', '--root', root], 10_000, { boundedTermination: Boolean(quietSlotUntil) });
  const writes = new Set<Promise<unknown>>();
  const ownWrite = <T>(work: Promise<T>) => { writes.add(work); void work.catch(() => { void producer.dispose().catch(() => {}); }); void work.finally(() => writes.delete(work)).catch(() => {}); producer.own(work); };
  let timer: ReturnType<typeof setInterval> | undefined;
  let rssTimer: ReturnType<typeof setInterval> | undefined;
  producer.close(async () => { clearInterval(timer); clearInterval(rssTimer); await Promise.allSettled([...writes]); });
  const child = producer.start();
  const interrupt = () => { void producer.dispose().catch(() => {}); };
  const expiryTimer = quietSlotUntil ? setTimeout(() => {
    ownWrite(appendFile(join(root, 'guard-stops.jsonl'), JSON.stringify({ time: Date.now(), refusal: 'quiet slot disposal reserve reached' }) + '\n'));
    interrupt();
  }, Math.max(0, quietSlotUntil - Date.now() - memoryStopReserveMs())) : undefined;
  producer.close(() => { clearTimeout(expiryTimer); });
  process.on('disconnect', interrupt);
  t.signal.addEventListener('abort', interrupt, { once: true });
  try {
    timer = setInterval(() => {
      ownWrite((async () => {
        const reading = await readGuardedMachine(root, 'parent', system, before.swapOuts, quietSlotUntil, interrupt, true);
        if (reading) await appendFile(join(root, 'supervisor.jsonl'), JSON.stringify({ time: Date.now(), ...reading }) + '\n');
      })());
    }, quietSlotUntil ? 5000 : 30_000);
    rssTimer = setInterval(() => {
      if (!child.pid) return;
      try {
        const rssKiB = Number(execFileSync('/bin/ps', ['-o', 'rss=', '-p', String(child.pid)], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 2000 }).trim());
        ownWrite(appendFile(join(root, 'rss.jsonl'), JSON.stringify({ time: Date.now(), rssBytes: rssKiB * 1024 }) + '\n'));
      } catch { /* Missing native reading remains missing. */ }
    }, 1000);
    const receipt = await producer.join(runTimeoutMs);
    if (receipt.code !== 0) throw new Error(`incomplete producer: exit=${receipt.code} signal=${receipt.signal}; ${producer.tail()}`);
    const outcome = JSON.parse(await readFile(join(root, 'outcome.json'), 'utf8')) as { outcome: string };
    if (outcome.outcome !== 'complete') throw new Error(`guard-interrupted/incomplete measurement: ${outcome.outcome}; native exit=${receipt.code} signal=${receipt.signal}`);
  } finally {
    await producer.dispose();
    process.off('disconnect', interrupt);
    t.signal.removeEventListener('abort', interrupt);
  }
  });
} else if (args.includes('--run') && args.includes('--worker')) {
  const sourceArg = args[args.indexOf('--source') + 1];
  if (!args.includes('--source') || !sourceArg) throw new Error('--source PROJECT required');
  test('manual sealed startup memory measurement', { timeout: runTimeoutMs }, async t => {
    const controlMode = args.includes('--control');
    const instrument = memoryInstrumentation(t);
    if (!controlMode && process.platform !== 'darwin') throw new Error('Mac measurement only');
    const root = args[args.indexOf('--root') + 1]!;
    await mkdir(join(root, 'home'), { mode: 0o700 });
    const env = fixtureEnvironment(root, process.env);
    const system = () => ({ load1: loadavg()[0]!, swapPercent: swapPercent(execFileSync('/usr/sbin/sysctl', ['vm.swapusage'], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 2000 })), ...(quietSlotUntil ? quietSlotReading(root) : {}) });
    const controlReading = { load1: 0, swapPercent: 0, pressure: 0, pressureLevel: 1, freeMemoryPercent: 64, swapOuts: 100 };
    const before = await readGuardedMachine(root, 'worker-preflight', () => controlMode ? controlReading : system(), undefined, quietSlotUntil, () => {});
    if (!before) throw new Error('worker preflight refused; guard-stops.jsonl retains cause');
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
    if (!controlMode || restSeconds) await new Promise<void>((resolve, reject) => {
      inspector.post('HeapProfiler.startSampling', { samplingInterval: 1048576 }, error => error ? reject(error) : resolve());
    });
    let serial = 0;
    const replayCounts = { agentsNotices: 0, otherNotices: 0 };
    const checkpoint = (boundary: string, counts: Record<string, number> = {}) => {
      const ordinal = serial++;
      fs.appendFileSync(join(root, 'boundaries.jsonl'), JSON.stringify({ ordinal, ms: performance.now() - start, boundary, ...replayCounts, ...counts, ...process.memoryUsage(), v8: getHeapStatistics() }) + '\n');
      if (controlMode && !restSeconds) return;
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
    for (const method of ['artifacts', 'topics', 'allSubscriptions', 'inboxMessages', 'inboxWaits', 'pendingApprovals', 'suiteJobHistory', 'suiteJobSummaries', 'meta'] as const) {
      const original = Store.prototype[method] as (...values: unknown[]) => unknown;
      const seen = new Set<string>();
      instrument(Store.prototype, method, function(this: Store, ...values: unknown[]) {
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
    instrument(Tracker.prototype, 'start', async function(this: Tracker, options: Parameters<typeof originalStart>[0]) {
      checkpoint('before-tracker');
      await originalStart.call(this, options);
      checkpoint('after-tracker', { records: this.list().length });
    });
    for (const method of ['noticeTo', 'noticeInTopic'] as const) {
      const original = HubCore.prototype[method] as (...values: unknown[]) => unknown;
      instrument(HubCore.prototype, method, function(this: HubCore, ...values: unknown[]) {
        if (values[0] === 'agents') replayCounts.agentsNotices++; else replayCounts.otherNotices++;
        return original.apply(this, values);
      });
    }
    const originalRead = fs.readFileSync;
    instrument(fs, 'readFileSync', (...values: Parameters<typeof fs.readFileSync>) => {
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
    let readinessMemory: MemoryReading | null = null;
    let restMemory: MemoryReading | null = null;
    const reading = (samplePhase = phase) => ({ ms: performance.now() - start, phase: samplePhase, ...process.memoryUsage(), v8: getHeapStatistics() });
    const sample = async (fact = reading()) => {
      let footprint: { bytes: number | null; unavailable?: string } = { bytes: null, unavailable: 'not a Mac native measurement' };
      if (!controlMode && (fact.phase === 'rest' || fact.phase === 'streaming')) {
        try {
          const { stdout } = await promisify(execFile)('/usr/bin/vmmap', ['-summary', String(process.pid)], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 8000, maxBuffer: 1024 * 1024 });
          footprint = { bytes: physicalFootprint(stdout) };
        } catch { footprint = { bytes: null, unavailable: 'vmmap refused, timed out or unusable' }; }
      }
      await appendFile(join(root, 'samples.jsonl'), JSON.stringify({ ...fact, footprint }) + '\n');
    };
    const native = async (stage: string) => {
      const fact = { stage, phase, ms: performance.now() - start };
      let available = false;
      try {
        if (controlMode) throw new Error('synthetic native control');
        const summary = execFileSync('/usr/bin/vmmap', ['-summary', String(process.pid)], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024 });
        await writeFile(join(root, `${stage}-vmmap.txt`), summary);
        available = true;
      } catch { await writeFile(join(root, `${stage}-vmmap.txt`), controlMode ? 'unavailable: synthetic control without vmmap' : 'unavailable: vmmap refused or timed out'); }
      await appendFile(join(root, 'native-captures.jsonl'), JSON.stringify({ ...fact, completedMs: performance.now() - start, available }) + '\n');
    };
    const writes = new Set<Promise<unknown>>();
    const writeFailures: string[] = [];
    const ownWrite = <T>(work: Promise<T>) => { writes.add(work); void work.catch(() => { writeFailures.push('sampling write failed'); terminate(); }); void work.finally(() => writes.delete(work)).catch(() => {}); return work; };
    lifetime.close(async () => { await Promise.allSettled([...writes]); });
    let pending = Promise.resolve();
    const sampleMs = controlMode && args.includes('--sample-ms') ? Number(args[args.indexOf('--sample-ms') + 1]) : restSeconds ? 10_000 : 1000;
    if (!Number.isFinite(sampleMs) || sampleMs < 10) throw new Error('invalid sample interval');
    let samplingOpen = true;
    const admitSample = () => {
      if (!samplingOpen) return false;
      const fact = reading();
      pending = ownWrite(pending.then(() => sample(fact)));
      return true;
    };
    const timer = setInterval(admitSample, sampleMs);
    const lateSample = controlMode && args.includes('--control-late-sample') ? Promise.withResolvers<void>() : undefined;
    let admittedPhase: string | undefined, writtenPhase: string | undefined, releasePhase: string | undefined;
    let hubStopped = false;
    lifetime.close(async () => {
      if (lateSample) await writeFile(join(root, 'sampling-control.json'), JSON.stringify({ admittedPhase, writtenPhase, releasePhase, disposalAdmissionRejected: !admitSample() }));
    });
    let streaming: Awaited<ReturnType<typeof memoryStreaming>> | undefined;
    let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
    let startupJournal: Promise<void> | undefined;
    let outcome = 'incomplete';
    let lastSystem = 0;
    const watch = async (force = false) => {
      if (!force && performance.now() - lastSystem < (quietSlotUntil ? 5000 : 30_000)) return;
      lastSystem = performance.now();
      const read = () => {
        if (!controlMode) return system();
        if (args.includes('--control-machine-failure')) throw Object.assign(new Error('synthetic native machine reader failure'), { status: 7, signal: 'SIGTERM', stderr: 'Bearer SYNTHETIC_MACHINE_SECRET' });
        return { ...controlReading,
          ...(args.includes('--control-machine-transient') ? { pressure: 2285 } : {}),
          ...(args.includes('--control-machine-pressure') ? { pressureLevel: 2 } : {}),
          ...(args.includes('--control-machine-load') ? { load1: 7 } : {}),
          ...(args.includes('--control-machine-swapouts') ? { swapOuts: 101 } : {}),
        };
      };
      const reading = await readGuardedMachine(root, 'worker', read, before.swapOuts, quietSlotUntil, terminate, true);
      if (reading) await appendFile(join(root, 'system.jsonl'), JSON.stringify({ ms: performance.now() - start, ...reading }) + '\n');
    };
    const guard = setInterval(() => { pending = ownWrite(pending.then(() => watch())); }, 1000);
    try {
      if (stopping) throw new Error('swap stop during copy');
      await sample();
      const release = Promise.withResolvers<void>();
      lifetime.close(() => release.resolve(), { startupOnly: true });
      if (streamRuns) { streaming = await memoryStreaming(t, root, streamRuns); lifetime.close(streaming.dispose); }
      hub = await lifetime.start(root, {}, realClock, { hubOptions: {
        accountReader: async () => [],
        ...(args.includes('--control-held') ? { journalOpen: async (path: string) => { process.send?.({ type: 'memory-acquiring' }); await release.promise; return open(path, 'a+'); } } : {}),
        log: entry => {
          if (entry.event === 'verification-checkpoint') streaming?.checkpoint();
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
      phase = 'startup-ready'; const readyReading = reading(); await sample(readyReading); readinessMemory = readyReading;
      void hub.stopped.then(() => { hubStopped = true; });
      await writeFile(join(root, 'startup-ready.json'), JSON.stringify({ ms: performance.now() - start, stoppedByGuard: stopping }));
      checkpoint('startup-ready');
      if (!stopping) await native('startup');
      if (!args.includes('--control-omit-ready')) process.send?.({ type: 'memory-ready' });
      if (restSeconds && !stopping) {
        const restPhase = streamRuns ? 'streaming' : 'rest';
        phase = restPhase;
        checkpoint(streamRuns ? 'streaming-start' : 'rest-start');
        await sample();
        if (controlMode && args.some(arg => arg.startsWith('--control-machine-'))) await watch(true);
        if (lateSample) {
          const fact = reading(); admittedPhase = fact.phase;
          pending = ownWrite(pending.then(async () => {
            await lateSample.promise;
            await sample(fact); writtenPhase = fact.phase;
          }));
        }
        let restTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([stopped.promise, new Promise<void>(resolve => { restTimer = setTimeout(resolve, restSeconds * 1000); })]);
        } finally { clearTimeout(restTimer); }
        // Close admission before joining held samples; queued facts retain their admission phase/time.
        samplingOpen = false; clearInterval(timer); clearInterval(guard);
        phase = 'rest-drain'; releasePhase = phase; lateSample?.resolve();
        await pending;
        if (streaming && !stopping) {
          if (controlMode && args.includes('--control-held-settlement')) {
            const held = Promise.withResolvers<void>();
            let entered = false, joined = false;
            lifetime.close(async () => {
              held.resolve();
              await streaming!.dispose();
              await writeFile(join(root, 'settlement-control.json'), JSON.stringify({ entered, released: true, joined }));
            });
            await streaming.finish(async () => { entered = true; await held.promise; joined = true; }, 20);
          } else await streaming.finish(hub.verificationSettled);
        }
        const endpoint = Object.freeze(reading(restPhase));
        await sample(endpoint);
        if (!stopping) {
          restMemory = endpoint;
          await writeFile(join(root, 'rest-end.json'), JSON.stringify({ ...endpoint, hubRunning: !hubStopped }));
        }
        checkpoint(stopping ? 'rest-interrupted' : streamRuns ? 'streaming-end' : 'rest-end');
        phase = 'post-rest';
      }
      if (controlMode && !restSeconds && !stopping) {
        if (args.includes('--control-write-failure')) ownWrite(Promise.reject(new Error('injected sampling write failure')));
        await stopped.promise;
      }
      outcome = stopping ? 'guard-stopped' : 'complete';
    } finally {
      samplingOpen = false; clearInterval(timer); clearInterval(guard);
      lateSample?.resolve();
      const pendingResult = await Promise.allSettled([pending]);
      const results = await Promise.allSettled([lifetime.dispose()]);
      const drained = pendingResult[0]?.status === 'fulfilled' && results[0]?.status === 'fulfilled';
      if (writeFailures.length || !drained) outcome = 'incomplete';
      let finalSystem: ReturnType<typeof system> | { unavailable: string } | null;
      try {
        if (args.includes('--control-final-reading-failure')) throw new Error('injected sysctl refusal');
        finalSystem = controlMode ? null : system();
      } catch {
        finalSystem = { unavailable: 'final system reading failed' };
        outcome = 'incomplete';
      }
      await writeFile(join(root, 'memory-budget.json'), JSON.stringify({ ...memoryBudgetReport(readinessMemory, outcome === 'complete' && restSeconds ? restMemory : null, limits), outcome, restSeconds, platform: process.platform, executor: 'embedded sealed hub', browser: null }));
      await writeFile(join(root, 'outcome.json'), JSON.stringify({ outcome, stopping, stopped: drained, writeFailures, elapsedMs: performance.now() - start, finalSystem }));
      console.log(`PRIVATE_ROOT=${root}; outcome=${outcome}`);
      if (process.connected) process.disconnect();
    }
  });
}
