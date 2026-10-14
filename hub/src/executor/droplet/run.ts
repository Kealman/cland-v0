import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { suiteCommands } from '../../hub/suite-worker.ts';
import type { RunRef, RunStatus } from '../executor.ts';
import { Machine, machineEnv, shellQuote as quote } from './machine.ts';
import { DigitalOceanApi, DigitalOceanError } from './api.ts';
import { readSnapshot } from './prepare.ts';
import { writeLease, type DropletLease } from './lease.ts';
import { pause, testTiming } from './watchdog.ts';

const exec = promisify(execFile);
const remoteDir = (lease: DropletLease): string => {
  if (!/^[a-zA-Z0-9-]+$/.test(lease.run)) throw new Error('invalid remote run id');
  return `"$HOME/runs/${lease.run}"`;
};

/** Suite delivery and observation; lifecycle and provider accounting stay in DropletExecutor. */
export class DropletRun {
  readonly #root: string;
  readonly #machine: Machine;
  constructor(root: string) { this.#root = root; this.#machine = new Machine(root); }
  async deliver(lease: DropletLease, run: RunRef): Promise<void> {
    const git = async (...args: string[]) => (await exec('git', args, { cwd: run.cwd, env: machineEnv(), timeout: 30000, maxBuffer: 16 * 1024 * 1024 })).stdout.trim();
    if (await git('rev-parse', 'HEAD') !== run.head || await git('status', '--porcelain')) throw new Error('dirty or changed worktree cannot be bundled for droplet');
    const snapshot = await readSnapshot(this.#root);
    if (!snapshot) throw new Error('prepared snapshot disappeared');
    const base = await git('merge-base', run.head, snapshot.key.base).catch(() => '');
    const local = dirname(run.result);
    const bundle = join(local, 'tree.bundle');
    // A candidate equal to the snapshot base has no incremental objects: send a full bundle.
    const ref = `refs/cland/suites/${run.id}`;
    await git('update-ref', ref, run.head, '0'.repeat(40));
    try { await git('bundle', 'create', bundle, ref, ...(base && base !== run.head ? [`^${base}`] : [])); }
    finally { await git('update-ref', '-d', ref, run.head); }
    if (await git('rev-parse', 'HEAD') !== run.head || await git('status', '--porcelain')) throw new Error('dirty or changed worktree cannot be bundled for droplet');
    const dir = remoteDir(lease);
    await this.#machine.exec(lease, `mkdir -p ${dir}`, { timeoutMs: 10000 });
    const env = `export CLAND_SUITE_SELECTION=${quote(JSON.stringify(run.selection))}\nexport FORCE_COLOR=0\nexport NO_COLOR=1\n`;
    await writeFile(join(local, 'env'), env, { mode: 0o600 });
    const commands = suiteCommands(run).map((args, index) => `${index === 1 ? 'rmdir /tmp/cland-suite.lock; trap - EXIT\n' : ''}echo ${quote(`$ npm ${args.join(' ')}`)}\nnpm ${args.map(quote).join(' ')} || exit $?`).join('\n');
    // The typecheck owns the machine compatibility lock; the package runner then
    // takes its own compatibility leases, including cross-package smoke phases.
    const script = (await readFile(fileURLToPath(new URL('./run.sh', import.meta.url)), 'utf8'))
      .replace('@RUN_ID@', lease.run).replace('@COMMANDS@', commands)
      .replace('@DEADLINE@', String(Math.floor(Date.parse(lease.deadline) / 1000)));
    await writeFile(join(local, 'run.sh'), script, { mode: 0o600 });
    for (const file of ['tree.bundle', 'env', 'run.sh']) await this.#machine.put(lease, join(local, file), `runs/${lease.run}/${file}`);
    const lock = quote(snapshot.key.lock);
    const pin = quote(snapshot.key.nvim.tag);
    const command = `set -e\ncd "$HOME/cland"\ngit fetch ${dir}/tree.bundle ${quote(run.head)}\ngit checkout --detach ${quote(run.head)}\ngit clean -fdx -e node_modules -e .cache\ntest "$(git rev-parse HEAD)" = ${quote(run.head)}\ntest -z "$(git status --porcelain)"\nif test "$(sha256sum package-lock.json | cut -d ' ' -f 1)" != ${lock}; then echo 'dependencies changed: npm ci'; npm ci; else echo 'dependencies match snapshot'; fi\nif test "$(cat nvim/NVIM_VERSION 2>/dev/null || echo none)" != ${pin}; then echo 'Neovim pin changed: seed'; node nvim/bin/nvim-path.ts; else echo 'Neovim pin matches snapshot'; fi\ntest "$(git rev-parse HEAD)" = ${quote(run.head)}\ntest -z "$(git status --porcelain)"`;
    const output = await this.#machine.exec(lease, command, { timeoutMs: Math.max(1, Date.parse(lease.deadline) - Date.now() - 120000) });
    await writeFile(join(local, 'delivery.log'), output);
    await this.#machine.put(lease, join(local, 'delivery.log'), `runs/${lease.run}/delivery.log`);
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
      lease.execution.started = true;
      await writeLease(this.#root, lease);
    }
  }
  async status(lease: DropletLease): Promise<RunStatus> {
    if (Date.parse(lease.deadline) <= Date.now()) return { state: 'lost', code: 1, cause: 'remote machine lifetime expired' };
    try {
      if (lease.resource === null) return { state: 'lost', code: 1, cause: 'remote machine lost' };
      await new DigitalOceanApi().droplet(lease.resource);
    } catch (error) { if (error instanceof DigitalOceanError && error.status === 404) return { state: 'lost', code: 1, cause: 'remote machine lost' }; }
    try {
      const program = `const fs=require('fs'),p=process.argv[1];const platform=fs.existsSync(p+'/platform')?JSON.parse(fs.readFileSync(p+'/platform','utf8')):undefined;let status={state:'pending',platform};if(fs.existsSync(p+'/done'))status={state:'done',code:Number(fs.readFileSync(p+'/exit','utf8')),finished:fs.readFileSync(p+'/done','utf8').trim(),platform};else if(fs.existsSync(p+'/pgid')){let alive=true;try{process.kill(-Number(fs.readFileSync(p+'/pgid','utf8')),0)}catch{alive=false}status=alive?{state:'running',platform}:{state:'done',code:1,cause:'remote runner disappeared without a done marker',finished:new Date().toISOString(),platform};}console.log(JSON.stringify(status));`;
      const status = JSON.parse(await this.#machine.exec(lease, `node -e ${quote(program)} ${remoteDir(lease)}`, { timeoutMs: 10000 })) as RunStatus;
      if (lease.execution?.unreachableSince) { delete lease.execution.unreachableSince; await writeLease(this.#root, lease); }
      return status;
    } catch {
      try {
        if (lease.resource === null) return { state: 'lost', code: 1, cause: 'remote machine lost' };
        const droplet = await new DigitalOceanApi().droplet(lease.resource);
        if (droplet.status === 'active' && lease.execution) {
          lease.execution.unreachableSince ??= new Date().toISOString();
          await writeLease(this.#root, lease);
          if (Date.now() - Date.parse(lease.execution.unreachableSince) >= testTiming('CLAND_TEST_DROPLET_LOST_MS', 300000)) return { state: 'lost', code: 1, cause: 'remote machine lost' };
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
      const limit = Date.now() + testTiming('CLAND_TEST_DROPLET_CANCEL_MS', 10000);
      do { if ((await this.status(lease)).state === 'done') break; await pause(100); } while (Date.now() < limit);
    } catch { /* release destroys the machine even when its group cannot be reached */ }
  }
}
