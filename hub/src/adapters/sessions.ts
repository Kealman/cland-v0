// The hub's side of the adapters: launching sessions, the process table, each session's state, and the
// delivery pipeline's last stage. Transport-free; `./requests.ts` puts frames on it.
//
//   delivered → inject: when a session's spoke accepts a message (stage `delivered`), the session's adapter
//   injects it; the adapter's confirmation moves it to `injected`. An unconfirmed inject stays `delivered`, is
//   logged, and is retried at the session's next `idle` (and when its in-session bridge connects).
//
//   state: signals from inside the session (`session.signal`, sent by `cland hook`) and the adapter's own poll.
//   A signal older than the last one applied is dropped; a polled one counts only while no push signal came
//   for a while (or nothing is known yet). The model's `status` tool never reaches here.
//
//   launch: a signal or a bridge names the launch it comes from (the cland session id the hooks and the mod
//   were started with). One from an earlier launch under the same name is ignored: it never touches the row
//   of the process that replaced it. A signal never revives a row that is not running (only resume does).
import { nameRefusal, ROLE_NAMES } from '../names.ts';
import type { HubCore } from '../hub/core.ts';
import type { HarnessProcessView, SessionState } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import type { AdapterHost, Capabilities, HarnessAdapter, HarnessProcess, InjectFrame, StateSignal } from './contract.ts';
import { ProcessTable } from './processes.ts';

/** A signal posted from inside a session (`cland hook <event>`). */
export type SignalFrame = { session?: string; sessionId?: string; launch?: string; event: string; at?: number; payload?: Record<string, unknown> };

export type LaunchRequest = { name: string; role?: string | null; model?: string | null; harness?: string; cwd?: string };

export type SessionsOptions = {
  core: HubCore;
  table: ProcessTable;
  root: string;
  log?: LogFn;
  /** How long after a push signal a polled signal is still ignored, ms. */
  pushTrustMs?: number;
};

export const DEFAULT_HARNESS = 'claude-code';

export class Sessions {
  readonly #core: HubCore;
  readonly #table: ProcessTable;
  readonly #root: string;
  readonly #log: LogFn;
  readonly #pushTrustMs: number;
  readonly #adapters = new Map<string, HarnessAdapter>();
  /** By session id: when the last applied signal happened, and when the last push signal arrived. */
  readonly #lastAt = new Map<string, number>();
  readonly #lastPush = new Map<string, number>();
  /** Injects in flight, `<session id>:<message id>`: a retry never doubles one. */
  readonly #inflight = new Set<string>();
  /** Launches in progress by name, with the signals that arrived before the process-table row (the harness's
   *  SessionStart hook can beat the launch's own return): replayed once the row is written. */
  readonly #launching = new Map<string, SignalFrame[]>();
  /** Bridges that connected during their session's launch: registered once the row is written. */
  readonly #earlyBridges = new Map<string, Array<() => void>>();

  constructor(options: SessionsOptions) {
    this.#core = options.core;
    this.#table = options.table;
    this.#root = options.root;
    this.#log = options.log ?? (() => {});
    this.#pushTrustMs = options.pushTrustMs ?? 15_000;
    this.#core.onDelivered((messageId, _name, sessionId) => this.#inject(sessionId, messageId));
  }

  /** The callbacks an adapter is built with, bound to this hub. */
  host(fields: Pick<AdapterHost, 'discoveryFile' | 'node' | 'cli' | 'spoke'>): AdapterHost {
    return {
      ...fields,
      root: this.#root,
      log: this.#log,
      signal: (sessionId, signal) => this.#signal(sessionId, signal, false),
      exited: (sessionId, detail) => this.#exited(sessionId, detail),
      recordPid: (sessionId, pid) => {
        const p = this.#table.bySessionId(sessionId);
        if (p) this.#table.update(p.name, { pid });
      },
    };
  }

  register(adapter: HarnessAdapter): void {
    this.#adapters.set(adapter.harness, adapter);
  }

  adapter(harness: string): HarnessAdapter {
    const a = this.#adapters.get(harness);
    if (!a) throw new Error(`no adapter for harness "${harness}" (known: ${[...this.#adapters.keys()].join(', ') || 'none'})`);
    return a;
  }

