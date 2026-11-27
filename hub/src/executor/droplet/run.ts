import type { LogFn } from '../../log.ts';
import { parseTimingReceipts, readTimingReceipts } from '../../suite-timing-receipts.ts';
import { incompletePackageStatus, readRunDeadline } from './metrics.ts';
import { readSuiteCauseBounded, SUITE_CAUSE_BYTES, SUITE_INFRASTRUCTURE_PREFIX } from '../../suite-infrastructure.ts';
import { verificationSteps, verificationStepCommand } from '../../verification-plan.ts';
import { parseTierReceipts, readTierReceipts, tierReceiptWriterProgram } from '../../verification-tier-receipts.ts';
import { realClock, type Clock } from '../../hub/clock.ts';
import type { DropletDependencies, MachineTransport } from './dependencies.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendFile, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { parseConfig, defaultConfig } from '../../init/config.ts';
import { basename } from 'node:path';
import { recordedCommands } from '../../verification-commands.ts';
import type { RunRef, RunStatus } from '../executor.ts';
import { Machine, MachineRequestError, machineEnv, shellQuote as quote } from './machine.ts';
import { DigitalOceanApi, DigitalOceanError } from './api.ts';
import { readSnapshot } from './prepare.ts';
import { writeLease, type DropletLease } from './lease.ts';
import { pause, testTiming } from './watchdog.ts';
import { ReadinessDeadlineError } from './readiness-deadline.ts';
import { candidatePathspec, candidateTree, excludedPaths } from '../../verification-tree.ts';
import { selectionTransport } from '../../suite-selection.ts';

/** Copy retries have closed without delivering the run; a new machine is safe. */
export class DeliveryTransportError extends Error {
  readonly attempts: number;
  constructor(message: string, attempts: number, cause?: unknown) {
    super(message, { cause }); this.attempts = attempts;
  }
}

const exec = promisify(execFile);
/** Local diagnostics must never contribute to the remote log replay offset. */
export const coverageDownloadDiagnostic = (coveragePath: string): string => join(dirname(coveragePath), 'coverage-download.log');
/** Hosting-source program; delivered older trees need not contain the reader. */
export function runStatusProgram(): string {
  const timing = `if(fs.existsSync(p+'/timing-receipts.json')){const rows=(${readTimingReceipts.toString()})(fs,p+'/timing-receipts.json',(${parseTimingReceipts.toString()}));if(rows)status.timingReceipts=rows;}`;
  return `const fs=require('fs'),p=process.argv[1];const readCause=(${readSuiteCauseBounded.toString()});const incomplete=(${incompletePackageStatus.toString()});const platform=fs.existsSync(p+'/platform')?JSON.parse(fs.readFileSync(p+'/platform','utf8')):undefined;let status={state:'pending',platform};if(fs.existsSync(p+'/done')){const finished=fs.readFileSync(p+'/done','utf8').trim();status=finished?{state:'done',code:Number(fs.readFileSync(p+'/exit','utf8')),cause:readCause(fs,p+'/cause',${SUITE_CAUSE_BYTES},${JSON.stringify(SUITE_INFRASTRUCTURE_PREFIX)}),finished,platform}:{state:'running',platform};}else if(fs.existsSync(p+'/package-incomplete')){status={...incomplete(fs,p+'/package-incomplete'),platform};}else if(fs.existsSync(p+'/pgid')){let alive=true;try{process.kill(-Number(fs.readFileSync(p+'/pgid','utf8')),0)}catch(error){alive=error?.code==='ESRCH'?false:null}status=alive===null?{state:'unknown',platform}:alive?{state:'running',platform}:fs.existsSync(p+'/package-pending')&&!fs.existsSync(p+'/package-closed')?{...incomplete(fs,p+'/package-incomplete'),platform}:{state:'done',code:1,cause:'remote runner disappeared without a done marker',finished:new Date().toISOString(),platform};}if(fs.existsSync(p+'/tier-receipts.json')){const rows=(${readTierReceipts.toString()})(fs,p+'/tier-receipts.json',(${parseTierReceipts.toString()}));if(rows)status.tierReceipts=rows;}${timing}if(fs.existsSync(p+'/deadline-expired')&&(${readRunDeadline.toString()})(fs,p+'/deadline-expired',()=>{status.cause=(status.cause||'')+'; secondary diagnostic: deadline receipt close failed'}))status.deadlineExpired=true;console.log(JSON.stringify(status));`;
}
const remoteDir = (lease: DropletLease): string => {
  if (!/^[a-zA-Z0-9-]+$/.test(lease.run)) throw new Error('invalid remote run id');
  return `"$HOME/runs/${lease.run}"`;
};

