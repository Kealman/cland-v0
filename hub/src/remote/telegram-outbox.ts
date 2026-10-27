import { DatabaseSync } from 'node:sqlite';
import { Outbox, type DeliveryResult, type OutboxInput } from './outbox.ts';
import { RemoteState, type OutboxJob, type RemoteMessage, type RemoteStore } from './state.ts';
import { TelegramApi, TelegramError, type SendMessage, type SendRichMessage, type SetMessageReaction, type EditMessageText } from './telegram-api.ts';
import type { Clock } from '../hub/clock.ts';

type Payload = {
  key?: string; admission?: 'paired' | 'pairing' | 'old-chat'; userId?: string | null;
  telegram: true; order: number; part: number; method: 'sendMessage' | 'sendRichMessage' | 'setMessageReaction' | 'editMessageText';
  params: SendMessage | SendRichMessage | SetMessageReaction | EditMessageText; fallback?: SendMessage[];
  mapping: Omit<RemoteMessage, 'messageId'>;
};
type Receipt = DeliveryResult | { status: 'format-refused' };
type SendFacts = { target?: string; key?: string; missed?: boolean; admission?: 'paired' | 'pairing' | 'old-chat'; kind?: OutboxInput['kind']; source?: string | null; topic?: string; ask?: string | null; approval?: string | null };
const payload = (job: OutboxJob): Payload | undefined => {
  const value = job.payload as Partial<Payload> | null;
  return value?.telegram === true ? value as Payload : undefined;
};

/** Durable native sends; each chat owns a drain, while flood waits belong to the bot. */
export class TelegramOutbox {
  readonly #api: TelegramApi;
  readonly #store: RemoteStore;
  readonly #memory: DatabaseSync | undefined;
  readonly #clock: Clock;
  readonly #signal: AbortSignal;
  readonly #abort = new AbortController();
  readonly #lanes = new Map<string, Outbox>();
  readonly #waiting = new Map<number, ReturnType<typeof Promise.withResolvers<void>>>();
  readonly #errors = new Map<string, unknown>();
  readonly #onSent: () => void;
  readonly #onError: (error: unknown) => void;
  readonly #askOpen: (id: string) => boolean | Promise<boolean>;
  readonly #approvalOpen: (id: string) => boolean | Promise<boolean>;
  #stopping: Promise<void> | undefined;

