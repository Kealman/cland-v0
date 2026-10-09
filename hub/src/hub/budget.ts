// The hub's guard on its own request path (T-67). Every request runs on the one event loop, so a slow handler
// delays every other client, and a client that repeats a read in a burst queues the same work many times over.
//
// - The budget: each frame's handling is timed; one over `BUDGET_MS` is logged as `slow-request` (tool, client,
//   duration) and counted for `hub status`, so a stuck or slow handler is never silent.
// - The repeat guard: a read a connection sends again within `REPEAT_MS` of the same read's answer, with nothing
//   written anywhere in between, is answered with that answer again instead of being handled. A client hears
//   nothing older than it would have had it asked a moment earlier, and its own write is always seen (any write
//   on any connection ends every replay). It is logged once per connection and tool as `too-fast`.
import type { LogFn } from '../log.ts';
import type { HubFrame } from '../protocol.ts';

/** A handler taking longer than this, ms, is a `slow-request`. */
export const BUDGET_MS = 250;
/** The same read again within this many ms of its answer is answered from that answer. */
export const REPEAT_MS = 250;

/** The requests that only read: the ones a UI polls, safe to answer again. */
const READS: ReadonlySet<string> = new Set([
  'task.list',
  'task.view',
  'session.list',
  'topic.list',
  'topic.history',
  'inbox.list',
  'role.list',
  'role.state',
  'hub.status',
  'who',
  'history',
  'artifact.list',
]);

export type RequestCounters = {
  /** Handlers over the budget since the hub started, and the latest of them. */
  slow: number;
  lastSlow?: { tool: string; client: string; ms: number; at: string; phase?: 'resumed' | 'answer' };
  /** Reads answered again from their previous answer. */
  replayed: number;
};

export type GuardOptions = { log?: LogFn; budgetMs?: number; repeatMs?: number; now?: () => number };

/** One per hub: the budget, the counters and the write generation every connection's replays check. */
export class RequestGuard {
  readonly #log: LogFn;
  readonly #budgetMs: number;
  readonly repeatMs: number;
  readonly now: () => number;
  readonly counters: RequestCounters = { slow: 0, replayed: 0 };
  /** Moves with every write: a replay is only of an answer given in the same generation. */
  generation = 0;

  constructor(options: GuardOptions = {}) {
    this.#log = options.log ?? (() => {});
    this.#budgetMs = options.budgetMs ?? BUDGET_MS;
    this.repeatMs = options.repeatMs ?? REPEAT_MS;
    this.now = options.now ?? (() => performance.now());
  }

  /** Something changed that a read could show (a write, an event): no earlier answer is replayed any more. */
  changed(): void {
    this.generation++;
  }

  /**
   * Time `handle` (one stretch of a request's handling on the event loop) and log it when it went over the budget.
   * `phase` names a stretch after the first: a handler that awaited (Git, for a verdict's commit) resumes synchronously,
   * and that part blocks the loop as much as the first.
   */
  measure<T>(tool: string, client: string, handle: () => T, phase?: 'resumed' | 'answer'): T {
    const started = this.now();
    try {
      return handle();
    } finally {
      const ms = Math.round(this.now() - started);
      if (ms > this.#budgetMs) {
        this.counters.slow++;
        this.counters.lastSlow = { tool, client, ms, at: new Date().toISOString(), ...(phase ? { phase } : {}) };
        this.#log({ event: 'slow-request', tool, client, ms, budgetMs: this.#budgetMs, ...(phase ? { phase } : {}) });
      }
    }
  }

  conversation(): ConversationGuard {
    return new ConversationGuard(this, this.#log);
  }
}

/** One per connection: its reads' latest answers. */
export class ConversationGuard {
  readonly #hub: RequestGuard;
  readonly #log: LogFn;
  /** A read's key → its latest answer, when and in which generation it was given. */
  readonly #answers = new Map<string, { at: number; generation: number; frame: HubFrame & { type: 'result' } }>();
  /** Request id → the read it asked, until answered. */
  readonly #asked = new Map<string, { key: string; generation: number }>();
  readonly #told = new Set<string>();

  constructor(hub: RequestGuard, log: LogFn) {
    this.#hub = hub;
    this.#log = log;
  }

  /**
   * A frame about to be handled: the answer to send instead when it repeats a read too fast, else null (handle it).
   * A frame that is no read is a write: every replay ends.
   */
  replay(frame: Record<string, unknown>, client: string): HubFrame | null {
    const type = String(frame.type);
    if (typeof frame.id !== 'string') return null;
    if (!READS.has(type)) {
      this.#hub.changed();
      return null;
    }
    const { id, ...rest } = frame;
    const key = JSON.stringify(rest);
    const last = this.#answers.get(key);
    if (last && last.generation === this.#hub.generation && this.#hub.now() - last.at < this.#hub.repeatMs) {
      this.#hub.counters.replayed++;
      if (!this.#told.has(type)) {
        this.#told.add(type);
        this.#log({ event: 'too-fast', tool: type, client, repeatMs: this.#hub.repeatMs, note: 'the same read again too soon: answered with its previous answer (logged once per connection and tool)' });
      }
      return { ...last.frame, id };
    }
    this.#asked.set(id, { key, generation: this.#hub.generation });
    return null;
  }

  /** A result on its way out: a read's successful answer is kept for a repeat. */
  answered(frame: HubFrame): void {
    if (frame.type !== 'result') return;
    const asked = this.#asked.get(frame.id);
    if (!asked) return;
    this.#asked.delete(frame.id);
    if (!frame.ok || asked.generation !== this.#hub.generation) return;
    this.#answers.set(asked.key, { at: this.#hub.now(), generation: asked.generation, frame });
    if (this.#answers.size > 64) this.#answers.delete(this.#answers.keys().next().value!);
  }
}
