import { mergeCoverageMaps, parseCoverageMap } from '../src/suite-coverage.ts';
import { tierSuiteSelection } from '../src/suite-selection.ts';
// One machine ticket admits an invocation; full runs retain both locks across phases.
import { createConnection } from 'node:net';
import { promisify } from 'node:util';
import { execFile, spawn } from 'node:child_process';
import { hubDiscovery, readDiscovery } from '../src/project.ts';
import { PROTOCOL_VERSION, parseFrame, type SuiteSlotResult } from '../src/protocol.ts';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile, rm } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { captureProcess, cleanupOwnedProcesses, pause, type ProcessIdentity } from './process-cleanup.ts';
import { processStarted } from '../src/hub/lock.ts';
import { acquire, acquireBroker, borrowLease, inheritedLease, sweep, type Holder, type Lease } from '../src/suite-lock.ts';
import { packageShards, readTierAssignments, type SuiteShard } from '../src/suite-shards.ts';
import { planTierReport, tierReport, type TierPlan } from '../src/suite-tier-report.ts';
import { suiteLimits } from '../src/suite-limits.ts';
import { describeSelection, selectPackageSuite, selectionFromEnv, type SuiteSelection, type SuiteRequest } from '../src/suite-selection.ts';
import { checkDurations, durationRegressions, lintDurationManifest, readDurationManifest, type DurationManifest, type DurationRegression, type TestTiming } from '../src/suite-durations.ts';
import { durationBudgetReport } from '../src/suite-duration-budget.ts';
import { reduceCoverage } from '../src/suite-coverage.ts';
import { loadGateReporter, runLoadGate } from './load-gate.ts';
import { assertTestAdmission } from '../src/test-admission.ts';
import { readQuarantineManifest, type QuarantineReceipt } from '../src/suite-quarantine.ts';
import { AdmissionTimeout } from '../src/test-admission-outcome.ts';
import { suiteTestEnv } from '../src/verification-occasion.ts';

import { webPhaseAvailable, type WebPrerequisite } from '../src/web-phase.ts';

// Candidate capability read by verificationCommands; old runners retain their recorded tiers.
export const supportsWebPhase = true;

