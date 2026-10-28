import type { Pairing, RemoteStore } from './state.ts';
import type { Clock } from '../hub/clock.ts';

export type MediaFile = { kind: string; fileId: string; name: string; mime: string; size?: number; duration?: number };
export type MediaInput = { chat: string; message: string; date: number; late?: string; pairing?: Pairing; caption: string; reply?: string; file?: MediaFile; text?: string };

/** Messenger-scoped durable FIFO. Only native file identifiers, never URLs or bytes. */
export class MediaQueue {
  readonly #store: RemoteStore;
  readonly #clock: Clock;
  readonly #signal: AbortSignal;
  readonly #process: (input: MediaInput) => Promise<void>;
  readonly #workers = new Map<string, Promise<void>>();
  constructor(store: RemoteStore, clock: Clock, signal: AbortSignal, process: (input: MediaInput) => Promise<void>) {
    this.#store = store; this.#clock = clock; this.#signal = signal; this.#process = process;
  }
  #rows() { return this.#store.entries('media.queue:').map(row => ({ ...row, input: JSON.parse(row.value) as MediaInput })); }
  has(chat: string): boolean { return this.#rows().some(row => row.input.chat === chat); }
  enqueue(input: MediaInput): void {
    const identity = `media.identity:${input.chat}:${input.message}`;
    if (this.#store.get(identity) !== null) return;
    const sequence = Number(this.#store.get('media.sequence') ?? 0) + 1;
    this.#store.set('media.sequence', String(sequence));
    // Queue record is the authoritative receipt; a restart between these writes
    // can replay the same ingress safely through the gateway's durable id.
    const pairing = this.#store.pairing();
    this.#store.set(`media.queue:${String(sequence).padStart(16, '0')}`, JSON.stringify({ ...input, ...(pairing ? { pairing } : {}) }));
    this.#store.set(identity, 'stored');
    this.#start(input.chat);
  }
  recover(): void { for (const row of this.#rows()) this.#start(row.input.chat); }
  #start(chat: string): void {
    if (this.#workers.has(chat) || this.#signal.aborted) return;
    const work = Promise.resolve().then(async () => {
      while (!this.#signal.aborted) {
        const row = this.#rows().find(row => row.input.chat === chat);
        if (!row) break;
        if (this.#store.pairing()?.chatId !== chat) { this.#store.set(row.key, null); continue; }
        try { await this.#process(row.input); }
        catch {
          if (this.#signal.aborted) break;
          await pause(this.#clock, this.#signal, 1_000);
          continue;
        }
        this.#store.set(`media.identity:${row.input.chat}:${row.input.message}`, 'completed');
        this.#store.set(row.key, null);
      }
    }).finally(() => {
      this.#workers.delete(chat);
      if (this.has(chat)) this.#start(chat);
    });
    this.#workers.set(chat, work);
    void work.catch(() => {});
  }
  async stop(): Promise<void> { await Promise.allSettled(this.#workers.values()); }
}

function pause(clock: Clock, signal: AbortSignal, ms: number): Promise<void> {
  return new Promise(resolve => {
    const done = () => { clock.clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = clock.setTimeout(done, ms); timer.unref();
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}
