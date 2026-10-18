// Idle accounts are read by their harness, never by a provider client in cland.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { AppServerClient, RpcError } from '../adapters/codex/app-server.ts';
import { accountEnvironment, readAccounts, selectAccount, type Account } from './registry.ts';
import { codexWindows, type AccountList, type AccountReading, type LimitWindow } from './limits.ts';
import { realClock, type Clock, type ClockTimer } from '../hub/clock.ts';
import type { HubCore } from '../hub/core.ts';
import type { Sessions } from '../adapters/sessions.ts';
import type { LogFn } from '../log.ts';

type Schedule = { at: number; failures: number };
/** External harness account read; component fixtures supply an in-process reader. */
export type AccountReader = (account: Account) => Promise<LimitWindow[]>;
const timing = (key: string, fallback: number, env: NodeJS.ProcessEnv): number => {
  const n = Number(env[`CLAND_TEST_ACCOUNT_POLL_${key}_MS`]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
class PollFailure extends Error {
  readonly signedOut: boolean;
  constructor(reason: string, signedOut = false) { super(reason); this.signedOut = signedOut; }
}
function claudeUsage(output: string): LimitWindow[] {
  for (const line of output.split('\n')) {
    let report: unknown;
    try { report = JSON.parse(line); } catch { continue; }
    if (!object(report) || !object(report.usage_report)) continue;
    report = report.usage_report;
    if (!object(report) || !object(report.rate_limits) || !Array.isArray(report.rate_limits.limits)) throw new PollFailure('unparsable answer');
    const windows: LimitWindow[] = [];
    for (const w of report.rate_limits.limits) {
      if (!object(w) || !['session', 'weekly_all', 'weekly_scoped'].includes(String(w.kind))) continue;
      const reset = typeof w.resets_at === 'string' ? Date.parse(w.resets_at) : NaN;
      if (typeof w.percent !== 'number' || !Number.isFinite(w.percent) || !Number.isFinite(reset)) throw new PollFailure('unparsable answer');
      const group = typeof w.group === 'string' ? w.group : typeof w.scope === 'string' ? w.scope : undefined;
      if (w.kind === 'weekly_scoped' && !group) throw new PollFailure('unparsable answer');
      windows.push({ id: `${w.kind}${w.kind === 'weekly_scoped' ? `:${group}` : ''}`, label: w.kind === 'session' ? '5h' : w.kind === 'weekly_all' ? 'wk' : `wk ${group}`,
        usedPercent: w.percent, resetsAt: new Date(reset).toISOString(), ...(typeof w.severity === 'string' ? { severity: w.severity } : {}),
        ...(w.kind === 'weekly_scoped' && group ? { scope: typeof w.scope === 'string' ? w.scope : group } : {}) });
    }
    if (report.rate_limits.limits.length && !windows.length) throw new PollFailure('unparsable answer');
    return windows;
  }
  throw new PollFailure('unparsable answer');
}

/** Durable floors, per-account single flight, and two harness processes across the hub. */
export class AccountPoller {
  readonly #clock: Clock;
  readonly #env: NodeJS.ProcessEnv;
  readonly #core: HubCore;
  readonly #sessions: Pick<Sessions, 'list' | 'readAccountLimits'>;
  readonly #root: string;
  readonly #log: LogFn;
  readonly #schedule = new Map<string, Schedule>();
  readonly #hitNames = new Set<string>();
  readonly #hits = new Map<string, { timer: ClockTimer | null; work: Promise<void>; finish: () => void }>();
  readonly #pending = new Map<string, Promise<void>>();
  readonly #queue: Array<() => void> = [];
  readonly #kills = new Set<() => void>();
  readonly #floor: number;
  readonly #minimum: number;
  readonly #bound: number;
  readonly #reader: AccountReader | undefined;
  #active = 0;
  #closed = false;
  #timer: ClockTimer | null = null;
  constructor(core: HubCore, sessions: Pick<Sessions, 'list' | 'readAccountLimits'>, root: string, log: LogFn, env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, reader?: AccountReader) {
    this.#reader = reader;
    this.#clock = clock;
    this.#env = env;
    this.#floor = timing('FLOOR', 15 * 60_000, env); this.#minimum = timing('MINIMUM', 5 * 60_000, env); this.#bound = timing('BOUND', 30_000, env);
    this.#core = core; this.#sessions = sessions; this.#root = root; this.#log = log;
    const saved = core.store.meta('account-polls');
    const hits = core.store.meta('account-hit-polls');
    if (hits) for (const name of JSON.parse(hits) as string[]) this.#hitNames.add(name);
    if (saved) for (const [name, state] of JSON.parse(saved) as Array<[string, Schedule]>) this.#schedule.set(name, state);
  }
  start(): void {
    if (this.#closed || this.#timer) return;
    for (const name of this.#hitNames) void this.poll(name);
    void this.#all(false).catch(() => {});
    this.#timer = this.#clock.setInterval(() => { void this.#all(false).catch(() => {}); }, Math.min(this.#floor, 60_000));
    this.#timer.unref();
  }
  async refresh(): Promise<AccountList> { await this.#all(true); return this.#core.accountLimits.list(await readAccounts(this.#env)); }
  /** One after-hit read waits for the minimum/backoff instead of losing a recent hit. */
  poll(name: string): Promise<void> {
    if (this.#closed) return Promise.resolve();
    const existing = this.#hits.get(name);
    if (existing) return existing.work;
    this.#hitNames.add(name);
    this.#saveHits();
    let resolve!: () => void;
    const work = new Promise<void>(done => { resolve = done; });
    const hit = { timer: null as ClockTimer | null, work, finish: () => {
      if (this.#hits.get(name) !== hit) return;
      this.#clock.clearTimeout(hit.timer ?? undefined);
      this.#hits.delete(name);
      // Close cancels local waits, but a restart must retain the outstanding hit.
      if (!this.#closed) { this.#hitNames.delete(name); this.#saveHits(); }
      resolve();
    } };
    this.#hits.set(name, hit);
    const attempt = () => {
      if (this.#closed || !this.#core.accountLimits.limited(name)) { hit.finish(); return; }
      const pending = this.#pending.get(name);
      if (pending) { void pending.then(attempt); return; }
      const delay = this.#wait(name, true);
      if (delay > 0) {
        hit.timer = this.#clock.setTimeout(attempt, Math.min(delay, 2 ** 31 - 1));
        hit.timer.unref();
        return;
      }
      void readAccounts(this.#env).then(registry => {
        if (this.#closed || !this.#core.accountLimits.limited(name)) { hit.finish(); return; }
        // Registry I/O can overlap a manual or timer poll; re-read eligibility before admission.
        if (this.#pending.has(name) || this.#wait(name, true) > 0) { attempt(); return; }
        const account = this.#core.accountLimits.list(registry).accounts.find(a => a.name === name);
        if (!account) { hit.finish(); return; }
        void this.#enqueue(account, true, true).then(hit.finish, hit.finish);
      }, hit.finish);
    };
    attempt();
    return work;
  }
  #saveHits(): void { this.#core.store.setMeta('account-hit-polls', JSON.stringify([...this.#hitNames])); }
  #wait(name: string, refresh: boolean): number {
    const state = this.#schedule.get(name);
    const floor = state?.failures ? this.#floor * 2 ** Math.min(state.failures, 2) : refresh ? this.#minimum : this.#floor;
    return state ? Math.max(0, state.at + floor - this.#clock.now().getTime()) : 0;
  }
  async #all(refresh: boolean): Promise<void> {
    if (this.#closed) return;
    const registry = await readAccounts(this.#env);
    await Promise.all(this.#core.accountLimits.list(registry).accounts.map(a => this.#enqueue(a, refresh, false)));
  }
  #idle(account: Account): boolean {
    return !this.#sessions.list().some(p => p.status === 'running' && p.harness === account.harness &&
      (p.account === account.name || !p.account && (account.name === `default:${p.harness}` || account.path === null)));
  }
  #enqueue(account: Account, refresh: boolean, hit: boolean): Promise<void> {
    if (this.#closed || !['claude-code', 'codex'].includes(account.harness) || !hit && !this.#idle(account)) return Promise.resolve();
    const pending = this.#pending.get(account.name);
    if (pending) return pending;
    const ready = () => this.#wait(account.name, refresh) === 0;
    if (!ready()) return Promise.resolve();
    const work = new Promise<void>(resolve => {
      const run = () => {
        if (this.#closed || !ready() || !hit && !this.#idle(account)) { resolve(); return; }
        this.#active++;
        void this.#run(account).finally(() => {
          this.#active--;
          resolve();
          this.#drain();
        });
      };
      if (this.#active < 2) run(); else this.#queue.push(run);
    }).finally(() => this.#pending.delete(account.name));
    this.#pending.set(account.name, work);
    return work;
  }
  #drain(): void { while (this.#active < 2 && this.#queue.length) this.#queue.shift()?.(); }
  #save(): void { this.#core.store.setMeta('account-polls', JSON.stringify([...this.#schedule])); }
  async #run(account: Account): Promise<void> {
    const at = this.#clock.now().getTime();
    const state = { at, failures: this.#schedule.get(account.name)?.failures ?? 0 };
    this.#schedule.set(account.name, state);
    this.#save(); // Persist the attempt before starting a process, including a hub crash.
    let ok = false;
    try {
      const windows = await (this.#reader ? this.#reader(account) : this.#read(account));
      if (!this.#closed) {
        state.failures = 0;
        await this.#core.publishAccountLimits({ account: account.name, harness: account.harness, windows, at: new Date(at).toISOString(), source: { kind: 'poll' } });
        ok = true;
      }
    } catch (error) {
      if (!this.#closed) {
        state.failures = Math.min(state.failures + 1, 2);
        const failure = error instanceof PollFailure ? error : new PollFailure('harness poll failed');
        if (failure.signedOut) await this.#core.publishAccountLimits({ account: account.name, harness: account.harness, windows: [], at: new Date(at).toISOString(), source: { kind: 'poll' }, signedOut: true } satisfies AccountReading);
        this.#log({ event: 'account-poll-failed', account: account.name, reason: failure.message });
      }
    } finally {
      if (!this.#closed) {
        state.at = this.#clock.now().getTime();
        this.#save();
        this.#log({ event: 'account-polled', account: account.name, harness: account.harness, ms: this.#clock.now().getTime() - at, ok });
      }
    }
  }
  async #read(account: Account): Promise<LimitWindow[]> {
    if (account.harness === 'codex') {
      const live = await this.#sessions.readAccountLimits(account.name);
      if (live !== null) return live;
    }
    const selection = await selectAccount(account, account.harness, this.#env);
    const env = accountEnvironment(this.#env, selection.accountEnv);
    for (const key of Object.keys(env)) if (key.startsWith('CLAND_') || ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN'].includes(key)) delete env[key];
    const base = join(this.#root, '.cland', 'run', 'accounts');
    await mkdir(base, { recursive: true });
    const cwd = await mkdtemp(join(base, 'poll-'));
    if (this.#closed) { await rm(cwd, { recursive: true, force: true }); throw new PollFailure('hub stopped'); }
    const claude = account.harness === 'claude-code';
    const child = spawn(claude ? this.#env.CLAND_CLAUDE_BIN ?? 'claude' : this.#env.CLAND_CODEX_BIN ?? 'codex', claude ? ['-p', '/usage', '--output-format', 'stream-json', '--verbose'] : ['app-server'], { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let client: AppServerClient | undefined;
    let timer: NodeJS.Timeout | undefined;
    let output = '';
    let bytes = 0;
    let rejectFailure!: (error: Error) => void;
    const failure = new Promise<never>((_, reject) => { rejectFailure = reject; });
    const kill = () => {
      if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ } }
      rejectFailure(new PollFailure(this.#closed ? 'hub stopped' : 'timeout'));
    };
    this.#kills.add(kill);
    timer = setTimeout(kill, this.#bound);
    const ended = new Promise<number | null>(resolve => {
      child.once('error', () => { rejectFailure(new PollFailure('harness could not start')); resolve(null); });
      child.once('close', code => { resolve(code); if (!claude) rejectFailure(new PollFailure('harness exited before its answer')); });
    });
    const capture = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) { rejectFailure(new PollFailure('answer too large')); return; }
      output += String(chunk);
    };
    if (claude) child.stdout.on('data', capture);
    else child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) rejectFailure(new PollFailure('answer too large')); });
    child.stderr.on('data', capture);
    try {
      return await Promise.race([failure, (async () => {
        if (claude) {
          child.stdin.end();
          const code = await ended;
          if (/not logged in|authentication required|please.*(?:log in|login)|oauth token.*expired/i.test(output)) throw new PollFailure('signed out', true);
          if (/\b429\b|rate[ -]limited/i.test(output)) throw new PollFailure('rate limited');
          if (code !== 0) throw new PollFailure('non-zero exit');
          return claudeUsage(output);
        }
        client = await AppServerClient.connectStdio(child.stdout, child.stdin, { client: { name: 'cland-account-poll', version: '1' }, timeoutMs: this.#bound });
        if (this.#closed) { client.close(); throw new PollFailure('hub stopped'); }
        let result: unknown;
        try { result = await client.request('account/rateLimits/read', { excludeResetCreditDetails: true }); }
        catch (error) {
          if (error instanceof RpcError && error.code === -32600 && /authentication required/i.test(error.message)) throw new PollFailure('signed out', true);
          if (error instanceof RpcError && (error.code === 429 || /\b429\b|rate[ -]limited/i.test(error.message))) throw new PollFailure('rate limited');
          throw new PollFailure('harness RPC failed');
        }
        if (/\b429\b|rate[ -]limited/i.test(output)) throw new PollFailure('rate limited');
        if (!object(result) || !object(result.rateLimits) && !object(result.rateLimitsByLimitId)) throw new PollFailure('unparsable answer');
        const windows = codexWindows(result.rateLimits, result.rateLimitsByLimitId);
        if (!windows.length) throw new PollFailure('unparsable answer');
        return windows;
      })()]);
    } catch (error) {
      if (error instanceof RpcError && error.code === -32600 && /authentication required/i.test(error.message)) throw new PollFailure('signed out', true);
      if (error instanceof RpcError && (error.code === 429 || /\b429\b|rate[ -]limited/i.test(error.message))) throw new PollFailure('rate limited');
      throw error;
    } finally {
      clearTimeout(timer);
      this.#kills.delete(kill);
      client?.close();
      kill();
      await ended;
      await rm(cwd, { recursive: true, force: true });
    }
  }
  async close(): Promise<void> {
    this.#closed = true;
    if (this.#timer) this.#clock.clearInterval(this.#timer);
    for (const hit of [...this.#hits.values()]) hit.finish();
    for (const kill of this.#kills) kill();
    while (this.#queue.length) this.#queue.shift()?.();
    await Promise.all(this.#pending.values());
  }
}
