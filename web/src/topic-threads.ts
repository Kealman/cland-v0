import type { AskCard, DeliveryStage, HubFrame, ThreadRun, TopicMessage } from '../../shared/wire/index.ts';

export type ThreadPage = { messages: TopicMessage[]; runs: ThreadRun[]; more?: boolean };
export type ThreadState = { messages: TopicMessage[]; runs: Record<string, ThreadRun>; loaded: boolean; loading: boolean; more: boolean; error?: string | undefined };
type Patch = { stage?: DeliveryStage; withdrawable?: boolean; ask?: AskCard };
const empty = (): ThreadState => ({ messages: [], runs: {}, loaded: false, loading: false, more: true });

/** One cache per connection: numeric pages merge by identity with newer live facts. */
export class TopicThreads {
  #threads = new Map<string, ThreadState>();
  #patches = new Map<string, Patch>();
  #generation = 0;
  private history: (topic: string, before?: number) => Promise<ThreadPage>;
  private changed: () => void;
  constructor(history: (topic: string, before?: number) => Promise<ThreadPage>, changed: () => void) { this.history = history; this.changed = changed; }
  get(topic: string): ThreadState { return this.#threads.get(topic) ?? empty(); }
  get generation(): number { return this.#generation; }
  reset() { this.#generation++; this.#threads.clear(); this.#patches.clear(); }
  async load(topic: string, earlier = false): Promise<void> {
    const current = this.get(topic);
    if (current.loading || (earlier ? !current.loaded || !current.more : current.loaded)) return;
    const generation = this.#generation;
    const before = earlier ? current.messages[0]?.seq : undefined;
    this.#threads.set(topic, { ...current, loading: true, error: undefined });
    this.changed();
    try {
      const page = await this.history(topic, before);
      if (generation !== this.#generation) return;
      const latest = this.get(topic);
      const messages = new Map(latest.messages.map(row => [row.id, row]));
      for (const row of page.messages) messages.set(row.id, { ...row, ...this.#patches.get(row.id) });
      // A new message can arrive while a history reply is held; it stays in the map.
      this.#threads.set(topic, { messages: [...messages.values()].sort((a, b) => a.seq - b.seq),
        runs: { ...Object.fromEntries(page.runs.map(run => [run.id, run])), ...latest.runs }, loaded: true, loading: false, more: !!page.more });
    } catch (error) {
      if (generation !== this.#generation) return;
      this.#threads.set(topic, { ...this.get(topic), loading: false, error: error instanceof Error ? error.message : 'History unavailable' });
    }
    this.changed();
  }
  apply(frame: HubFrame): boolean {
    if (frame.type === 'message') {
      const topic = frame.topic.id, current = this.get(topic);
      const messages = new Map(current.messages.map(row => [row.id, row]));
      messages.set(frame.message.id, { ...frame.message, ...this.#patches.get(frame.message.id) });
      this.#threads.set(topic, { ...current, messages: [...messages.values()].sort((a, b) => a.seq - b.seq),
        runs: frame.run ? { ...current.runs, [frame.run.id]: frame.run } : current.runs });
      return true;
    }
    if (frame.type === 'delivery' || frame.type === 'ask') {
      const id = frame.type === 'delivery' ? frame.message : frame.ask;
      const patch = { ...this.#patches.get(id), ...(frame.type === 'delivery' ? { stage: frame.stage, ...(frame.withdrawable !== undefined ? { withdrawable: frame.withdrawable } : {}) } : { ask: frame.card }) };
      this.#patches.set(id, patch);
      const current = this.get(frame.topic);
      this.#threads.set(frame.topic, { ...current, messages: current.messages.map(row => row.id === id ? { ...row, ...patch } : row) });
      return true;
    }
    if (frame.type === 'visibility' && 'rows' in frame) {
      for (const row of frame.rows.messages) {
        const current = this.#threads.get(row.topic);
        if (current) this.#threads.set(row.topic, { ...current, messages: current.messages.map(message => message.id === row.id ? { ...row, ...this.#patches.get(row.id) } : message) });
      }
      return true;
    }
    return false;
  }
}
