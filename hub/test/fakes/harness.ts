// In-process harness simulation. No transport, process, polling or implicit turns.
import { randomUUID } from 'node:crypto';
import { CLAUDE_CODE_CAPABILITIES, CLAUDE_CODE_CLAUSE_AT_SPAWN, interpret as claudeInterpret } from '../../src/adapters/claude-code.ts';
import { CODEX_CAPABILITIES, CODEX_CLAUSE_AT_SPAWN } from '../../src/adapters/codex.ts';
import { OPENCODE_CAPABILITIES, OPENCODE_CLAUSE_AT_SPAWN } from '../../src/adapters/opencode.ts';
import { InjectUncertain, type AdapterHost, type HarnessAdapter, type HarnessProcess, type SpawnRequest, type ResumeResult } from '../../src/adapters/contract.ts';
import { realClock, type Clock, type ClockTimer } from '../../src/hub/clock.ts';
import type { Message, SessionState, SessionUsage, TopicRef } from '../../src/protocol.ts';

export const FAKE_FLAVOURS = ['claude-code', 'codex', 'opencode'] as const;
export type FakeFlavour = typeof FAKE_FLAVOURS[number];
export type InjectOutcome = 'accept' | 'reject' | 'uncertain' | 'hold';
type FakeSession = { process: HarnessProcess; state: SessionState; alive: boolean; usage: SessionUsage | null };
type Script = InjectOutcome | { outcome: InjectOutcome; afterMs: number };
export type FakeInject = { process: HarnessProcess; message: Message; topic: TopicRef | null; outcome: InjectOutcome };
const capabilities = { 'claude-code': CLAUDE_CODE_CAPABILITIES, codex: CODEX_CAPABILITIES, opencode: OPENCODE_CAPABILITIES };
const clauses = { 'claude-code': CLAUDE_CODE_CLAUSE_AT_SPAWN, codex: CODEX_CLAUSE_AT_SPAWN, opencode: OPENCODE_CLAUSE_AT_SPAWN };

export function fakeHarness(flavour: FakeFlavour, options: { host?: AdapterHost; clock?: Clock } = {}): FakeHarness {
  return new FakeHarness(flavour, options);
}

export class FakeHarness implements HarnessAdapter {
  readonly harness: FakeFlavour;
  readonly capabilities;
  readonly clauseAtSpawn;
  readonly spawns: SpawnRequest[] = [];
  readonly injections: FakeInject[] = [];
  readonly stops: HarnessProcess[] = [];
  readonly resumes: Array<{ process: HarnessProcess; options: Parameters<HarnessAdapter['resume']>[1] }> = [];
  readonly #clock: Clock;
  readonly #host: AdapterHost | undefined;
  readonly #sessions = new Map<string, FakeSession>();
  readonly #scripts = new Map<string, Script[]>();
  readonly #resumeScripts = new Map<string, Array<'found' | 'gone'>>();
  readonly #pending = new Map<string, { sessionId: string; settle: (outcome: Exclude<InjectOutcome, 'hold'>) => void }>();
  readonly #timers = new Map<ClockTimer, string>();

  constructor(flavour: FakeFlavour, options: { host?: AdapterHost; clock?: Clock } = {}) {
    this.harness = flavour;
    this.capabilities = capabilities[flavour];
    this.clauseAtSpawn = clauses[flavour];
    this.#host = options.host;
    this.#clock = options.clock ?? realClock;
  }

  async spawn(request: SpawnRequest, _resumed?: Parameters<HarnessAdapter['spawn']>[1], authorize?: () => void): Promise<HarnessProcess> {
    this.spawns.push(structuredClone(request));
    authorize?.();
    const sessionId = request.sessionId ?? randomUUID();
    const process: HarnessProcess = {
      name: request.name, harness: this.harness, account: request.account ?? null, accountEnv: request.accountEnv ?? null,
      role: request.role, model: request.model, cwd: request.cwd, pid: null, harnessId: `fake:${sessionId}`,
      sessionId, harnessSessionId: request.resumeConversation ?? sessionId,
      startedAt: this.#clock.now().toISOString(), status: 'running', effort: request.effort ?? null, item: request.item ?? null,
    };
    this.#sessions.set(sessionId, { process, state: 'unknown', alive: true, usage: null });
    return process;
  }

