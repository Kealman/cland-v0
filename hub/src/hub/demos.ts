import { VERIFY_OCCASIONS } from '../protocol.ts';
import { pinVerificationPlan } from '../verification-plan.ts';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { defaultConfig, parseConfig } from '../init/config.ts';
import { territoryGitAsync } from '../territory.ts';
import { DropletExecutor } from '../executor/droplet/droplet.ts';
import { leaseDir, readLeases, writeLease, type DropletLease } from '../executor/droplet/lease.ts';
import { Machine, shellQuote } from '../executor/droplet/machine.ts';
import { testTiming } from '../executor/droplet/watchdog.ts';
import type { Git } from '../tracker/verdict-git.ts';
import type { Tracker } from '../tracker/tracker.ts';
import { verificationCommands } from '../verification-commands.ts';

const hub = { id: 'hub', name: 'hub', role: null, human: true };

/** Demo ownership lives on the executor lease, sharing reservation, spend, watchdog and restart recovery. */
export class Demos {
  #queue: Promise<unknown> = Promise.resolve();
  readonly root: string;
  readonly tracker: Tracker;
  readonly executor: DropletExecutor;
  readonly #env: NodeJS.ProcessEnv;
  readonly #git: (args: string[]) => Promise<string>;
  readonly #alert: (lease: DropletLease, text: string) => void;
  constructor(root: string, tracker: Tracker, executor: DropletExecutor, env: NodeJS.ProcessEnv = process.env, alert: (lease: DropletLease, text: string) => void = () => {}, git?: Git) {
    this.root = root; this.tracker = tracker; this.executor = executor; this.#env = env; this.#alert = alert;
    this.#git = git ? async args => {
      const value = await git(args);
      if (value === null) throw new Error('demo commit is unavailable or outside dev');
      return value;
    } : args => territoryGitAsync(root, args, undefined, undefined, env);
  }
  #serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.#queue.then(work); this.#queue = next.catch(() => {}); return next;
  }
  #epic(raw: string) {
    const epic = this.tracker.view(raw);
    if (!this.tracker.isPlanContainer(epic.kind)) throw new Error('demo needs an epic');
    return epic;
  }
  async #leases(epic: string) { return (await readLeases(this.root)).filter(l => l.demo?.epic === epic).sort((a, b) => a.created.localeCompare(b.created) || a.lease.localeCompare(b.lease)); }
  #provisioning(lease: DropletLease) { return (lease.state === 'creating' || lease.state === 'active') && !lease.demo?.ready; }
  #value(lease: DropletLease) {
    const state = this.#provisioning(lease) ? 'provisioning' : lease.state;
    return { executor: 'droplet', epic: lease.demo!.epic, lease: lease.lease, commit: lease.demo!.commit, state, ...(lease.attention ? { attention: lease.attention } : {}),
      created: lease.created, deadline: lease.deadline, maxLifetimeMs: Date.parse(lease.deadline) - Date.parse(lease.created), lifetimeMs: lease.lifetimeMs ?? Math.max(0, this.executor.clock.now().getTime() - Date.parse(lease.created)),
      costUsd: lease.costUsd ?? Math.max(60000, this.executor.clock.now().getTime() - Date.parse(lease.created)) / 3600000 * lease.priceHourly,
      summary: `demo ${lease.demo!.epic}: ${lease.lease} commit ${lease.demo!.commit} ${state}; deadline ${lease.deadline}; lifetime ${Math.round((lease.lifetimeMs ?? this.executor.clock.now().getTime() - Date.parse(lease.created)) / 1000)} s; cost $${(lease.costUsd ?? Math.max(60000, this.executor.clock.now().getTime() - Date.parse(lease.created)) / 3600000 * lease.priceHourly).toFixed(4)}${lease.attention ? `; operator attention: ${lease.attention.reason === 'deletion-timeout' ? 'deletion confirmation timed out' : `identity mismatch (${lease.attention.fields.join(', ')})`}, provider status ${lease.attention.observed.status}` : ''}` };
  }
  async #comment(lease: DropletLease, text: string) {
    if (!this.tracker.view(lease.demo!.epic).comments.some(c => c.author === 'hub' && c.text === text)) await this.tracker.comment(hub, lease.demo!.epic, text);
  }
  async #report(lease: DropletLease) {
    if (lease.resource !== null) await this.#comment(lease, `demo ${lease.lease} created: droplet ${lease.name}, commit ${lease.demo!.commit}, deadline ${lease.deadline}.`);
    if (lease.state === 'released') await this.#comment(lease, `demo ${lease.lease} destroyed: lifetime ${lease.lifetimeMs ?? 0} ms; cost $${(lease.costUsd ?? 0).toFixed(4)}.`);
    if (lease.attention) {
      const text = `demo ${lease.demo!.epic} lease ${lease.lease} droplet ${lease.resource}: operator attention required; ${lease.attention.reason === 'deletion-timeout' ? 'deletion confirmation timed out; accepted DELETE remains unconfirmed' : 'identity mismatch; deletion refused'}. ${JSON.stringify(lease.attention)}`;
      await this.#comment(lease, text);
      this.#alert(lease, text);
    }
  }
  start(raw: string, commit?: string, authorize = () => {}) {
    return this.#serial(async () => {
      authorize();
      const epic = this.#epic(raw);
      if (epic.state !== 'open') throw new Error('demo needs an open epic');
      if ((await this.#leases(epic.id)).some(l => l.state !== 'released')) throw new Error('epic already has a demo lease');
      if (commit !== undefined && !/^[a-f0-9]{4,64}$/i.test(commit)) throw new Error('demo commit must be a Git SHA');
      const head = (await this.#git(['rev-parse', '--verify', `${commit ?? 'dev'}^{commit}`])).trim();
      await this.#git(['merge-base', '--is-ancestor', head, 'dev']);
      const config = this.executor.projectConfig?.() ?? await readFile(join(this.root, '.cland/config.toml'), 'utf8').then(s => parseConfig(s, basename(this.root), this.#env), e => { if (e.code === 'ENOENT') return defaultConfig(basename(this.root)); throw e; });
      const commands = pinVerificationPlan(await verificationCommands(this.root, this.root, this.#env), { branch: 'dev', mode: 'all', occasion: VERIFY_OCCASIONS.epic });
      const id = `demo-${randomUUID()}`;
      authorize();
      const lease = await this.executor.acquire({ id }, new Date(this.executor.clock.now().getTime() + testTiming('CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS', config.verification.runTimeoutMs, this.#env)).toISOString(), { epic: epic.id, commit: head, commands }, config);
      try {
        authorize();
        const dir = leaseDir(this.root, lease);
        await this.executor.deliver(lease, { id, config, commands, cwd: this.root, head, mode: 'auto', log: join(dir, 'log'), result: join(dir, 'result'), gate: join(dir, 'gate') }, true);
        authorize();
        if (Date.parse(lease.deadline) <= this.executor.clock.now().getTime()) throw new Error('demo deadline reached during delivery');
        lease.demo!.ready = true; await writeLease(this.root, lease);
        await this.#report(lease);
        return this.#value(lease);
      } catch (error) { await this.executor.release(lease); await this.#report(lease); throw error; }
    });
  }
  async exec(raw: string, command: string[], authorize = () => {}) {
    authorize();
    const epic = this.#epic(raw);
    const leases = await this.#leases(epic.id);
    const lease = leases.find(l => l.state === 'active' && l.demo?.ready && Date.parse(l.deadline) > this.executor.clock.now().getTime());
    if (!lease) {
      const provisioning = leases.find(l => this.#provisioning(l));
      if (provisioning) throw new Error(`demo ${epic.id}: lease ${provisioning.lease} commit ${provisioning.demo!.commit} is provisioning; wait for demo start to complete`);
      throw new Error('no active demo lease; start a demo or run locally at the same commit');
    }
    authorize();
    const remaining = Date.parse(lease.deadline) - this.executor.clock.now().getTime();
    const cmd = command.map(shellQuote).join(' ');
    return (this.executor.dependencies.machine ?? new Machine(this.root, this.#env)).result(lease, `cd "$HOME/cland" && export PATH="$PWD/hub/bin:$PATH" && ${cmd}`, remaining);
  }
  stop(raw: string, authorize = () => {}) {
    return this.#serial(async () => {
      authorize(); const epic = this.#epic(raw);
      const lease = (await this.#leases(epic.id)).at(-1);
      if (!lease) throw new Error('no demo lease');
      authorize(); await this.executor.release(lease); await this.#report(lease);
      return this.#value(lease);
    });
  }
  async status(raw: string, commit?: string) {
    const epic = this.#epic(raw);
    const lease = (await this.#leases(epic.id)).at(-1);
    if (commit !== undefined && !/^[a-f0-9]{4,64}$/i.test(commit)) throw new Error('demo commit must be a Git SHA');
    const freshness = commit ? await this.tracker.demoFreshness(epic.id, commit) : undefined;
    return lease ? { ...this.#value(lease), ...(freshness ? { freshness } : {}) } : { ...(freshness ? { freshness } : {}), epic: epic.id, state: 'none', summary: `demo ${epic.id}: none` };
  }
  async close() { await this.#queue; }
  reconcile() {
    return this.#serial(async () => {
      for (const lease of await readLeases(this.root)) if (lease.demo) {
        const epic = this.tracker.view(lease.demo.epic);
        const verdict = epic.verdicts.some(v => v.source === 'hub' && v.verdict === 'qa' && v.stage === undefined && Date.parse(v.at) >= Date.parse(lease.created));
        if (lease.state !== 'released' && (verdict || epic.state === 'closed' || Date.parse(lease.deadline) <= this.executor.clock.now().getTime())) await this.executor.release(lease);
        await this.#report(lease);
      }
    });
  }
}