type Interruption = { signal: 'SIGINT' | 'SIGTERM' | null };
export async function runSuite(suites: string[][], options: { lockDir?: string; lockDirs?: string[]; cwd?: string; interruption?: Interruption; selection?: SuiteSelection; phaseNames?: string[]; resources?: Array<'free' | 'machine'>; workers?: number[]; force?: boolean; token?: string; tierPlan?: TierPlan } = {}): Promise<number> {
  try { await assertTestAdmission(options.cwd); }
  catch (error) {
    if (!(error instanceof AdmissionTimeout)) throw error;
    process.stderr.write(`${error.message}\nsuite admission timeouts ${JSON.stringify([{ message: error.message }])}\nsuite test failures []\n`);
    return 75;
  }
  const interruption = options.interruption ?? { signal: null };
  let active: ReturnType<typeof spawn> | undefined;
  let runId = options.token ?? randomBytes(10).toString('base64url');
  let activeIdentity: ProcessIdentity | null = null;
  const loadRunners = new Set<ProcessIdentity>();
  const handlers = (['SIGINT', 'SIGTERM'] as const).map((signal) => {
    const handler = () => {
      interruption.signal ??= signal;
      if (activeIdentity) void cleanupOwnedProcesses([activeIdentity]).catch(error => process.stderr.write(String(error) + '\n'));
      if (loadRunners.size) void cleanupOwnedProcesses([...loadRunners]).catch(error => process.stderr.write(String(error) + '\n'));
    };
    process.on(signal, handler);
    return { signal, handler };
  });
  const startedIdentity = processStarted(process.pid);
  if (!startedIdentity) throw new Error('cannot establish suite holder process identity');
  const holder: Holder = { pid: process.pid, started: startedIdentity, startedUtc: processStarted(process.pid, 'UTC'), since: new Date().toISOString(), token: runId, worktree: await realpath(options.cwd ?? process.cwd()), root: join(await realpath('/tmp'), `cland-suite-${runId}`) };
  const leases: Lease[] = [];
  let machine: Lease[] = [];
  let root: string | undefined;
  const invoked = Date.now();
  let started = invoked;
  let peak = loadavg()[0]!;
  const sample = setInterval(() => { peak = Math.max(peak, loadavg()[0]!); }, 1000);
  let durationManifest: DurationManifest | null = null;
  let budgetOverheadMs = 0;
  let loadExtraWallMs = 0;
  const regressions: DurationRegression[] = [];
  const observed: TestTiming[] = [];
  const recording = options.selection?.recordCoverage;
  const output = process.env.CLAND_COVERAGE_OUTPUT;
  const coverageFiles = new Set<string>();
  const coverageRaw = recording && output ? `${output}.raw` : undefined;
  try {
    const budgetStarted = performance.now();
    durationManifest = await readDurationManifest(options.cwd ?? process.cwd());
    if (durationManifest) lintDurationManifest(durationManifest);
    const quarantine = await readQuarantineManifest(options.cwd ?? process.cwd());
    const tiers = await readTierAssignments(options.cwd ?? process.cwd());
    // D53 rollout switch: report-only now; enforce when resource budgets go hard.
    const tierResourceMode = process.env.CLAND_TEST_TIER_MODE ?? 'report-only';
    if (!['report-only', 'enforce'].includes(tierResourceMode)) throw new Error('CLAND_TEST_TIER_MODE must be report-only or enforce');
    budgetOverheadMs += performance.now() - budgetStarted;
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    if (!options.force && process.env.CLAND_TEST_SKIP_LOCK !== '1') {
      const dirs = options.lockDirs ?? [options.lockDir ?? '/tmp/cland-suite.lock'];
      leases.push(...(options.resources ? await acquireBroker(dirs, () => interruption.signal !== null, holder) : await borrowLease(dirs, holder) ?? await acquire(dirs, () => interruption.signal !== null, holder)));
      runId = holder.token;
    }
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    started = Date.now();
    peak = loadavg()[0]!;
    // The unique planned path was durably published with the initial lock, before mkdir.
    root = holder.root!;
    await mkdir(root, { mode: 0o700 });
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    const rootInfo = await stat(root);
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    holder.root = root; holder.device = rootInfo.dev; holder.inode = rootInfo.ino;
    for (const lease of leases) await lease.publish();
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    const hasWeb = suites.some(args => args.some(arg => arg.startsWith('web/test/')));
    const webAvailable = hasWeb && await webPhaseAvailable(async () => {
      const prerequisite = await import(pathToFileURL(join(holder.worktree!, 'web/test/prerequisite.ts')).href) as { webPrerequisite: () => Promise<WebPrerequisite> };
      return prerequisite.webPrerequisite();
    }, line => process.stdout.write(line + '\n'));
    if (webAvailable && existsSync(join(holder.worktree!, 'web/build.ts'))) {
      const { ensureWebBuild } = await import('./web-build.ts');
      await ensureWebBuild(holder.worktree!);
    }
    for (const [index, args] of suites.entries()) {
      if (interruption.signal) break;
      const webPhase = args.some(arg => arg.startsWith('web/test/'));
      if (webPhase && !webAvailable) continue;
      if (options.phaseNames?.[index]) process.stderr.write(`suite phase ${options.phaseNames[index]}; locks held ${JSON.stringify(leases.length ? options.lockDirs ?? [options.lockDir ?? '/tmp/cland-suite.lock'] : [])}\n`);
      if (index > 0) {
        // The previous phase was swept; create a fresh root without giving up admission.
        if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
        holder.phase = index;
        root = join(await realpath('/tmp'), `cland-suite-${holder.token}-${index}`);
        holder.root = root;
        delete holder.device; delete holder.inode; delete holder.runner;
        // Publish the planned root before recreating it, covering death in this gap.
        for (const lease of leases) await lease.publish();
        await mkdir(root, { mode: 0o700 });
        const info = await stat(root);
        holder.device = info.dev; holder.inode = info.ino;
        for (const lease of leases) await lease.publish();
        if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      }
      const phaseStarted = Date.now();
      let machineWait = 0;
      if (options.resources?.[index] === 'machine' && !options.force && process.env.CLAND_TEST_SKIP_LOCK !== '1') {
        const machineDir = `${(options.lockDirs ?? [options.lockDir ?? '/tmp/cland-suite.lock'])[0]}.machine`;
        machine = await acquire([machineDir], () => interruption.signal !== null, holder);
        machineWait = Date.now() - phaseStarted;
      }
      const env: NodeJS.ProcessEnv = { ...suiteTestEnv(options.selection), TMPDIR: root, TMP: root, TEMP: root, TEST_SUITE_RUN_ID: holder.token, TEST_SUITE_CWD: holder.worktree };
      // Selection belongs to this runner, not its tests or any nested package run.
      delete env.CLAND_SUITE_SELECTION;
      delete env.CLAND_SUITE_SELECTION_FILE;
      // Never propagate a parent's capture into nested fixture package runs.
      delete env.CLAND_COVERAGE_OUTPUT;
      delete env.NODE_TEST_CONTEXT;
      delete env.CLAND_TEST_QUARANTINE;
      delete env.CLAND_TEST_TIER_ASSIGNMENTS;
      delete env.CLAND_TEST_TIER_REPORT;
      // Timing accounting exists only when this phase has a duration manifest.
      env.CLAND_TEST_TIMING_RECEIPTS = durationManifest ? '1' : '0';
      if (!root) throw new Error('suite phase root is missing');
      const tierTrips = join(root, 'tier-mismatches.jsonl');
      if (tiers && args.includes('--test')) {
        env.CLAND_TEST_TIER_ASSIGNMENTS = join(root, 'tier-assignments.json');
        env.CLAND_TEST_TIER_MODE = tierResourceMode;
        env.CLAND_TEST_TIER_REPORT = tierTrips;
        await writeFile(env.CLAND_TEST_TIER_ASSIGNMENTS, JSON.stringify({ tests: Object.fromEntries(tiers), report: tierTrips }));
      }
      const gate = join(root, `start-${index}`);
      const bootstrap = join(root, `bootstrap-${index}.mjs`);
      await writeFile(bootstrap, `import { access } from 'node:fs/promises'; import { setTimeout } from 'node:timers/promises';
const cwd = ${JSON.stringify(resolve(options.cwd ?? process.cwd()))};
while (!await access(${JSON.stringify(gate)}).then(() => true, () => false)) await setTimeout(25);
process.chdir(cwd);`);
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      const cwd = resolve(options.cwd ?? process.cwd());
      const capture = coverageRaw && args.includes('--test') && args.some(arg => arg.startsWith('hub/'));
      if (capture) {
        await mkdir(coverageRaw, { recursive: true });
        env.NODE_V8_COVERAGE = coverageRaw;
        for (const arg of args) if (/^hub\/(?:src|test)\/.+\.test\.ts$/.test(arg)) coverageFiles.add(arg);
      }
      // Node resolves test targets before imports; keep them absolute while spawning in the owned root.
      const absoluteArgs = args.map((arg, index) => {
        if (arg.startsWith('-') || ['--test-name-pattern', '--test-skip-pattern'].includes(args[index - 1] ?? '')) return arg;
        const path = resolve(cwd, arg);
        return existsSync(path) || arg.includes('*') ? path : arg;
      });
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      const limits = await suiteLimits(cwd);
      const reporters = args.includes('--test') ? [
        `--test-timeout=${limits.testTimeoutMs}`,
        '--test-reporter=spec', '--test-reporter-destination=stdout',
        `--test-reporter=${fileURLToPath(new URL('./skip-reporter.ts', import.meta.url))}`, '--test-reporter-destination=stdout',
      ] : [];
      const timingsPath = join(root, `durations-${index}.jsonl`);
      if (durationManifest && args.includes('--test')) reporters.unshift(`--test-reporter=${fileURLToPath(new URL('./duration-reporter.ts', import.meta.url))}`, `--test-reporter-destination=${timingsPath}`);
      const loadDiscovery = join(root, `load-discovery-${index}.jsonl`);
      const loadGate = !webPhase && options.selection?.loadGate === true && durationManifest && args.includes('--test');
      if (loadGate) reporters.push(`--test-reporter=${loadGateReporter}`, `--test-reporter-destination=${loadDiscovery}`);
      const quarantinePath = join(root, `quarantine-${index}.json`);
      // Always collect assertion/admission identities, even with no quarantine.
      const checkQuarantine = args.includes('--test');
      if (checkQuarantine) {
        env.CLAND_TEST_QUARANTINE = JSON.stringify(quarantine ?? { version: 1, tests: {} });
        reporters.push(`--test-reporter=${fileURLToPath(new URL('./quarantine-reporter.ts', import.meta.url))}`, `--test-reporter-destination=${quarantinePath}`);
      }
      active = spawn(process.execPath, ['--import', bootstrap, ...(env.CLAND_TEST_TIER_ASSIGNMENTS ? ['--import', fileURLToPath(new URL('./tier-bootstrap.mjs', import.meta.url))] : []), ...(capture ? ['--import', fileURLToPath(new URL('./coverage-bootstrap.mjs', import.meta.url))] : []), ...reporters, ...absoluteArgs], { cwd: root, env, detached: true, stdio: 'inherit' });
      // Install exit listeners before publication awaits; the bootstrap cannot start tests yet.
      const done = new Promise<number>((resolve, reject) => { active!.once('error', reject); active!.once('exit', (value, signal) => resolve(value ?? (signal === 'SIGINT' ? 130 : 143))); });
      activeIdentity = captureProcess(active.pid);
      if (!activeIdentity) throw new Error('cannot establish suite runner process identity');
      holder.runner = activeIdentity;
      for (const lease of [...leases, ...machine]) await lease.publish();
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      await writeFile(gate, 'ready');
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      const repeats = loadGate ? runLoadGate({
        ...(options.selection ? { selection: options.selection } : {}),
        discovery: loadDiscovery, root, cwd, env, manifest: durationManifest!,
        quarantine,
        timeoutMs: limits.testTimeoutMs, workers: limits.loadGateWorkers, phase: done,
        interrupted: () => interruption.signal !== null, active: loadRunners,
      }) : Promise.resolve({ failed: false, extraWallMs: 0 });
      // A gross hang guard is separate from the measured 40 s Web budget.
      const phaseGuard = webPhase ? setTimeout(() => {
        process.stderr.write('Web phase exceeded 60 s gross hang guard\n');
        if (activeIdentity) void cleanupOwnedProcesses([activeIdentity]);
      }, 60_000) : undefined;
      const [phaseOutcome, gateOutcome] = await Promise.allSettled([done, repeats]);
      clearTimeout(phaseGuard);
      if (phaseOutcome.status === 'rejected') throw phaseOutcome.reason;
      if (gateOutcome.status === 'rejected') throw gateOutcome.reason;
      let code = phaseOutcome.value;
      const loadResult = gateOutcome.value;
      loadExtraWallMs += loadResult.extraWallMs;
      // Includes repetition-only trips; each test/resource needs one first stack.
      const reportedTrips = new Set<string>();
      let tierFailed = false;
      for (const line of (await readFile(tierTrips, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; })).split('\n').filter(Boolean)) {
        const row = line.startsWith('tier-mismatch {') ? JSON.parse(line.slice('tier-mismatch '.length)) as { file: string; name: string; resource: string; mode: string } : undefined;
        if (row?.mode === 'enforce') tierFailed = true;
        const key = row ? JSON.stringify([row.file, row.name, row.resource]) : line;
        if (!reportedTrips.has(key)) { reportedTrips.add(key); process.stdout.write(line + '\n'); }
      }
      if (checkQuarantine) {
        const receipt = JSON.parse(await readFile(quarantinePath, 'utf8')) as QuarantineReceipt;
        for (const result of receipt.results) process.stdout.write(`suite quarantine ${JSON.stringify(result)}\n`);
        process.stdout.write(`suite test failures ${JSON.stringify(receipt.failures)}\n`);
        if (receipt.admissionTimeouts?.length) process.stdout.write(`suite admission timeouts ${JSON.stringify(receipt.admissionTimeouts)}\n`);
        if (code === 1 && receipt.complete && receipt.cancelled === 0 && receipt.failures.length === 0 && !receipt.admissionTimeouts?.length && receipt.excused > 0) code = 0;
      }
      // Resource policy is independent of assertion quarantine or caught errors.
      if (tierFailed) code = 1;
      let budgetFailed = false;
      if (webPhase) {
        const seconds = (Date.now() - phaseStarted - machineWait) / 1000;
        const limit = durationManifest?.budget.Web?.wallSeconds ?? 40;
        process.stdout.write(`budget${durationManifest?.budget.mode === 'enforce' ? '' : ' (report only)'}: Web phase wall ${seconds.toFixed(3)} s; budget ${limit} s${seconds > limit ? '; over budget' : ''}\n`);
        budgetFailed = seconds > limit && durationManifest?.budget.mode === 'enforce';
      }
      if (durationManifest && args.includes('--test')) {
        const budgetStarted = performance.now();
        try {
          const records = (await readFile(timingsPath, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as TestTiming | { overheadMs: number });
          const tests: TestTiming[] = [];
          for (const record of records) {
            if ('overheadMs' in record) budgetOverheadMs += record.overheadMs;
            else { tests.push(record); observed.push(record); }
          }
          const checked = checkDurations(tests, durationManifest, tiers ? Object.fromEntries(tiers) : {});
          regressions.push(...checked.regressions);
          for (const failure of checked.failures) process.stderr.write(failure + '\n');
          budgetFailed ||= checked.failures.length > 0;
        } finally { budgetOverheadMs += performance.now() - budgetStarted; }
      }
      await sweep(holder);
      root = undefined;
      active = undefined; activeIdentity = null;
      for (const lease of machine.reverse()) await lease.release();
      machine = [];
      if (options.phaseNames?.[index]) process.stderr.write(`shard duration ${options.phaseNames[index]} ${((Date.now() - phaseStarted) / 1000).toFixed(2)}s; workers ${options.workers?.[index] ?? 4}; resource ${options.resources?.[index] ?? 'machine'}; machine wait ${(machineWait / 1000).toFixed(2)}s\n`);
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      if (code !== 0) return code;
      if (budgetFailed) return 1;
      if (loadResult.failed) return 1;
    }
    if (recording && output && coverageRaw && coverageFiles.size > 0 && !interruption.signal) {
      let map = await reduceCoverage(resolve(options.cwd ?? process.cwd()), coverageRaw, recording, [...coverageFiles]);
      if (process.env.CLAND_COVERAGE_APPEND === '1') {
        const previous = await readFile(output, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
        if (previous !== null) map = mergeCoverageMaps(parseCoverageMap(previous), map);
      }
      await writeFile(output, JSON.stringify(map), { mode: 0o600 });
      process.stdout.write(`suite coverage map ${output}; head ${map.head}; tree ${map.tree}; ${map.testFiles.length} test files; ${Object.keys(map.files).length} source files\n`);
      await rm(coverageRaw, { recursive: true, force: true });
    }
    return interruption.signal ? (interruption.signal === 'SIGINT' ? 130 : 143) : 0;
  } catch (error) {
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    throw error;
  } finally {
    clearInterval(sample);
    try {
      if (loadRunners.size) await cleanupOwnedProcesses([...loadRunners]);
      if (root) await sweep(holder);
      for (const lease of machine.reverse()) await lease.release();
      for (const lease of leases.reverse()) await lease.release();
    } finally {
      for (const { signal, handler } of handlers) process.off(signal, handler);
      if (durationManifest) {
        const budgetStarted = performance.now();
        try {
          const tiers = await readTierAssignments(options.cwd ?? process.cwd());
          if (tiers) for (const line of durationBudgetReport(durationManifest, Object.fromEntries(tiers), observed)) process.stderr.write(line + '\n');
        } catch { process.stderr.write('budget (report only): unavailable (report read failed)\n'); }
        for (const line of durationRegressions(regressions)) process.stderr.write(line + '\n');
        budgetOverheadMs += performance.now() - budgetStarted;
        process.stderr.write(`suite budget overhead ${budgetOverheadMs.toFixed(2)} ms\n`);
      }
      process.stderr.write(`suite duration ${((Date.now() - started) / 1000).toFixed(2)}s; lock wait ${((started - invoked) / 1000).toFixed(2)}s; peak 1m load ${peak.toFixed(2)}${options.selection?.loadGate ? `; load gate extra wall ${(loadExtraWallMs / 1000).toFixed(2)}s` : ''}${options.selection ? `; ${describeSelection(options.selection)}` : ''}\n`);
      for (const line of tierReport(options.tierPlan ?? [], observed)) process.stderr.write(line + '\n');
    }
  }
}

// Keep the human's socket open through admission and lease acquisition. Each poll
// is an ordinary frame; closing this socket removes only this invocation's slot.
async function humanQueue(cwd: string, selection: SuiteSelection, token: string, force: boolean, interrupted: () => boolean): Promise<{ close: () => void; locks?: string[] } | null> {
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) {
    process.stderr.write(force ? 'no hub queue is in use; --force runs unlocked\n' : 'no hub queue is in use; using the compatibility lease\n');
    return null;
  }
  const socket = createConnection(discovery.socket);
  socket.setEncoding('utf8');
  const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  let buffer = ''; let welcomed = false; let failure: Error | null = null;
  const fail = (error: Error) => { failure = error; for (const p of pending.values()) p.reject(error); pending.clear(); };
  socket.on('error', fail);
  socket.on('close', () => fail(new Error('human suite queue connection closed')));
  socket.on('connect', () => socket.write(`${JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'cli' })}\n`));
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const frame = parseFrame(buffer.slice(0, nl)); buffer = buffer.slice(nl + 1);
      if (frame?.type === 'welcome') welcomed = true;
      else if (frame?.type === 'error') fail(new Error(String(frame.message)));
      else if (frame?.type === 'result' && typeof frame.id === 'string') {
        const p = pending.get(frame.id); pending.delete(frame.id);
        if (frame.ok) p?.resolve(frame.value); else p?.reject(new Error(String(frame.error)));
      }
    }
  });
  const close = () => socket.destroy();
  const signal = () => close();
  process.on('SIGINT', signal); process.on('SIGTERM', signal);
  const release = () => { process.off('SIGINT', signal); process.off('SIGTERM', signal); close(); };
  let joined = false;
  try {
    const deadline = Date.now() + 3000;
    while (!welcomed && !failure && !interrupted() && Date.now() < deadline) await pause(25);
    if (failure) throw failure;
    if (interrupted()) throw new Error('human suite interrupted');
    if (!welcomed) throw new Error('hub did not answer within 3 seconds');
    const head = await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd, timeout: 3000 }).then(r => r.stdout.trim(), () => 'unknown');
    const input = { type: force ? 'suite.forced' : 'suite.slot', mode: selection.mode, cwd: resolve(cwd), head, pid: process.pid, token };
    let sequence = 0;
    const request = async (): Promise<SuiteSlotResult> => {
      if (failure) throw failure;
      const id = `${token}:${++sequence}`;
      return await new Promise<SuiteSlotResult>((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('hub suite slot did not answer')); }, joined ? 10_000 : 3000);
        pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value as SuiteSlotResult); }, reject: error => { clearTimeout(timer); reject(error); } });
        socket.write(`${JSON.stringify({ ...input, id })}\n`);
      });
    };
    let result = await request(); joined = true;
    if (force) { release(); return { close: () => {} }; }
    let last = ''; let printed = 0;
    while (!result.admitted) {
      if (interrupted()) throw new Error('human suite interrupted');
      const waiter = result.queue.waiters.find(w => w.id === result.id);
      const holder = result.queue.holder;
      const duration = (ms: number | null) => ms === null ? 'unknown' : `${Math.ceil(ms / 1000)}s`;
      const place = `${waiter?.position ?? '?'} of ${result.queue.waiters.length}`;
      const eta = duration(waiter?.etaMs ?? null);
      const signature = `${place}:${eta}:${holder?.session}:${holder?.pid}`;
      if (signature !== last || Date.now() - printed >= 60_000) {
        process.stderr.write(`waiting for the suite queue: place ${place} · ${holder?.session ?? holder?.kind ?? 'no holder'} runs ${duration(holder?.runMs ?? null)} · ETA ~${eta}\n`);
        last = signature; printed = Date.now();
      }
      await pause(250);
      result = await request();
    }
    return { close: release, locks: result.locks };
  } catch (error) {
    release();
    if (interrupted() || joined) throw error;
    process.stderr.write(force ? 'no hub queue is in use; --force runs unlocked\n' : 'no hub queue is in use; using the compatibility lease\n');
    return null;
  }
}

