import type { Pairing, RemoteStore } from './state.ts';
import type { Clock } from '../hub/clock.ts';

export type MediaFile = { kind: string; fileId: string; name: string; mime: string; size?: number; duration?: number };
export type MediaInput = { chat: string; message: string; date: number; late?: string; pairing?: Pairing; caption: string; reply?: string; file?: MediaFile; text?: string; group?: string; items?: MediaInput[]; closed?: boolean; arrived?: number };

/** Messenger-scoped durable FIFO. Only native file identifiers, never URLs or bytes. */
export class MediaQueue {
  readonly #store: RemoteStore;
  readonly #clock: Clock;
  readonly #signal: AbortSignal;
  readonly #process: (input: MediaInput) => Promise<void>;
  readonly #workers = new Map<string, Promise<void>>();
  readonly #wake = new Map<string, () => void>();
  constructor(store: RemoteStore, clock: Clock, signal: AbortSignal, process: (input: MediaInput) => Promise<void>) {
    this.#store = store; this.#clock = clock; this.#signal = signal; this.#process = process;
  }
  #rows() { return this.#store.entries('media.queue:').map(row => ({ ...row, input: JSON.parse(row.value) as MediaInput })); }
  has(chat: string): boolean { return this.#rows().some(row => row.input.chat === chat); }
  enqueue(input: MediaInput): void {
    const identity = `media.identity:${input.chat}:${input.message}`;
    if (this.#store.get(identity) !== null) return;
    this.#store.transaction(() => {
      this.closeOutside(input.chat, input.group);
      const open = input.group && this.#rows().find(row => row.input.chat === input.chat && row.input.group === input.group && !row.input.closed);
      const pairing = this.#store.pairing();
      const saved = { ...input, ...(pairing ? { pairing } : {}) };
      if (open) {
        open.input.items!.push(saved);
        open.input.caption ||= input.caption;
        open.input.arrived = this.#clock.now().getTime();
        this.#store.set(open.key, JSON.stringify(open.input));
      } else {
        const sequence = Number(this.#store.get('media.sequence') ?? 0) + 1;
        this.#store.set('media.sequence', String(sequence));
        this.#store.set(`media.queue:${String(sequence).padStart(16, '0')}`, JSON.stringify({ ...saved,
          ...(input.group ? { items: [saved], closed: false, arrived: this.#clock.now().getTime() } : {}) }));
      }
      this.#store.set(identity, 'stored');
    });
    this.#wake.get(input.chat)?.();
    this.#start(input.chat);
  }
  closeOutside(chat: string, group?: string): void {
    for (const row of this.#rows()) if (row.input.chat === chat && row.input.group && row.input.group !== group && !row.input.closed) {
      row.input.closed = true;
      this.#store.set(row.key, JSON.stringify(row.input));
    }
    this.#wake.get(chat)?.();
  }
  recover(): void {
    for (const row of this.#rows()) {
      if (row.input.group && !row.input.closed) {
        row.input.arrived = this.#clock.now().getTime();
        this.#store.set(row.key, JSON.stringify(row.input));
      }
      this.#start(row.input.chat);
    }
  }
  #wait(chat: string, ms: number): Promise<void> {
    return new Promise(resolve => {
      const done = () => { this.#clock.clearTimeout(timer); this.#signal.removeEventListener('abort', done); this.#wake.delete(chat); resolve(); };
      const timer = this.#clock.setTimeout(done, ms); timer.unref();
      this.#wake.set(chat, done);
      this.#signal.addEventListener('abort', done, { once: true });
      if (this.#signal.aborted) done();
    });
  }
  #start(chat: string): void {
    if (this.#workers.has(chat) || this.#signal.aborted) return;
    const work = Promise.resolve().then(async () => {
      while (!this.#signal.aborted) {
        const row = this.#rows().find(row => row.input.chat === chat);
        if (!row) break;
        if (this.#store.pairing()?.chatId !== chat) { this.#store.set(row.key, null); continue; }
        if (row.input.group && !row.input.closed) {
          const remaining = 2_000 - (this.#clock.now().getTime() - row.input.arrived!);
          if (remaining > 0) { await this.#wait(chat, remaining); continue; }
          row.input.closed = true;
          this.#store.set(row.key, JSON.stringify(row.input));
        }
        try { await this.#process(row.input); }
        catch {
          if (this.#signal.aborted) break;
          await pause(this.#clock, this.#signal, 1_000);
          continue;
        }
        this.#store.transaction(() => {
          for (const item of row.input.items ?? [row.input]) this.#store.set(`media.identity:${item.chat}:${item.message}`, 'completed');
          this.#store.set(row.key, null);
        });
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
