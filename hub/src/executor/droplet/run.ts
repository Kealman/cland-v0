import { realClock, type Clock } from '../../hub/clock.ts';
import type { DropletDependencies, MachineTransport } from './dependencies.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { parseConfig, defaultConfig } from '../../init/config.ts';
import { basename } from 'node:path';
import { suiteCheckCommand } from '../../suite-check.ts';
import { suiteCommands } from '../../hub/suite-worker.ts';
import type { RunRef, RunStatus } from '../executor.ts';
import { Machine, machineEnv, shellQuote as quote } from './machine.ts';
import { DigitalOceanApi, DigitalOceanError } from './api.ts';
import { readSnapshot } from './prepare.ts';
import { writeLease, type DropletLease } from './lease.ts';
import { pause, testTiming } from './watchdog.ts';
import { candidatePathspec, candidateTree } from '../../verification-tree.ts';

const exec = promisify(execFile);
const remoteDir = (lease: DropletLease): string => {
  if (!/^[a-zA-Z0-9-]+$/.test(lease.run)) throw new Error('invalid remote run id');
  return `"$HOME/runs/${lease.run}"`;
};

/** Suite delivery and observation; lifecycle and provider accounting stay in DropletExecutor. */
export class DropletRun {
  readonly #root: string;
  readonly #machine: MachineTransport;
  readonly #clock: Clock;
  readonly #dependencies: DropletDependencies;
  readonly #env: NodeJS.ProcessEnv;
  constructor(root: string, env: NodeJS.ProcessEnv = process.env, dependencies: DropletDependencies = {}) { this.#dependencies = dependencies; this.#clock = dependencies.clock ?? realClock; this.#root = root; this.#env = env; this.#machine = dependencies.machine ?? new Machine(root, env); }
  async deliver(lease: DropletLease, run: RunRef, committedOnly = false): Promise<void> {
    const git = async (...args: string[]) => (await exec('git', args, { cwd: run.cwd, env: machineEnv(this.#env), timeout: 30000, maxBuffer: 16 * 1024 * 1024 })).stdout.trim();
    const checkWorktree = async () => {
      // Administrative writes may race delivery; bundle the submitted committed head.
      if (await git('rev-parse', 'HEAD') !== run.head && !(run.integrated && run.tree && await candidateTree(run.cwd, undefined, machineEnv(this.#env)) === run.tree)) throw new Error('dirty or changed worktree cannot be bundled for droplet: HEAD changed');
      const dirty = await git('status', '--porcelain=v1', '--untracked-files=all', '--', ...candidatePathspec);
      if (dirty) throw new Error(`dirty or changed worktree cannot be bundled for droplet: ${dirty.split('\n').join('; ')}`);
    };
    if (!committedOnly) await checkWorktree();
    const snapshot = await readSnapshot(this.#root);
    if (!snapshot) throw new Error('prepared snapshot disappeared');
    const base = await git('merge-base', run.head, snapshot.key.base).catch(() => '');
    const local = dirname(run.result);
    const bundle = join(local, 'tree.bundle');
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
    const dir = remoteDir(lease);
    await this.#machine.exec(lease, `mkdir -p ${dir}`, { timeoutMs: 10000 });
    const env = `${run.limits ? `export CLAND_SUITE_LIMITS=${quote(JSON.stringify(run.limits))}\nexport CLAND_SUITE_LIMITS_CWD="$(pwd -P)"\n` : ''}export CLAND_SUITE_EXECUTOR=droplet\n${run.workers === undefined ? '' : `export CLAND_SUITE_WORKERS=${run.workers}\n`}export CLAND_SUITE_SELECTION=${quote(JSON.stringify(run.selection ?? null))}\nexport FORCE_COLOR=0\nexport NO_COLOR=1\n${run.selection?.recordCoverage ? `export CLAND_COVERAGE_OUTPUT=${dir}/coverage-map.json\n` : ''}`;
    await writeFile(join(local, 'env'), env, { mode: 0o600 });
    const commands = suiteCommands(run, await suiteCheckCommand(run.cwd)).map((args, index) => {
      const command = `echo ${quote(`$ npm ${args.join(' ')}`)}\nnpm ${args.map(quote).join(' ')} || exit $?`;
      if (index !== 0) return `${index === 1 ? 'rmdir /tmp/cland-suite.lock; trap - EXIT\n' : ''}${command}`;
      const gate = run.hostGate;
      const fallback = `echo 'typecheck: droplet'\n${command}`;
      if (!gate?.tree || gate.code !== 0 || JSON.stringify(gate.command) !== JSON.stringify(args)) return fallback;
      // Match candidateTree's exclusions using a private index, without trusting the
      // submitted hash or changing the checkout's index. An unreadable tree checks again.
      const tree = `checked_tree=$(
status=$(git status --porcelain=v1 --untracked-files=all -- ${candidatePathspec.map(quote).join(' ')}) || exit 1
test -z "$status" || exit 1
index_dir=$(mktemp -d) || exit 1
trap 'rm -rf "$index_dir"' EXIT
export GIT_INDEX_FILE="$index_dir/index"
git read-tree HEAD || exit 1
git rm --quiet -r --cached --ignore-unmatch -- '.cland/tasks' '.cland/RULES.md' || exit 1
git write-tree
)`;
      return `if ${tree} && test "$checked_tree" = ${quote(gate.tree)}; then\necho ${quote(`typecheck: host gate at ${gate.tree} (not repeated)`)}\nelse\n${fallback}\nfi`;
    }).join('\n');
    // The typecheck owns the machine compatibility lock; the package runner then
    // takes its own compatibility leases, including cross-package smoke phases.
    const config = run.config ?? await readFile(join(this.#root, '.cland/config.toml'), 'utf8').then(text => parseConfig(text, basename(this.#root), this.#env), error => { if (error.code === 'ENOENT') return defaultConfig(basename(this.#root)); throw error; });
    const script = (await readFile(fileURLToPath(new URL('./run.sh', import.meta.url)), 'utf8'))
      .replace('@RUN_ID@', lease.run).replace('@COMMANDS@', commands)
      .replace('@RUN_TIMEOUT@', String(testTiming('CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS', config.verification.runTimeoutMs, this.#env) / 1000));
    await writeFile(join(local, 'run.sh'), script, { mode: 0o600 });
    for (const file of ['health.ts', 'temp.sh']) await writeFile(join(local, file), await readFile(fileURLToPath(new URL(`./${file}`, import.meta.url))));
    for (const file of ['tree.bundle', 'env', 'run.sh', 'health.ts', 'temp.sh']) await this.#machine.put(lease, join(local, file), `runs/${lease.run}/${file}`);
    const lock = quote(snapshot.key.lock);
    const pin = quote(snapshot.key.nvim.tag);
    const command = `set -e\ncd "$HOME/cland"\ngit fetch ${dir}/tree.bundle ${quote(run.head)}\ngit checkout --detach ${quote(run.head)}\ngit clean -fdx -e node_modules -e .cache\ntest "$(git rev-parse HEAD)" = ${quote(run.head)}\ntest -z "$(git status --porcelain)"\nif test "$(sha256sum package-lock.json | cut -d ' ' -f 1)" != ${lock}; then echo 'dependencies changed: npm ci'; npm ci; else echo 'dependencies match snapshot'; fi\nif test "$(cat nvim/NVIM_VERSION 2>/dev/null || echo none)" != ${pin}; then echo 'Neovim pin changed: seed'; node nvim/bin/nvim-path.ts; else echo 'Neovim pin matches snapshot'; fi\ntest "$(git rev-parse HEAD)" = ${quote(run.head)}\ntest -z "$(git status --porcelain)"`;
    const output = await this.#machine.exec(lease, command, { timeoutMs: Math.max(1, Date.parse(lease.deadline) - this.#clock.now().getTime() - testTiming('CLAND_TEST_EXECUTOR_COLLECTION_MARGIN_MS', 120000, this.#env)) });
    await writeFile(join(local, 'delivery.log'), output);
    await this.#machine.put(lease, join(local, 'delivery.log'), `runs/${lease.run}/delivery.log`);
    // Root SSH is already owned by the lease. Failure is a recorded disk fallback,
    // never a dependency on passwordless sudo or a changed prepared image.
    await this.#machine.exec(lease, `bash /home/runner/runs/${lease.run}/temp.sh`, { user: 'root', timeoutMs: 8000 }).catch(() => {});
    lease.execution = { head: run.head, delivered: true };
    await writeLease(this.#root, lease);
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
      await writeLease(this.#root, lease);
    }
  }
  async status(lease: DropletLease): Promise<RunStatus> {
    if (Date.parse(lease.deadline) <= this.#clock.now().getTime()) return { state: 'lost', code: 1, cause: 'remote machine lifetime expired' };
    try {
      if (lease.resource === null) return { state: 'lost', code: 1, cause: 'remote machine lost' };
      await (this.#dependencies.api ?? new DigitalOceanApi(this.#env, this.#clock)).droplet(lease.resource);
    } catch (error) { if (error instanceof DigitalOceanError && error.status === 404) return { state: 'lost', code: 1, cause: 'remote machine lost' }; }
    try {
      const program = `const fs=require('fs'),p=process.argv[1];const platform=fs.existsSync(p+'/platform')?JSON.parse(fs.readFileSync(p+'/platform','utf8')):undefined;let status={state:'pending',platform};if(fs.existsSync(p+'/done')){const finished=fs.readFileSync(p+'/done','utf8').trim();status=finished?{state:'done',code:Number(fs.readFileSync(p+'/exit','utf8')),finished,platform}:{state:'running',platform};}else if(fs.existsSync(p+'/pgid')){let alive=true;try{process.kill(-Number(fs.readFileSync(p+'/pgid','utf8')),0)}catch{alive=false}status=alive?{state:'running',platform}:{state:'done',code:1,cause:'remote runner disappeared without a done marker',finished:new Date().toISOString(),platform};}console.log(JSON.stringify(status));`;
      const status = JSON.parse(await this.#machine.exec(lease, `node -e ${quote(program)} ${remoteDir(lease)}`, { timeoutMs: 10000 })) as RunStatus;
      if (lease.execution?.unreachableSince) { delete lease.execution.unreachableSince; await writeLease(this.#root, lease); }
      return status;
    } catch {
      try {
        if (lease.resource === null) return { state: 'lost', code: 1, cause: 'remote machine lost' };
        const droplet = await (this.#dependencies.api ?? new DigitalOceanApi(this.#env, this.#clock)).droplet(lease.resource);
        if (droplet.status === 'active' && lease.execution) {
          lease.execution.unreachableSince ??= this.#clock.now().toISOString();
          await writeLease(this.#root, lease);
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
    await this.#machine.get(lease, `runs/${lease.run}/coverage-map.json`, `${path}.tmp`);
    await rename(`${path}.tmp`, path);
  }
}