/** Native Git bytes and worktree validation, separate from delivery policy. */
export async function runBundle(run: RunRef, bundle: string, snapshotBase: string | undefined, committedOnly: boolean, env: NodeJS.ProcessEnv): Promise<void> {
  const git = async (...args: string[]) => (await exec('git', args, { cwd: run.cwd, env: machineEnv(env), timeout: 30000, maxBuffer: 16 * 1024 * 1024 })).stdout.trim();
  const checkWorktree = async () => {
    // Administrative writes may race delivery; bundle the submitted committed head.
    if (await git('rev-parse', 'HEAD') !== run.head && !(run.integrated && run.tree && await candidateTree(run.cwd, undefined, machineEnv(env)) === run.tree)) throw new Error('dirty or changed worktree cannot be bundled for droplet: HEAD changed');
    const dirty = await git('status', '--porcelain=v1', '--untracked-files=all', '--', ...candidatePathspec);
    if (dirty) throw new Error(`dirty or changed worktree cannot be bundled for droplet: ${dirty.split('\n').join('; ')}`);
  };
  if (!committedOnly) await checkWorktree();
  const base = snapshotBase ? await git('merge-base', run.head, snapshotBase).catch(() => '') : '';
  // A candidate equal to the snapshot base has no incremental objects: send a full bundle.
  const ref = `refs/cland/suites/${run.id}`;
  try { await git('update-ref', ref, run.head, '0'.repeat(40)); }
  catch (error) {
    // A crash while bundling can leave the same run's ref behind.
    const existing = await git('show-ref', '--verify', '--hash', ref).catch(() => { throw error; });
    if (existing !== run.head) throw new Error(`suite ref ${ref} points at ${existing}; expected ${run.head}`);
  }
  try { await git('bundle', 'create', bundle, ref, ...(base && base !== run.head ? [`^${base}`] : [])); }
  finally { await git('update-ref', '-d', ref, run.head); }
  if (!committedOnly) await checkWorktree();
}

