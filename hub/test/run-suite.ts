// One machine ticket admits an invocation; full runs retain both locks across phases.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureProcess, captureRunProcesses, cleanupProcesses, pause, type ProcessIdentity } from './process-cleanup.ts';
import { processStarted } from '../src/hub/lock.ts';
import { acquire, acquireBroker, borrowLease, inheritedLease, sweep, type Holder, type Lease } from '../src/suite-lock.ts';
import { packageShards, type SuiteShard } from '../src/suite-shards.ts';
import { describeSelection, selectPackageSuite, selectionFromEnv, type SuiteSelection, type SuiteRequest } from '../src/suite-selection.ts';

type Interruption = { signal: 'SIGINT' | 'SIGTERM' | null };
export async function runSuite(suites: string[][], options: { lockDir?: string; lockDirs?: string[]; cwd?: string; interruption?: Interruption; selection?: SuiteSelection; phaseNames?: string[]; resources?: Array<'free' | 'machine'>; workers?: number[] } = {}): Promise<number> {
  const interruption = options.interruption ?? { signal: null };
  let active: ReturnType<typeof spawn> | undefined;
  let runId = randomBytes(10).toString('base64url');
  let activeIdentity: ProcessIdentity | null = null;
  const handlers = (['SIGINT', 'SIGTERM'] as const).map((signal) => {
    const handler = () => {
      interruption.signal ??= signal;
      if (activeIdentity) void cleanupProcesses(undefined, [activeIdentity], () => {}, runId, [activeIdentity]).catch(error => process.stderr.write(String(error) + '\n'));
    };
    process.on(signal, handler);
    return { signal, handler };
  });
  const startedIdentity = processStarted(process.pid);
  if (!startedIdentity) throw new Error('cannot establish suite holder process identity');
  const holder: Holder = { pid: process.pid, started: startedIdentity, since: new Date().toISOString(), token: runId, worktree: await realpath(options.cwd ?? process.cwd()), root: join(await realpath('/tmp'), `cland-suite-${runId}`) };
  const leases: Lease[] = [];
  let machine: Lease[] = [];
  let root: string | undefined;
  const invoked = Date.now();
  let started = invoked;
  let peak = loadavg()[0]!;
  const sample = setInterval(() => { peak = Math.max(peak, loadavg()[0]!); }, 1000);
  try {
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    if (process.env.CLAND_TEST_SKIP_LOCK !== '1') {
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
    for (const [index, args] of suites.entries()) {
      if (interruption.signal) break;
      if (options.phaseNames?.[index]) process.stderr.write(`suite phase ${options.phaseNames[index]}; locks held ${JSON.stringify(leases.length ? options.lockDirs ?? [options.lockDir ?? '/tmp/cland-suite.lock'] : [])}\n`);
      if (index > 0) {
        // Remove the previous phase's processes and root without giving up admission.
        await sweep(holder);
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
      if (options.resources?.[index] === 'machine' && process.env.CLAND_TEST_SKIP_LOCK !== '1') {
        const machineDir = `${(options.lockDirs ?? [options.lockDir ?? '/tmp/cland-suite.lock'])[0]}.machine`;
        machine = await acquire([machineDir], () => interruption.signal !== null, holder);
        machineWait = Date.now() - phaseStarted;
      }
      const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: root, TMP: root, TEMP: root, TEST_SUITE_RUN_ID: holder.token };
      delete env.NODE_TEST_CONTEXT;
      const gate = join(root, `start-${index}`);
      const bootstrap = join(root, `bootstrap-${index}.mjs`);
      await writeFile(bootstrap, `import { access } from 'node:fs/promises'; import { setTimeout } from 'node:timers/promises';
const cwd = ${JSON.stringify(resolve(options.cwd ?? process.cwd()))};
while (!await access(${JSON.stringify(gate)}).then(() => true, () => false)) await setTimeout(25);
process.chdir(cwd);`);
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      const cwd = resolve(options.cwd ?? process.cwd());
      // Node resolves test targets before imports; keep them absolute while spawning in the owned root.
      const absoluteArgs = args.map((arg, index) => {
        if (arg.startsWith('-') || ['--test-name-pattern', '--test-skip-pattern'].includes(args[index - 1] ?? '')) return arg;
        const path = resolve(cwd, arg);
        return existsSync(path) || arg.includes('*') ? path : arg;
      });
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      active = spawn(process.execPath, ['--import', bootstrap, ...absoluteArgs], { cwd: root, env, detached: true, stdio: 'inherit' });
      // Install exit listeners before publication awaits; the bootstrap cannot start tests yet.
      const done = new Promise<number>((resolve, reject) => { active!.once('error', reject); active!.once('exit', (value, signal) => resolve(value ?? (signal === 'SIGINT' ? 130 : 143))); });
      activeIdentity = captureProcess(active.pid);
      if (!activeIdentity) throw new Error('cannot establish suite runner process identity');
      holder.runner = activeIdentity;
      for (const lease of [...leases, ...machine]) await lease.publish();
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      await writeFile(gate, 'ready');
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      const code = await done;
      await cleanupProcesses(root, [...captureRunProcesses(holder.token), activeIdentity], (line) => process.stderr.write(`${line}\n`), holder.token, [activeIdentity]);
      active = undefined; activeIdentity = null;
      for (const lease of machine.reverse()) await lease.release();
      machine = [];
      if (options.phaseNames?.[index]) process.stderr.write(`shard duration ${options.phaseNames[index]} ${((Date.now() - phaseStarted) / 1000).toFixed(2)}s; workers ${options.workers?.[index] ?? 4}; resource ${options.resources?.[index] ?? 'machine'}; machine wait ${(machineWait / 1000).toFixed(2)}s\n`);
      if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
      if (code !== 0) return code;
    }
    return interruption.signal ? (interruption.signal === 'SIGINT' ? 130 : 143) : 0;
  } catch (error) {
    if (interruption.signal) return interruption.signal === 'SIGINT' ? 130 : 143;
    throw error;
  } finally {
    clearInterval(sample);
    try {
      if (root) await sweep(holder);
      for (const lease of machine.reverse()) await lease.release();
      for (const lease of leases.reverse()) await lease.release();
    } finally {
      for (const { signal, handler } of handlers) process.off(signal, handler);
      process.stderr.write(`suite duration ${((Date.now() - started) / 1000).toFixed(2)}s; lock wait ${((started - invoked) / 1000).toFixed(2)}s; peak 1m load ${peak.toFixed(2)}${options.selection ? `; ${describeSelection(options.selection)}` : ''}\n`);
    }
  }
}

export async function runPackageSuite(mode: string, extra: string[] = [], options: { cwd?: string; lockDirs?: { hub: string; nvim: string } } = {}): Promise<number> {
  if (!['auto', 'all', 'hub', 'nvim'].includes(mode)) throw new Error(`unknown suite: ${mode}`);
  const cwd = options.cwd ?? fileURLToPath(new URL('../../', import.meta.url));
  const inherited = inheritedLease();
  const locks = options.lockDirs ?? { hub: inherited?.dirs[0] ?? '/tmp/cland-suite.lock', nvim: inherited?.dirs[1] ?? '/tmp/cland-suite-nvim.lock' };
  // Explicit test targets retain the single-phase fixture/targeted-run interface.
  let selection: SuiteSelection = extra.length ? { mode: mode === 'hub' ? 'hub-only' : mode === 'nvim' ? 'nvim-only' : 'full', files: extra, reason: 'explicit test targets' } : selectionFromEnv() ?? await selectPackageSuite(cwd, mode as SuiteRequest);
  if (!extra.length && mode === 'all' && selection.mode !== 'full') selection = { ...selection, mode: 'full', reason: `--all / all forces full (${selection.reason})` };
  const phases: SuiteShard[] = extra.length ? (mode === 'all' || mode === 'auto' ? ['hub', 'Neovim'] : [mode]).map(name => ({ name, targets: extra, resource: 'machine', workers: 4 })) : await packageShards(cwd, selection.mode);
  const suites = phases.map(phase => ['--test', `--test-concurrency=${phase.workers}`, ...phase.targets]);
  // Reserve both locks jointly before a full run starts. Taking Neovim later
  // while holding machine would deadlock a live legacy Neovim-first waiter.
  // A single ticket/lease spans both phases; single-phase admission is unchanged.
  const lockDirs = extra.length && mode === 'hub' ? [locks.hub] : [locks.hub, locks.nvim];
  const interruption: Interruption = { signal: null };
  // Keep the first signal latched through final cleanup, after runSuite evaluates its return.
  const handlers = (['SIGINT', 'SIGTERM'] as const).map(signal => {
    const handler = () => { interruption.signal ??= signal; };
    process.on(signal, handler);
    return { signal, handler };
  });
  try {
    const code = await runSuite(suites, { cwd, lockDirs, interruption, selection, phaseNames: phases.map(phase => phase.name), ...(!extra.length ? { resources: phases.map(phase => phase.resource), workers: phases.map(phase => phase.workers) } : {}) });
    return interruption.signal ? (interruption.signal === 'SIGINT' ? 130 : 143) : code;
  } finally {
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
  process.exitCode = await runPackageSuite(forceAll ? 'all' : mode, forceAll || mode === 'all' ? [] : filtered, { cwd });
}