  attachCommand(process: HarnessProcess): string { return `fake ${this.harness} attach ${process.sessionId}`; }
  scriptInject(name: string, ...outcomes: Script[]): void { this.#scripts.set(name, [...(this.#scripts.get(name) ?? []), ...outcomes]); }
  scriptResume(name: string, ...outcomes: Array<'found' | 'gone'>): void { this.#resumeScripts.set(name, [...(this.#resumeScripts.get(name) ?? []), ...outcomes]); }

  inject(process: HarnessProcess, message: Message, topic: TopicRef | null): Promise<void> {
    const script = this.#scripts.get(process.name)?.shift() ?? 'accept';
    const outcome = typeof script === 'string' ? script : script.outcome;
    this.injections.push({ process: structuredClone(process), message: structuredClone(message), topic: structuredClone(topic), outcome });
    const key = `${process.sessionId}:${message.id}`;
    return new Promise<void>((resolve, reject) => {
      let timer: ClockTimer | undefined;
      const settle = (answer: Exclude<InjectOutcome, 'hold'>) => {
        if (this.#pending.get(key)?.settle !== settle) return;
        this.#pending.delete(key);
        if (timer) { this.#clock.clearTimeout(timer); this.#timers.delete(timer); }
        if (answer === 'accept') resolve();
        else reject(answer === 'uncertain' ? new InjectUncertain('fake inject outcome unknown') : new Error('fake inject rejected'));
      };
      this.#pending.set(key, { sessionId: process.sessionId, settle });
      if (typeof script !== 'string') timer = this.#later(process.sessionId, script.afterMs, () => { if (outcome !== 'hold') settle(outcome); });
      else if (outcome !== 'hold') settle(outcome);
    });
  }
  settle(name: string, messageId: string, outcome: Exclude<InjectOutcome, 'hold'> = 'accept'): void {
    const pending = this.#pending.get(`${this.#session(name).process.sessionId}:${messageId}`);
    if (!pending) throw new Error(`no held inject ${messageId}`);
    pending.settle(outcome);
  }
  confirm(process: HarnessProcess, messageId: string): void {
    const pending = this.#pending.get(`${process.sessionId}:${messageId}`);
    if (pending?.sessionId === process.sessionId) pending.settle('accept');
  }
  interpret(event: string, payload: Record<string, unknown>) { return this.harness === 'claude-code' ? claudeInterpret(event, payload) : {}; }
  watch(process: HarnessProcess): void {
    const existing = this.#sessions.get(process.sessionId);
    if (existing) existing.process = process;
    else this.#sessions.set(process.sessionId, { process, state: 'unknown', alive: true, usage: null });
  }
  renamed(process: HarnessProcess): void {
    const session = this.#sessions.get(process.sessionId);
    if (session) session.process = process;
  }
  forget(sessionId: string): void { this.#cancelPending(sessionId); this.#sessions.delete(sessionId); }
  unwatch(sessionId: string): void { this.#cancelPending(sessionId); }
  usage(process: HarnessProcess): SessionUsage | null { return this.#sessions.get(process.sessionId)?.usage ?? null; }
  feedUsage(name: string, usage: SessionUsage): void {
    this.#feedUsage(this.#session(name), usage);
  }
  model(name: string, model: string): void { this.#signal(name, undefined, model); }
  busy(name: string): void { this.#signal(name, 'busy'); }
  idle(name: string): void { this.#signal(name, 'idle'); }
  turn(name: string, options: { afterMs?: number; usage?: SessionUsage; model?: string } = {}): void {
    this.#signal(name, 'busy', options.model);
    const sessionId = this.#session(name).process.sessionId;
    this.#later(sessionId, options.afterMs ?? 30, () => {
      const session = this.#sessions.get(sessionId);
      if (!session?.alive) return;
      if (options.usage) this.#feedUsage(session, options.usage);
      this.#publish(session, 'idle');
    });
  }
  exit(name: string, code = 0): void {
    const session = this.#session(name);
    session.alive = false;
    this.#cancelPending(session.process.sessionId);
    this.#host?.exited(session.process.sessionId, `exit ${code}`);
  }
  crash(name: string): void { this.exit(name, 1); }
  async stop(process: HarnessProcess, _resumed?: Parameters<HarnessAdapter['stop']>[1], authorize?: () => void): Promise<void> {
    authorize?.();
    this.stops.push(structuredClone(process));
    const session = this.#sessions.get(process.sessionId);
    if (session) session.alive = false;
    this.#cancelPending(process.sessionId);
  }
  async resume(process: HarnessProcess, options?: Parameters<HarnessAdapter['resume']>[1]): Promise<ResumeResult> {
    this.resumes.push({ process: structuredClone(process), options });
    const scripted = this.#resumeScripts.get(process.name)?.shift();
    const session = this.#sessions.get(process.sessionId);
    if (scripted === 'gone' || (scripted !== 'found' && !session?.alive && !options?.relaunch)) return { found: false, reason: 'fake conversation gone' };
    if (options?.relaunch) options.authorize?.();
    const found = { ...process, status: 'running' as const, ...(options?.relaunch ? { startedAt: this.#clock.now().toISOString() } : {}) };
    this.#sessions.set(process.sessionId, { process: found, alive: true, state: session?.state ?? 'idle', usage: session?.usage ?? null });
    return { found: true, process: found, state: session?.state ?? 'idle' };
  }
  close(): void {
    for (const timer of this.#timers.keys()) this.#clock.clearTimeout(timer);
    this.#timers.clear();
    for (const pending of [...this.#pending.values()]) pending.settle('reject');
  }
  #session(name: string) {
    const session = [...this.#sessions.values()].findLast(session => session.process.name === name);
    if (!session) throw new Error(`no fake session ${name}`);
    return session;
  }
  #feedUsage(session: FakeSession, usage: SessionUsage): void {
    session.usage = structuredClone(usage);
    this.#host?.usageChanged?.(session.process.sessionId);
  }
  #signal(name: string, state?: SessionState, model?: string): void {
    this.#publish(this.#session(name), state, model);
  }
  #publish(session: FakeSession, state?: SessionState, model?: string): void {
    if (!this.#host) throw new Error('fake harness needs an AdapterHost to publish signals');
    if (!session.alive) throw new Error(`fake session ${session.process.name} is gone`);
    if (state) session.state = state;
    this.#host.signal(session.process.sessionId, { source: 'fake', at: this.#clock.now().getTime(), ...(state ? { state } : {}), ...(model ? { model } : {}) });
  }
  #later(sessionId: string, ms: number, callback: () => void): ClockTimer {
    const timer = this.#clock.setTimeout(() => { this.#timers.delete(timer); callback(); }, ms);
    this.#timers.set(timer, sessionId);
    return timer;
  }
  #cancelPending(sessionId: string): void {
    for (const [timer, owner] of this.#timers) if (owner === sessionId) { this.#clock.clearTimeout(timer); this.#timers.delete(timer); }
    for (const pending of [...this.#pending.values()]) if (pending.sessionId === sessionId) pending.settle('reject');
  }
}