/** Suite delivery and observation; lifecycle and provider accounting stay in DropletExecutor. */
export class DropletRun {
  readonly #holds = new Map<string, { run: string; error: string }>();
  readonly #logger: LogFn;
  readonly #root: string;
  readonly #machine: MachineTransport;
  readonly #clock: Clock;
  readonly #dependencies: DropletDependencies;
  readonly #env: NodeJS.ProcessEnv;
  constructor(root: string, env: NodeJS.ProcessEnv = process.env, dependencies: DropletDependencies = {}, logger: LogFn = () => {}) { this.#logger = logger; this.#dependencies = dependencies; this.#clock = dependencies.clock ?? realClock; this.#root = root; this.#env = env; this.#machine = dependencies.machine ?? new Machine(root, env); }
  async #step<T>(name: string, work: () => Promise<T>): Promise<T> {
    try { return await work(); }
    catch (error) { throw new Error(`delivery ${name}: ${error instanceof Error ? error.message : 'machine request failed'}`, { cause: error }); }
  }
  async #upload(lease: DropletLease, run: RunRef, local: string, remote: string, name: string, deadline: number): Promise<void> {
    const bytes = (await stat(local)).size;
    const allowance = Math.max(120000, 30000 + Math.ceil(bytes * 1000 / 32768));
    const attempts: string[] = [];
    let failure = 'delivery deadline reached';
    let copyFailure: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = this.#clock.now().getTime();
      const timeoutMs = Math.min(allowance, deadline - started);
      if (timeoutMs <= 0) break;
      let succeeded = false;
      try {
        // put settles its native copy before rejecting; overwrite the same
        // private file only after that writer has closed, never race a copy.
        await this.#machine.put(lease, local, remote, { timeoutMs });
        succeeded = true;
      } catch (error) { copyFailure = error; failure = error instanceof Error ? error.message : 'machine request failed'; }
      const elapsed = this.#clock.now().getTime() - started;
      attempts.push(`${attempt}=${elapsed} ms`);
      try {
        await appendFile(run.log, `delivery upload ${name} attempt ${attempt}: ${succeeded ? 'succeeded' : 'failed'}; elapsed ${elapsed} ms; timeout ${timeoutMs} ms\n${succeeded ? '' : `${failure}\n`}`);
      } catch (error) {
        if (succeeded) throw error;
        const diagnosticFailure = (error instanceof Error ? error.message : 'diagnostic write failed').slice(0, 1024);
        throw Object.assign(new Error(`delivery upload ${name} attempt ${attempt}: ${failure}; diagnostic persistence failed: ${diagnosticFailure}`, { cause: copyFailure }), { diagnosticFailure });
      }
      if (succeeded) return;
    }
    const message = `delivery upload ${name}: ${attempts.length} attempts failed (${attempts.join(', ')}); ${failure}${this.#clock.now().getTime() >= deadline ? '; delivery deadline reached' : ''}`;
    if (attempts.length === 2 && copyFailure instanceof MachineRequestError && !copyFailure.localClientUnavailable) throw new DeliveryTransportError(message, 2, copyFailure);
    throw new Error(message, { cause: copyFailure });
  }
  async #directory(lease: DropletLease, dir: string, run: RunRef, deadline: number): Promise<void> {
    const limit = Math.min(deadline, this.#clock.now().getTime() + 30000);
    const observed = this.#clock.now().getTime();
    if (observed >= limit) {
      const phase = limit === Date.parse(lease.deadline) ? 'delivery-lease-expiry'
        : limit === deadline ? 'delivery-budget-expiry' : 'delivery-directory-readiness';
      throw new ReadinessDeadlineError(phase, limit, observed);
    }
    let attempt = 0;
    for (;;) {
      const started = this.#clock.now().getTime();
      const timeoutMs = Math.min(10000, limit - started);
      let failure: unknown;
      try {
        await this.#machine.exec(lease, `mkdir -p ${dir}`, { timeoutMs });
      } catch (error) { failure = error; }
      await appendFile(run.log, `delivery directory readiness attempt ${++attempt}: ${failure ? 'failed' : 'succeeded'}; elapsed ${this.#clock.now().getTime() - started} ms; timeout ${timeoutMs} ms\n`);
      if (!failure) return;
      // Only idempotent setup is replayed after an ambiguous SSH failure.
      if (this.#clock.now().getTime() >= limit) throw failure;
      const delay = Math.min(2000, limit - this.#clock.now().getTime());
      await (this.#dependencies.wait?.(delay) ?? pause(delay, this.#clock));
      if (this.#clock.now().getTime() >= limit) throw failure;
    }
  }
  async deliver(lease: DropletLease, run: RunRef, committedOnly = false): Promise<void> {
    const deadline = Math.min(Date.parse(lease.deadline), this.#clock.now().getTime() + 600000);
    const snapshot = lease.snapshot ?? await readSnapshot(this.#root);
    if (!snapshot) throw new Error('prepared snapshot disappeared');
    const local = dirname(run.result);
    const bundle = join(local, 'tree.bundle');
    const buildBundle = this.#dependencies.runBundle ?? runBundle;
    await buildBundle(run, bundle, snapshot.key.base, committedOnly, this.#env);
    const dir = remoteDir(lease);
    await this.#step('directory readiness', () => this.#directory(lease, dir, run, deadline));
    const transport = selectionTransport(run.selection, join(local, 'selection.json'));
    if (transport.file) await writeFile(join(local, 'selection.json'), transport.file, { mode: 0o600 });
    const selectionEnv = transport.file ? `unset CLAND_SUITE_SELECTION\nexport CLAND_SUITE_SELECTION_FILE=${dir}/selection.json` : `unset CLAND_SUITE_SELECTION_FILE\nexport CLAND_SUITE_SELECTION=${quote(transport.env.CLAND_SUITE_SELECTION!)}`;
    const env = `${run.limits ? `export CLAND_SUITE_LIMITS=${quote(JSON.stringify(run.limits))}\nexport CLAND_SUITE_LIMITS_CWD="$(pwd -P)"\n` : ''}export CLAND_SUITE_EXECUTOR=droplet\n${run.workers === undefined ? '' : `export CLAND_SUITE_WORKERS=${run.workers}\n`}${selectionEnv}\n${run.commands?.plan ? 'export CLAND_COVERAGE_APPEND=1\n' : 'unset CLAND_COVERAGE_APPEND\n'}export FORCE_COLOR=0\nexport NO_COLOR=1\n${run.selection?.recordCoverage ? `export CLAND_COVERAGE_OUTPUT=${dir}/coverage-map.json\n` : ''}`;
    await writeFile(join(local, 'env'), env, { mode: 0o600 });
    const lines = recordedCommands(run);
    let released = false;
    const commands = (!lines.check ? ["echo 'check: not set'"] : []).concat(verificationSteps(lines).map(step => {
      const { name, command: line } = step;
      const commandId = randomUUID();
      const timingEnv = `export CLAND_TIMING_OUTPUT=${dir}/timing-receipts.json\nexport CLAND_TIMING_OWNER=${quote(JSON.stringify({ run: run.id, head: run.head, tree: run.tree ?? '', command: line, step: name }))}\n`;
      const recordTier = `node -e ${quote(tierReceiptWriterProgram(run, step, run.tierReceipts))} ${dir}/tier-receipts.json "$suite_command_exit" || echo 'tier receipt unavailable'`;
      const command = `echo ${quote(`$ ${line}`)}\nprintf '%s\\n' ${quote(`suite command start ${JSON.stringify({ id: commandId, name, line })}`)}\nsuite_command_exit=0\n${timingEnv}/bin/sh -c ${quote(verificationStepCommand(step))} || suite_command_exit=$?\n${recordTier}\nprintf '\\nsuite command end ${commandId} %s\\n' "$suite_command_exit"\nif test "$suite_command_exit" -ne 0; then exit "$suite_command_exit"; fi`;
      if (name !== 'check') {
        const release = released ? '' : 'rmdir /tmp/cland-suite.lock; trap - EXIT\n';
        released = true;
        return `${release}${command}`;
      }
      const gate = run.hostGate;
      const fallback = `echo 'typecheck: droplet'\n${command}`;
      if (!gate?.tree || gate.code !== 0 || gate.command !== line) return fallback;
      // Match candidateTree's exclusions using a private index, without trusting the
      // submitted hash or changing the checkout's index. An unreadable tree checks again.
      const tree = `checked_tree=$(
status=$(git status --porcelain=v1 --untracked-files=all -- ${candidatePathspec.map(quote).join(' ')}) || exit 1
test -z "$status" || exit 1
index_dir=$(mktemp -d) || exit 1
trap 'rm -rf "$index_dir"' EXIT
export GIT_INDEX_FILE="$index_dir/index"
git read-tree HEAD || exit 1
git rm --quiet -r --cached --ignore-unmatch -- ${excludedPaths.map(quote).join(' ')} || exit 1
git write-tree
)`;
      return `if ${tree} && test "$checked_tree" = ${quote(gate.tree)}; then\necho ${quote(`typecheck: host gate at ${gate.tree} (not repeated)`)}\nsuite_command_exit=0\n${recordTier}\nelse\n${fallback}\nfi`;
    })).join('\n');
    // The typecheck owns the machine compatibility lock; the package runner then
    // takes its own compatibility leases, including cross-package smoke phases.
    const config = run.config ?? await readFile(join(this.#root, '.cland/config.toml'), 'utf8').then(text => parseConfig(text, basename(this.#root), this.#env), error => { if (error.code === 'ENOENT') return defaultConfig(basename(this.#root)); throw error; });
    const script = (await readFile(fileURLToPath(new URL('./run.sh', import.meta.url)), 'utf8'))
      .replace('@RUN_ID@', lease.run).replace('@COMMANDS@', commands)
      .replace('@RUN_TIMEOUT@', String(testTiming('CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS', config.verification.runTimeoutMs, this.#env) / 1000));
    await writeFile(join(local, 'run.sh'), script, { mode: 0o600 });
    for (const file of ['health.ts', 'metrics.ts', 'temp.sh']) await writeFile(join(local, file), await readFile(fileURLToPath(new URL(`./${file}`, import.meta.url))));
    const upload = (file: string, name = file) => this.#upload(lease, run, join(local, file), `runs/${lease.run}/${file}`, name, deadline);
    for (const file of ['tree.bundle', 'env', 'run.sh', 'health.ts', 'metrics.ts', 'temp.sh', ...(transport.file ? ['selection.json'] : [])]) await upload(file);
    const prepare = lines.prepare ? `CLAND_PREPARE_KEY=${quote(JSON.stringify(snapshot.key))} /bin/sh -c ${quote(lines.prepare)} 2>&1 || { prepare_exit=$?; echo "prepare failed (exit $prepare_exit)"; exit "$prepare_exit"; }` : "echo 'prepare: not set'";
    const timeout = () => {
      const remaining = Math.min(deadline, Date.parse(lease.deadline) - testTiming('CLAND_TEST_EXECUTOR_COLLECTION_MARGIN_MS', 120000, this.#env)) - this.#clock.now().getTime();
      if (remaining <= 0) throw new Error('delivery deadline reached');
      return remaining;
    };
    const fetch = () => this.#step('fetch', () => this.#machine.result(lease, `set -e\ncd "$HOME/cland"\ngit fetch ${dir}/tree.bundle ${quote(run.head)}`, timeout()));
    let fetched = await fetch();
    let output = fetched.stdout + fetched.stderr;
    // Acquire and deliver can straddle snapshot publication. The new bundle base
    // may be absent from the already booted image; retry only the fetch, once.
    if (fetched.code !== 0 && /Repository lacks these prerequisite commits/.test(output)) {
      output += '\nSnapshot base unavailable on machine; retrying with a full bundle.\n';
      await buildBundle(run, bundle, undefined, committedOnly, this.#env);
      await upload('tree.bundle', 'full tree.bundle');
      fetched = await fetch();
      output += fetched.stdout + fetched.stderr;
    }
    if (fetched.code !== 0) {
      await writeFile(join(local, 'delivery.log'), output);
      await appendFile(run.log, output);
      throw new Error(`delivery fetch failed (exit ${fetched.code}): ${output.trim()}`);
    }
    const command = `set -e\ncd "$HOME/cland"\ngit checkout --detach ${quote(run.head)}\ngit clean -fdx -e node_modules -e .cache\ntest "$(git rev-parse HEAD)" = ${quote(run.head)}\ntest -z "$(git status --porcelain)"\n${prepare}\ntest "$(git rev-parse HEAD)" = ${quote(run.head)}\nprepare_dirty=$(git status --porcelain --untracked-files=all)\nif test -n "$prepare_dirty"; then echo "prepare left the checkout dirty: $prepare_dirty"; exit 1; fi`;
    const result = await this.#step('checkout/prepare', () => this.#machine.result(lease, command, timeout()));
    output += result.stdout + result.stderr;
    await writeFile(join(local, 'delivery.log'), output);
    if (result.code !== 0) {
      await appendFile(run.log, output);
      throw new Error(`delivery checkout/prepare failed (exit ${result.code}): ${output.trim()}`);
    }
    await upload('delivery.log');
    // Root SSH is already owned by the lease. Failure is a recorded disk fallback,
    // never a dependency on passwordless sudo or a changed prepared image.
    await this.#machine.exec(lease, `bash /home/runner/runs/${lease.run}/temp.sh`, { user: 'root', timeoutMs: Math.min(8000, timeout()) }).catch(() => {});
    timeout();
    // Persist the local prefix with delivery itself. A hub crash before its job
    // checkpoint must not count these diagnostics as collected remote bytes.
    lease.execution = { head: run.head, delivered: true, deliveryLogEnd: (await stat(run.log)).size };
    await writeLease(this.#root, lease, this.#logger);
  }
  async start(lease: DropletLease): Promise<void> {
    if (!lease.execution?.delivered) throw new Error('remote run is not delivered');
    const dir = remoteDir(lease);
    // The detached script owns atomic admission. An SSH reply is only an observation.
    try { await this.#machine.exec(lease, `setsid nohup bash ${dir}/run.sh </dev/null >${dir}/out 2>&1 &`, { timeoutMs: 10000 }); }
    catch { /* it may have executed: reconcile status rather than fail/release */ }
    const status = await this.status(lease);
    if (status.state === 'lost') throw new Error(status.cause ?? 'remote machine lost');
    if (status.state === 'running' || status.state === 'done') {
      lease.execution.started = true; lease.execution.startedAt ??= this.#clock.now().toISOString();
      await writeLease(this.#root, lease, this.#logger);
    }
  }
  /** End diagnostic ownership after observed recovery or lifecycle settlement. */
  endObservation(lease: DropletLease, state: string): void {
    const held = this.#holds.get(lease.lease);
    if (!held) return;
    this.#holds.delete(lease.lease);
    this.#logger({ event: 'executor-local-ssh-hold-leave', ...held, cause: 'local SSH client unavailable', state });
  }
  async status(lease: DropletLease): Promise<RunStatus> {
    const status = await this.#status(lease);
    if (status.state !== 'unknown') this.endObservation(lease, status.state);
    return status;
  }
  async #status(lease: DropletLease): Promise<RunStatus> {
    if (Date.parse(lease.deadline) <= this.#clock.now().getTime()) return { state: 'lost', code: 1, cause: 'remote machine lifetime expired' };
    try {
      if (lease.resource === null) return { state: 'lost', code: 1, cause: 'remote machine lost' };
      await (this.#dependencies.api ?? new DigitalOceanApi(this.#env, this.#clock)).droplet(lease.resource);
    } catch (error) { if (error instanceof DigitalOceanError && error.status === 404) return { state: 'lost', code: 1, cause: 'remote machine lost' }; }
    try {
      const program = runStatusProgram();
      const status = JSON.parse(await this.#machine.exec(lease, `node -e ${quote(program)} ${remoteDir(lease)}`, { timeoutMs: 10000, maxOutputBytes: 17 * 1024 * 1024 })) as RunStatus;
      if (lease.execution?.unreachableSince) { delete lease.execution.unreachableSince; await writeLease(this.#root, lease, this.#logger); }
      return status;
    } catch (statusError) {
      try {
        if (lease.resource === null) return { state: 'lost', code: 1, cause: 'remote machine lost' };
        const droplet = await (this.#dependencies.api ?? new DigitalOceanApi(this.#env, this.#clock)).droplet(lease.resource);
        if (droplet.status === 'active' && statusError instanceof MachineRequestError && statusError.localClientUnavailable) {
          // Local observation was unavailable: do not age a remote-loss claim.
          // Clear an older network outage too, so recovery gets a fresh bound.
          if (lease.execution?.unreachableSince) {
            delete lease.execution.unreachableSince;
            await writeLease(this.#root, lease, this.#logger);
          }
          if (!this.#holds.has(lease.lease)) {
            const held = { run: lease.run, error: statusError.message };
            this.#holds.set(lease.lease, held);
            this.#logger({ event: 'executor-local-ssh-hold-enter', ...held, cause: 'local SSH client unavailable' });
          }
          return { state: 'unknown', cause: 'local SSH client unavailable' };
        }
        if (droplet.status === 'active' && !(statusError instanceof MachineRequestError && statusError.localClientUnavailable)) this.endObservation(lease, 'unknown');
        if (droplet.status === 'active' && lease.execution) {
          lease.execution.unreachableSince ??= this.#clock.now().toISOString();
          await writeLease(this.#root, lease, this.#logger);
          if (this.#clock.now().getTime() - Date.parse(lease.execution.unreachableSince) >= testTiming('CLAND_TEST_DROPLET_LOST_MS', 300000, this.#env)) return { state: 'lost', code: 1, cause: 'remote machine lost' };
        }
      } catch (error) { if (error instanceof DigitalOceanError && error.status === 404) return { state: 'lost', code: 1, cause: 'remote machine lost' }; }
      return { state: 'unknown' };
    }
  }
  async log(lease: DropletLease, offset: number): Promise<{ text: string; next: number; bytes: Uint8Array }> {
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('invalid log offset');
    const text = await this.#machine.exec(lease, `if test -f ${remoteDir(lease)}/suite.log; then tail -c +${offset + 1} ${remoteDir(lease)}/suite.log | head -c 262144 | base64; fi`, { timeoutMs: 10000 });
    const bytes = Buffer.from(text.replaceAll(/\s/g, ''), 'base64');
    return { text: bytes.toString('utf8'), bytes, next: offset + bytes.length };
  }
  async cancel(lease: DropletLease): Promise<void> {
    const dir = remoteDir(lease);
    try {
      await this.#machine.exec(lease, `if test -f ${dir}/pgid && ! test -f ${dir}/done; then pgid=$(cat ${dir}/pgid); case "$pgid" in ''|*[!0-9]*) exit 1;; esac; kill -TERM -- -"$pgid" 2>/dev/null || true; fi`, { timeoutMs: 10000 });
      const limit = this.#clock.now().getTime() + testTiming('CLAND_TEST_DROPLET_CANCEL_MS', 10000, this.#env);
      do { if ((await this.status(lease)).state === 'done') break; await (this.#dependencies.wait?.(100) ?? pause(100, this.#clock)); } while (this.#clock.now().getTime() < limit);
    } catch { /* release destroys the machine even when its group cannot be reached */ }
  }
  async collectCoverage(lease: DropletLease, path: string): Promise<void> {
    // An interrupted copy cannot become a durable, apparently complete map.
    try { await this.#machine.get(lease, `runs/${lease.run}/coverage-map.json`, `${path}.tmp`); }
    catch (error) {
      // Machine.get settles the native writer and bounds/redacts its stderr
      // before rejecting. Append before handing retry ownership to Suites:
      // job.error is transient and a later successful collection clears it.
      const failure = error instanceof Error ? error.message : 'machine request failed';
      // Keep local diagnostics separate: suite.log size owns remote replay offsets.
      try { await appendFile(coverageDownloadDiagnostic(path), `coverage download failed: ${failure}\n`, { mode: 0o600 }); }
      catch (diagnosticError) {
        const diagnosticFailure = (diagnosticError instanceof Error ? diagnosticError.message : 'diagnostic write failed').slice(0, 1024);
        throw Object.assign(new Error(`coverage download failed: ${failure}; diagnostic persistence failed: ${diagnosticFailure}`, { cause: error }), { diagnosticFailure });
      }
      throw error;
    }
    await rename(`${path}.tmp`, path);
  }
}