  constructor(api: TelegramApi, clock: Clock, options: {
    store?: RemoteStore; signal?: AbortSignal; onError?: (error: unknown) => void; onSent?: () => void;
    askOpen?: (id: string) => boolean | Promise<boolean>;
    approvalOpen?: (id: string) => boolean | Promise<boolean>;
  } = {}) {
    this.#api = api; this.#clock = clock;
    // Legacy injected remotes have no project store; their queue remains lifetime-local.
    if (options.store) this.#store = options.store;
    else { this.#memory = new DatabaseSync(':memory:'); this.#store = new RemoteState(this.#memory).forMessenger('telegram'); }
    this.#signal = options.signal ? AbortSignal.any([this.#abort.signal, options.signal]) : this.#abort.signal;
    this.#onSent = options.onSent ?? (() => {});
    this.#onError = options.onError ?? (() => {});
    this.#askOpen = options.askOpen ?? (() => true);
    this.#approvalOpen = options.approvalOpen ?? (() => true);
  }

  send(params: SendMessage, facts: SendFacts = {}): Promise<void> {
    const fallback = facts.kind === 'card' && params.entities?.length ? [{ ...params, entities: [] }] : undefined;
    return this.#enqueue('sendMessage', params, facts, fallback);
  }
  edit(params: EditMessageText, facts: SendFacts): Promise<void> {
    const { message_id, ...reply } = params;
    return this.#enqueue('editMessageText', params, { ...facts, kind: 'edit', target: `${params.chat_id}:${message_id}` },
      [{ ...reply, reply_parameters: { message_id } }]);
  }
  react(params: SetMessageReaction): Promise<void> {
    return this.#enqueue('setMessageReaction', params, {});
  }
  setAvailable(available: boolean): void { this.#store.set('outbox.unavailable', available ? null : '1'); }
  rich(params: SendRichMessage, fallback: SendMessage[], facts: SendFacts): Promise<void> {
    return this.#enqueue('sendRichMessage', params, facts, fallback);
  }

  #enqueue(method: Payload['method'], params: Payload['params'], facts: SendFacts, fallback?: SendMessage[]): Promise<void> {
    this.#signal.throwIfAborted();
    const chat = String(params.chat_id);
    const previous = facts.key ? this.#store.outbox().find(job => payload(job)?.key === facts.key) : undefined;
    if (previous) {
      if (String(payload(previous)!.params.chat_id) !== chat) throw new Error('Telegram send key belongs to another chat');
      if (previous.state === 'sent') return Promise.resolve();
      if (method === 'editMessageText' && payload(previous)!.method === method
        && previous.state === 'queued' && !this.#store.attempts(previous.id).length) {
        // Keep the original order/waiters; only an unattempted edit is mutable.
        this.#store.putOutbox({ ...previous, updated: this.#clock.now().toISOString(),
          payload: { ...payload(previous)!, params, fallback } });
      }
      return this.#wait(payload(previous)!.order, this.#lane(chat));
    }
    const order = Number(this.#store.get('telegram.outbox.order') ?? 0) + 1;
    this.#store.set('telegram.outbox.order', String(order));
    const intent: Payload = { ...(facts.key ? { key: facts.key } : {}), admission: facts.admission ?? 'paired', userId: this.#store.pairing()?.userId ?? null, telegram: true, order, part: 0, method, params, ...(fallback ? { fallback } : {}),
      mapping: { chatId: chat, topic: facts.topic ?? 'general', message: facts.source ?? null,
        ask: facts.ask ?? null, approval: facts.approval ?? null } };
    const lane = this.#lane(chat);
    const id = lane.enqueue({ kind: facts.kind ?? 'message', source: facts.source ?? null, payload: intent, ...(facts.target ? { target: facts.target } : {}) });
    if (facts.kind === 'general' && facts.missed) {
      const job = this.#store.outbox().find(row => row.id === id)!;
      this.#store.putOutbox({ ...job, state: 'missed' });
    }
    return this.#wait(order, lane);
  }

  #wait(order: number, lane: Outbox): Promise<void> {
    const active = this.#waiting.get(order);
    if (active) return active.promise;
    const completion = Promise.withResolvers<void>();
    this.#waiting.set(order, completion);
    void lane.drain().then(() => this.#complete(order, true), error => {
      this.#waiting.delete(order); completion.reject(error);
    });
    return completion.promise;
  }

  #complete(order: number, drained = false): void {
    const completion = this.#waiting.get(order);
    if (!completion) return;
    const group = this.#store.outbox().filter(job => payload(job)?.order === order);
    const failure = group.map(job => this.#errors.get(job.id)).find(error => error !== undefined);
    if (!failure && !drained && group.some(job => job.state === 'queued' || job.state === 'sending')) return;
    this.#waiting.delete(order);
    for (const job of group) this.#errors.delete(job.id);
    if (failure) completion.reject(failure);
    else if (!group.length || group.some(job => job.state !== 'sent' && job.state !== 'dropped'
      && !(job.kind === 'general' && job.state === 'missed'))
      || group.some(job => payload(job)?.key) && !group.some(job => job.state === 'sent')
        && !(group.every(job => job.kind === 'card' && job.state === 'dropped')
          && group.some(job => this.#store.get(`telegram.outbox.source-closed:${job.id}`) === '1'))
      || payload(group[0]!)!.method === 'setMessageReaction' && !group.some(job => job.state === 'sent'))
      completion.reject(new Error('Telegram send has no delivery receipt'));
    else completion.resolve();
  }

  #lane(chat: string): Outbox {
    let lane = this.#lanes.get(chat);
    if (!lane) {
      lane = new Outbox(this.#store, {
        send: job => this.#deliver(job),
        settled: job => this.#complete(payload(job)!.order),
        prove: async job => {
          const receipt = this.#store.get(`telegram.outbox.receipt:${job.id}`);
          if (!receipt) return { status: 'unknown' };
          const result = JSON.parse(receipt) as Receipt;
          return result.status === 'format-refused' ? this.#replace(job) : result;
        },
      }, { clock: this.#clock,
        accepts: job => String(payload(job)?.params.chat_id) === chat,
        sourceOpen: async job => {
          const ask = payload(job)?.mapping.ask;
          const approval = payload(job)?.mapping.approval;
          // Unknown sends keep their replay fence even after the ask closes.
          const previous = this.#store.attempts(job.id).at(-1);
          if (job.kind !== 'card' || !ask && !approval || previous && previous.outcome !== 'never-left') return true;
          const open = ask ? await this.#askOpen(ask) : await this.#approvalOpen(approval!);
          if (!open) this.#store.set(`telegram.outbox.source-closed:${job.id}`, '1');
          return open;
        },
        compare: (a, b) => Number(b.kind === 'card' || b.kind === 'edit') - Number(a.kind === 'card' || a.kind === 'edit')
          || payload(a)!.order - payload(b)!.order || payload(a)!.part - payload(b)!.part,
        admit: job => {
          const intent = payload(job)!;
          if (this.#memory || intent.admission === 'pairing' || intent.admission === 'old-chat') return true;
          const paired = this.#store.pairing();
          return !!paired && paired.chatId === String(intent.params.chat_id)
            && (intent.userId === undefined || intent.userId === paired.userId);
        },
        beforeNext: () => this.#ready(chat),
      });
      this.#lanes.set(chat, lane);
    }
    return lane;
  }

  async #ready(chat: string): Promise<void> {
    for (;;) {
      if (this.#signal.aborted) return;
      const remaining = Math.max(Number(this.#store.get('telegram.outbox.holdUntil') ?? 0), Number(this.#store.get(`telegram.outbox.last:${chat}`) ?? -Infinity) + 1_000) - this.#clock.now().getTime();
      if (remaining <= 0) return;
      await new Promise<void>(resolve => {
        const finish = () => { this.#clock.clearTimeout(timer); this.#signal.removeEventListener('abort', finish); resolve(); };
        const timer = this.#clock.setTimeout(finish, remaining);
        timer.unref();
        this.#signal.addEventListener('abort', finish, { once: true });
        if (this.#signal.aborted) finish();
      });
    }
  }

  async #deliver(job: OutboxJob): Promise<DeliveryResult> {
    const intent = payload(job)!;
    const chat = String(intent.params.chat_id);
    try {
      this.#signal.throwIfAborted();
      const receipt = this.#store.get(`telegram.outbox.receipt:${job.id}`);
      if (receipt && (JSON.parse(receipt) as Receipt).status === 'format-refused') return this.#replace(job);
      this.#store.set(`telegram.outbox.last:${chat}`, String(this.#clock.now().getTime()));
      let result: DeliveryResult;
      if (intent.method === 'setMessageReaction') {
        await this.#api.setMessageReaction(intent.params as SetMessageReaction, { signal: this.#signal });
        result = { status: 'sent' }; // Feedback has no new platform message or reply map.
      } else if (intent.method === 'editMessageText') {
        await this.#api.editMessageText(intent.params as EditMessageText, { signal: this.#signal });
        result = { status: 'sent' };
      } else {
        const sent = intent.method === 'sendMessage'
          ? await this.#api.sendMessage(intent.params as SendMessage, { signal: this.#signal })
          : await this.#api.sendRichMessage(intent.params as SendRichMessage, { signal: this.#signal });
        result = { status: 'sent', message: { ...intent.mapping, messageId: String(sent.message_id) } };
      }
      // A restart can reconcile a success observed before Outbox's final atomic write.
      this.#store.set(`telegram.outbox.receipt:${job.id}`, JSON.stringify(result));
      this.#onSent();
      return result;
    } catch (error) {
      if (error instanceof TelegramError && error.code === 429) {
        const ms = Math.max(1, Math.min(300_000, (error.retryAfter ?? 1) * 1_000));
        this.#store.set('telegram.outbox.holdUntil', String(Math.max(Number(this.#store.get('telegram.outbox.holdUntil') ?? 0), this.#clock.now().getTime() + ms)));
        return { status: 'never-left', retryAfterMs: ms };
      }
      if (error instanceof TelegramError && error.code === 400 && intent.method === 'editMessageText' && error.description.toLowerCase().includes('message is not modified')) {
        const result = { status: 'sent' } as const;
        this.#store.set(`telegram.outbox.receipt:${job.id}`, JSON.stringify(result));
        return result;
      }
      const failedEdit = intent.method === 'editMessageText' && !(error instanceof TelegramError && [401, 403].includes(error.code)) && !this.#signal.aborted;
      if (failedEdit || error instanceof TelegramError && error.code === 400 && !!intent.fallback) {
        // A failed idempotent edit becomes one reply. Sends fall back only after
        // definite 400 non-delivery; all uncertain sends retain their fence.
        this.#store.set(`telegram.outbox.receipt:${job.id}`, JSON.stringify({ status: 'format-refused' }));
        return this.#replace(job);
      }
      this.#errors.set(job.id, error);
      this.#onError(error);
      throw error;
    }
  }

  #replace(job: OutboxJob): DeliveryResult {
    const intent = payload(job)!;
    try {
      return this.#store.transaction(() => {
        for (const [part, params] of intent.fallback!.entries()) this.#lane(String(params.chat_id)).enqueue({
          kind: job.kind === 'edit' ? 'message' : job.kind as OutboxInput['kind'], source: job.source,
          payload: { ...intent, method: 'sendMessage', params, fallback: undefined, part: part + 1,
            mapping: job.kind === 'edit' ? { ...intent.mapping, ask: null, approval: null } : intent.mapping },
        });
        const result = { status: 'superseded' } as const;
        this.#store.set(`telegram.outbox.receipt:${job.id}`, JSON.stringify(result));
        return result;
      });
    } catch {
      // The definite 400 remains durable; retry planning, never the rejected rich send.
      return { status: 'never-left', retryAfterMs: 1 };
    }
  }

  /** Resume only this adapter's payloads; unknown attempts remain fenced. */
  resume(): Promise<void> {
    for (const job of this.#store.outbox()) {
      const intent = payload(job);
      if (intent && ['queued', 'sending', 'uncertain'].includes(job.state)) this.#lane(String(intent.params.chat_id));
    }
    return Promise.all([...this.#lanes.values()].map(lane => lane.drain())).then(() => {});
  }

  stop(): Promise<void> {
    return this.#stopping ??= (async () => {
      this.#abort.abort();
      try { await Promise.all([...this.#lanes.values()].map(lane => lane.stop())); }
      finally { this.#memory?.close(); }
    })();
  }
}