/** Plan package entry points without acquiring locks or starting test processes. */
export async function packageSuitePlan(cwd: string, mode: string, extra: string[], locks: { hub: string; nvim: string }, env: NodeJS.ProcessEnv = process.env) {
  const tierIndex = extra.indexOf('--tier');
  const tier = tierIndex < 0 ? undefined : extra[tierIndex + 1];
  if (tierIndex >= 0) {
    if (!['T1', 'T2', 'T3', 'T4', 'Web'].includes(tier ?? '')) throw new Error('--tier requires T1, T2, T3, T4 or Web');
    extra = extra.filter((_, i) => i !== tierIndex && i !== tierIndex + 1);
    if (extra.length) throw new Error('--tier cannot be combined with explicit test targets');
  }
  // Explicit test targets retain the single-phase fixture/targeted-run interface.
  let selection: SuiteSelection = extra.length ? { mode: mode === 'hub' ? 'hub-only' : mode === 'nvim' ? 'nvim-only' : 'full', files: extra, reason: 'explicit test targets' } : selectionFromEnv(env) ?? await selectPackageSuite(cwd, mode as SuiteRequest);
  if (!extra.length && mode === 'all' && selection.tiers?.join(',') === 'T1,T2') {
    const { tiers: _tiers, nvimTests: _nvimTests, ...full } = selection;
    selection = { ...full, mode: 'full', reason: `--all / all forces full (${selection.reason})` };
  }
  if (!extra.length && mode === 'all' && selection.mode !== 'full') selection = { ...selection, mode: 'full', reason: `--all / all forces full (${selection.reason})` };
  if (tier) selection = tierSuiteSelection(selection, tier as 'T1' | 'T2' | 'T3' | 'T4' | 'Web');
  const executor = env.CLAND_SUITE_EXECUTOR === 'droplet' ? 'droplet' : 'local';
  const workers = env.CLAND_SUITE_WORKERS === undefined ? (await suiteLimits(cwd, executor, env)).workers : Number(env.CLAND_SUITE_WORKERS);
  if (!Number.isSafeInteger(workers) || workers < 1) throw new Error('workers must be a positive integer');
  const phases: SuiteShard[] = extra.length ? (mode === 'all' || mode === 'auto' ? ['hub', 'Neovim'] : [mode]).map(name => ({ name, targets: extra, resource: 'machine', workers })) : await packageShards(cwd, selection.mode, selection.shard, selection, { executor, workers });
  const tierPlan = await planTierReport(cwd, selection, workers, phases);
  const suites = phases.map(phase => ['--test', `--test-concurrency=${phase.workers}`, ...phase.targets]);
  // Reserve both locks jointly before a full run starts. Taking Neovim later
  // while holding machine would deadlock a live legacy Neovim-first waiter.
  // A single ticket/lease spans both phases; single-phase admission is unchanged.
  const lockDirs = extra.length && mode === 'hub' ? [locks.hub] : [locks.hub, locks.nvim];
  return { selection, phases, tierPlan, suites, lockDirs, targeted: extra.length > 0 };
}