  // ---------------------------------------------------------------- views

  view(p: HarnessProcess): HarnessProcessView {
    const adapter = this.#adapters.get(p.harness);
    const usage = adapter?.usage?.(p) ?? null;
    return {
      name: p.name,
      harness: p.harness,
      role: p.role,
      model: p.model,
      cwd: p.cwd,
      pid: p.pid,
      harnessId: p.harnessId,
      sessionId: p.sessionId,
      harnessSessionId: p.harnessSessionId,
      startedAt: p.startedAt,
      status: p.status,
      state: p.status === 'running' ? this.#core.sessionState(p.sessionId) : 'unknown',
      attach: p.status === 'running' && adapter ? adapter.attachCommand(p) : null,
      ...(usage ? { usage } : {}),
    };
  }

  list(): HarnessProcessView[] {
    return this.#table.all().map((p) => this.view(p));
  }

  /** Each adapter's capability table (spec 4.3): what it can do and how far each state signal is trusted. */
  capabilities(): Record<string, Capabilities> {
    return Object.fromEntries([...this.#adapters.values()].map((a) => [a.harness, a.capabilities]));
  }

  #process(name: string): HarnessProcess {
    const p = this.#table.get(name);
    if (!p) throw new Error(`no session "${name}" was launched by this hub`);
    return p;
  }

  // ---------------------------------------------------------------- launch, attach, stop, resume

  async launch(request: LaunchRequest): Promise<HarnessProcessView> {
    const refusal = nameRefusal(request.name, new Set(['human']));
    if (refusal) throw new Error(refusal);
    const role = request.role ?? null;
    if (role !== null && !ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (roles: ${ROLE_NAMES.join(', ')})`);
    const existing = this.#table.get(request.name);
    if (existing?.status === 'running') throw new Error(`session "${request.name}" is already running (${existing.harness}, pid ${existing.pid ?? '?'}); stop it first`);
    if (this.#core.presence().some((p) => p.name === request.name)) throw new Error(`name "${request.name}" is in use by a live session`);
    if (this.#launching.has(request.name)) throw new Error(`session "${request.name}" is being launched`);
    const adapter = this.adapter(request.harness ?? DEFAULT_HARNESS);
    this.#launching.set(request.name, []);
    let early: SignalFrame[] = [];
    let p: HarnessProcess;
    try {
      p = await adapter.spawn({ name: request.name, role, model: request.model ?? null, cwd: request.cwd ?? this.#root });
      this.#table.put(p);
    } catch (err) {
      this.#earlyBridges.delete(request.name);
      throw err;
    } finally {
      early = this.#launching.get(request.name) ?? [];
      this.#launching.delete(request.name);
    }
    this.#lastAt.delete(p.sessionId);
    this.#lastPush.delete(p.sessionId);
    adapter.watch(p);
    this.#log({ event: 'session-launched', session: p.name, harness: p.harness, pid: p.pid, harnessId: p.harnessId, sessionId: p.sessionId, harnessSessionId: p.harnessSessionId, model: p.model, role: p.role, early: early.length });
    for (const frame of early) this.signal(frame);
    for (const connect of this.#earlyBridges.get(p.name) ?? []) connect();
    this.#earlyBridges.delete(p.name);
    return this.view(this.#table.get(p.name) ?? p);
  }

  attachCommand(name: string): string {
    const p = this.#process(name);
    if (p.status !== 'running') throw new Error(`session "${name}" is not running (${p.status})`);
    return this.adapter(p.harness).attachCommand(p);
  }

  async stop(name: string): Promise<HarnessProcessView> {
    const p = this.#process(name);
    await this.adapter(p.harness).stop(p);
    this.#table.update(name, { status: 'stopped' });
    this.#core.setSessionState(p.sessionId, name, 'unknown', 'stopped');
    this.#log({ event: 'session-stopped', session: name, harness: p.harness });
    return this.view(this.#process(name));
  }

  /** Re-find one session (or relaunch it); a session that cannot be re-found is `unknown` and journalled. */
  async resume(name: string, relaunch = false): Promise<{ found: boolean; reason?: string; process: HarnessProcessView }> {
    const p = this.#process(name);
    const adapter = this.adapter(p.harness);
    const r = await adapter.resume(p, { relaunch });
    if (!r.found) {
      if (p.status === 'running') this.#exited(p.sessionId, r.reason);
      return { found: false, reason: r.reason, process: this.view(this.#process(name)) };
    }
    this.#table.put(r.process);
    adapter.watch(r.process);
    this.#log({ event: 'session-resumed', session: name, harness: p.harness, pid: r.process.pid, state: r.state, relaunched: relaunch && p.status !== 'running' });
    if (r.state !== 'unknown') this.#signal(p.sessionId, { state: r.state, source: 'resume', at: Date.now() }, false);
    return { found: true, process: this.view(r.process) };
  }

  /** At the hub's start: every process the table says runs is re-found or marked gone. */
  async resumeAll(): Promise<void> {
    for (const p of this.#table.running()) {
      try {
        await this.resume(p.name);
      } catch (err) {
        this.#log({ event: 'resume-failed', session: p.name, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  // ---------------------------------------------------------------- signals from inside the session

  /** Find the process a hook or the mod speaks for: by the cland name it was launched with, else the harness's session id. */
  #signalled(session: string | undefined, sessionId: string | undefined): HarnessProcess | null {
    const byName = session ? this.#table.get(session) : null;
    if (byName) return byName;
    return sessionId ? this.#table.bySessionId(sessionId) : null;
  }

  /**
   * `cland hook <event>` posted a signal: a state, the model, usage, a confirmed inject. A signal for a session
   * the hub did not launch is logged and ignored (its state stays `unknown`).
   */
  signal(frame: SignalFrame): { applied: boolean; state?: SessionState; buffered?: true } {
    const launching = frame.session !== undefined ? this.#launching.get(frame.session) : undefined;
    if (launching) {
      launching.push(frame);
      return { applied: false, buffered: true };
    }
    const p = this.#signalled(frame.session, frame.sessionId);
    if (!p) {
      this.#log({ event: 'signal-unmatched', session: frame.session ?? null, hookEvent: frame.event });
      return { applied: false };
    }
    if (frame.launch !== undefined && frame.launch !== p.sessionId) {
      this.#log({ event: 'signal-other-launch', session: p.name, hookEvent: frame.event });
      return { applied: false };
    }
    const adapter = this.adapter(p.harness);
    const payload = frame.payload ?? {};
    if (frame.event === 'injected') {
      const id = typeof payload.message === 'string' ? payload.message : null;
      if (id) this.#confirm(p, id);
      return { applied: true };
    }
    // the harness's own conversation id, as its hooks carry it (a `/clear` starts a new one)
    const harnessSessionId = typeof payload.session_id === 'string' ? payload.session_id : null;
    if (harnessSessionId && harnessSessionId !== (p.harnessSessionId ?? p.sessionId)) this.#table.update(p.name, { harnessSessionId });
    const meaning = adapter.interpret(frame.event, payload);
    for (const id of meaning.confirms ?? []) this.#confirm(p, id);
    if (meaning.model && meaning.model !== p.model) this.#table.update(p.name, { model: meaning.model });
    if (meaning.usage) adapter.noteUsage?.(p, meaning.usage);
    if (!meaning.state) return { applied: false };
    const applied = this.#signal(p.sessionId, { state: meaning.state, source: frame.event.startsWith('mod-') ? 'mod' : 'hook', at: frame.at ?? Date.now() }, true);
    return { applied, state: this.#core.sessionState(p.sessionId) };
  }

  #signal(sessionId: string, signal: StateSignal, push: boolean): boolean {
    const p = this.#table.bySessionId(sessionId);
    if (!p || p.status !== 'running') return false;
    const now = Date.now();
    const current = this.#core.sessionState(sessionId);
    if (push) {
      if (signal.at < (this.#lastAt.get(sessionId) ?? 0)) {
        this.#log({ event: 'signal-stale', session: p.name, state: signal.state, source: signal.source });
        return false;
      }
      this.#lastPush.set(sessionId, now);
    } else if (current !== 'unknown' && now - (this.#lastPush.get(sessionId) ?? 0) < this.#pushTrustMs) {
      // a push signal is fresher than any poll
      return false;
    }
    // only push signals order each other: a poll reads a snapshot, and a hook that started before it still counts
    if (push) this.#lastAt.set(sessionId, Math.max(signal.at, this.#lastAt.get(sessionId) ?? 0));
    const name = this.#core.connectionOf(sessionId)?.name ?? p.name;
    const changed = this.#core.setSessionState(sessionId, name, signal.state, signal.source);
    // the next idle — a transition, not every poll that finds it idle — retries what was never confirmed
    if (signal.state === 'idle' && changed) this.#retry(p);
    return changed;
  }

  #exited(sessionId: string, detail: string): void {
    const p = this.#table.bySessionId(sessionId);
    if (!p || p.status !== 'running') return;
    this.#table.update(p.name, { status: 'exited' });
    // TODO(#34): the journal; until it exists, the hub's log carries the event
    this.#log({ event: 'harness-exited', session: p.name, harness: p.harness, pid: p.pid, detail });
    this.#core.setSessionState(sessionId, p.name, 'unknown', 'process');
  }

  // ---------------------------------------------------------------- the bridge and inject

  /** An in-session bridge (the mod) connected for `session` (from `launch`, when it says); returns its
   *  disconnect. What waited is retried. */
  bridge(session: string, send: (frame: InjectFrame) => boolean, launch?: string): () => void {
    if (this.#launching.has(session)) {
      // the mod can connect before the launch returns: the row it belongs to is not written yet
      let disconnect: (() => void) | null = null;
      let closed = false;
      const connect = () => {
        if (closed) return;
        try {
          disconnect = this.bridge(session, send, launch);
        } catch (err) {
          this.#log({ event: 'bridge-refused', session, error: err instanceof Error ? err.message : String(err) });
        }
      };
      this.#earlyBridges.set(session, [...(this.#earlyBridges.get(session) ?? []), connect]);
      return () => {
        closed = true;
        disconnect?.();
      };
    }
    const p = this.#process(session);
    if (launch !== undefined && launch !== p.sessionId) throw new Error(`this bridge belongs to an earlier launch of "${session}"`);
    const adapter = this.adapter(p.harness);
    if (!adapter.bridge) throw new Error(`the ${p.harness} adapter takes no bridge`);
    const disconnect = adapter.bridge(p, send);
    this.#log({ event: 'bridge-connected', session });
    this.#retry(p);
    return () => {
      disconnect();
      this.#log({ event: 'bridge-closed', session });
    };
  }

  #confirm(p: HarnessProcess, messageId: string): void {
    this.adapter(p.harness).confirm(p, messageId);
    const name = this.#core.connectionOf(p.sessionId)?.name ?? p.name;
    this.#core.markInjected(messageId, name);
  }

  /** Everything the session's spoke accepted and its adapter has not confirmed: injected again. */
  #retry(p: HarnessProcess): void {
    const name = this.#core.connectionOf(p.sessionId)?.name ?? p.name;
    for (const m of this.#core.store.uninjected(name)) this.#inject(p.sessionId, m.id);
  }

  #inject(sessionId: string, messageId: string): void {
    const p = this.#table.bySessionId(sessionId);
    // a session no adapter launched has nobody to inject: its messages stay `delivered`
    if (!p || p.status !== 'running') return;
    const key = `${sessionId}:${messageId}`;
    if (this.#inflight.has(key)) return;
    const message = this.#core.store.message(messageId);
    if (!message) return;
    const adapter = this.#adapters.get(p.harness);
    if (!adapter) return;
    this.#inflight.add(key);
    const topic = message.topic !== undefined ? this.#core.topicRef(message.topic) : null;
    adapter
      .inject(p, message, topic)
      .then(() => this.#core.markInjected(messageId, this.#core.connectionOf(sessionId)?.name ?? p.name))
      .catch((err: unknown) => this.#log({ event: 'inject-unconfirmed', session: p.name, id: messageId, error: err instanceof Error ? err.message : String(err) }))
      .finally(() => this.#inflight.delete(key));
  }

  close(): void {
    for (const a of this.#adapters.values()) a.close();
    this.#core.onDelivered(null);
  }
}
