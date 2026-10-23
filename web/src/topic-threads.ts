import type { AskCard, DeliveryStage, HubFrame, ThreadRun, TopicMessage } from '../../shared/wire/index.ts';

export type ThreadPage = { messages: TopicMessage[]; runs: ThreadRun[]; more?: boolean };
export type ThreadState = { messages: TopicMessage[]; runs: Record<string, ThreadRun>; loaded: boolean; loading: boolean; more: boolean; error?: string | undefined; errorAt?: 'recent' | 'earlier' | undefined };
type Patch = { stage?: DeliveryStage; withdrawable?: boolean; ask?: AskCard };
const empty = (): ThreadState => ({ messages: [], runs: {}, loaded: false, loading: false, more: true });

/** One cache per connection: numeric pages merge by identity with newer live facts. */
export class TopicThreads {
  #threads = new Map<string, ThreadState>();
  #patches = new Map<string, Patch>();
  #generation = 0;
  #revisions = new Map<string, number>();
  private history: (topic: string, before?: number) => Promise<ThreadPage>;
  private changed: () => void;
  private scope: 'topic' | 'session';
  constructor(history: (topic: string, before?: number) => Promise<ThreadPage>, changed: () => void, scope: 'topic' | 'session' = 'topic') { this.history = history; this.changed = changed; this.scope = scope; }
  get(topic: string): ThreadState { return this.#threads.get(topic) ?? empty(); }
  get generation(): number { return this.#generation; }
  reset() { this.#generation++; this.#threads.clear(); this.#patches.clear(); this.#revisions.clear(); }
  /** A new selection refreshes recent traffic and fences any earlier selection's reply. */
  refresh(topic: string): Promise<void> {
    this.#revisions.set(topic, (this.#revisions.get(topic) ?? 0) + 1);
    return this.load(topic, false, true);
  }
  async load(topic: string, earlier = false, refresh = false): Promise<void> {
    const current = this.get(topic);
    if (!refresh && (current.loading || (earlier ? !current.loaded || !current.more : current.loaded))) return;
    const generation = this.#generation;
    const revision = this.#revisions.get(topic);
    const before = earlier ? current.messages[0]?.seq : undefined;
    this.#threads.set(topic, { ...current, loading: true, error: undefined, errorAt: undefined });
    this.changed();
    try {
      const page = await this.history(topic, before);
      if (generation !== this.#generation || revision !== this.#revisions.get(topic)) return;
      const latest = this.get(topic);
      const messages = new Map(latest.messages.map(row => [row.id, row]));
      for (const row of page.messages) messages.set(row.id, { ...row, ...messages.get(row.id), ...this.#patches.get(row.id) });
      // A new message can arrive while a history reply is held; it stays in the map.
      // Refreshing another mounted view must not discard this view's older pages
      // or move its cursor past their already observed boundary.
      const retainedOlder = refresh && latest.loaded && latest.messages[0] && page.messages[0] && latest.messages[0].seq < page.messages[0].seq;
      this.#threads.set(topic, { messages: [...messages.values()].sort((a, b) => a.seq - b.seq),
        runs: { ...Object.fromEntries(page.runs.map(run => [run.id, run])), ...latest.runs }, loaded: true, loading: false, more: retainedOlder ? latest.more : !!page.more });
    } catch (error) {
      if (generation !== this.#generation || revision !== this.#revisions.get(topic)) return;
      this.#threads.set(topic, { ...this.get(topic), loading: false, error: error instanceof Error ? error.message : 'History unavailable', errorAt: earlier ? 'earlier' : 'recent' });
    }
    this.changed();
  }
  apply(frame: HubFrame): boolean {
    if (frame.type === 'message') {
      const topics = this.scope === 'session' ? [...this.#threads.keys()].filter(session => frame.message.from === session || frame.message.to.includes(session)) : [frame.topic.id];
      for (const topic of topics) {
        const current = this.get(topic);
        const messages = new Map(current.messages.map(row => [row.id, row]));
        messages.set(frame.message.id, { ...frame.message, ...this.#patches.get(frame.message.id) });
        this.#threads.set(topic, { ...current, messages: [...messages.values()].sort((a, b) => a.seq - b.seq),
          runs: this.scope === 'topic' && frame.run ? { ...current.runs, [frame.run.id]: frame.run } : current.runs });
      }
      return true;
    }
    if (frame.type === 'delivery' || frame.type === 'ask') {
      const id = frame.type === 'delivery' ? frame.message : frame.ask;
      const patch = { ...this.#patches.get(id), ...(frame.type === 'delivery' ? { stage: frame.stage, ...(frame.withdrawable !== undefined ? { withdrawable: frame.withdrawable } : {}) } : { ask: frame.card }) };
      this.#patches.set(id, patch);
      for (const topic of this.scope === 'session' ? this.#threads.keys() : [frame.topic]) {
        const current = this.get(topic);
        this.#threads.set(topic, { ...current, messages: current.messages.map(row => row.id === id ? { ...row, ...patch } : row) });
      }
      return true;
    }
    if (frame.type === 'visibility' && 'rows' in frame) {
      for (const row of frame.rows.messages) {
        for (const topic of this.scope === 'session' ? this.#threads.keys() : [row.topic]) {
          const current = this.#threads.get(topic);
          if (current) this.#threads.set(topic, { ...current, messages: current.messages.map(message => message.id === row.id ? { ...row, ...this.#patches.get(row.id) } : message) });
        }
      }
      return true;
    }
    return false;
  }
}