export async function runPackageSuite(mode: string, extra: string[] = [], options: { cwd?: string; lockDirs?: { hub: string; nvim: string } } = {}): Promise<number> {
  if (!['auto', 'all', 'hub', 'nvim'].includes(mode)) throw new Error(`unknown suite: ${mode}`);
  const force = extra.includes('--force');
  extra = extra.filter(arg => arg !== '--force');
  const cwd = options.cwd ?? fileURLToPath(new URL('../../', import.meta.url));
  const inherited = inheritedLease();
  const locks = options.lockDirs ?? { hub: inherited?.dirs[0] ?? '/tmp/cland-suite.lock', nvim: inherited?.dirs[1] ?? '/tmp/cland-suite-nvim.lock' };
  const { selection, phases, tierPlan, suites, lockDirs: plannedLocks, targeted } = await packageSuitePlan(cwd, mode, extra, locks);
  let lockDirs = plannedLocks;
  const interruption: Interruption = { signal: null };
  // Keep the first signal latched through final cleanup, after runSuite evaluates its return.
  const handlers = (['SIGINT', 'SIGTERM'] as const).map(signal => {
    const handler = () => { interruption.signal ??= signal; };
    process.on(signal, handler);
    return { signal, handler };
  });
  let queue: Awaited<ReturnType<typeof humanQueue>> = null;
  const token = randomBytes(10).toString('base64url');
  try {
    if (force || (!inherited && !process.env.CLAND_SESSION_NAME && process.env.CLAND_TEST_SKIP_LOCK !== '1')) {
      queue = await humanQueue(cwd, selection, token, force, () => interruption.signal !== null);
      if (queue?.locks && !options.lockDirs) lockDirs = queue.locks;
    }
    const code = await runSuite(suites, { cwd, lockDirs, interruption, selection, force, token, tierPlan, phaseNames: phases.map(phase => phase.name), workers: phases.map(phase => phase.workers), ...(!targeted ? { resources: phases.map(phase => phase.resource) } : {}) });
    return interruption.signal ? (interruption.signal === 'SIGINT' ? 130 : 143) : code;
  } catch (error) {
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    throw error;
  } finally {
    queue?.close();
    for (const { signal, handler } of handlers) process.off(signal, handler);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const forceAll = args.includes('--all');
  const filtered = args.filter(arg => arg !== '--all');
  const mode = filtered[0] && ['auto', 'all', 'hub', 'nvim'].includes(filtered[0]) ? filtered.shift()! : 'auto';
  const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
  const cwd = resolve(process.cwd()) === resolve(packageRoot, 'hub') ? packageRoot : process.cwd();
  process.exitCode = await runPackageSuite(forceAll ? 'all' : mode, forceAll || mode === 'all' ? filtered.filter((arg, i) => arg === '--force' || arg === '--tier' || filtered[i - 1] === '--tier') : filtered, { cwd });
}
