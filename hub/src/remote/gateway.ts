import type { Conversation, Dispatcher } from '../hub/dispatch.ts';
import { PROTOCOL_VERSION, type HubFrame } from '../protocol.ts';

/** One active remote per messenger. The gateway owns its lifetime and frame port. */
export type Remote = {
  id: string;
  start: (send: (frame: Record<string, unknown>) => void) => void | Promise<void>;
  receive: (frame: HubFrame) => void;
  stop: () => void | Promise<void>;
};

/** An in-process edge: all remotes share one human dispatcher conversation. */
export class Gateway {
  readonly #dispatcher: Pick<Dispatcher, 'open'>;
  readonly #remotes: readonly Remote[];
  readonly #started: Remote[] = [];
  readonly #pending = new Map<string, { remote: Remote; id: string }>();
  #conversation: Conversation | undefined;
  #nextId = 0;
  #open = false;
  #closing = false;
  #starting: Promise<void> | undefined;
  #stopping: Promise<void> | undefined;

  constructor(dispatcher: Pick<Dispatcher, 'open'>, remotes: readonly Remote[]) {
    this.#dispatcher = dispatcher;
    this.#remotes = [...remotes];
  }

  start(): Promise<void> {
    if (this.#starting || this.#closing) return Promise.reject(new Error('gateway already started or stopped'));
    if (new Set(this.#remotes.map(remote => remote.id)).size !== this.#remotes.length) return Promise.reject(new Error('gateway requires one remote per messenger'));
    // Publish ownership before invoking a remote: even a synchronous callback may stop us.
    return this.#starting = Promise.resolve().then(() => this.#start());
  }

  async #start(): Promise<void> {
    for (const remote of this.#remotes) {
      if (this.#closing) throw new Error('gateway stopped during startup');
      // A partially started remote still owns resources that stop must drain.
      this.#started.push(remote);
      await remote.start(frame => {
        if (!this.#open) throw new Error('gateway is not running');
        const id = `gateway-${++this.#nextId}`;
        this.#pending.set(id, { remote, id: typeof frame.id === 'string' ? frame.id : '?' });
        this.#conversation!.receive(JSON.stringify({ ...frame, id }));
      });
    }
    if (this.#closing) throw new Error('gateway stopped during startup');
    // Start the dispatcher's hello deadline only once every remote has bound its port.
    this.#conversation = this.#dispatcher.open({
      isOpen: () => this.#open,
      // The lifetime owner still observes a stop failure through the retained promise.
      close: () => { void this.stop().catch(() => {}); },
      send: frame => {
        if (!this.#open) return;
        if (frame.type === 'result') {
          const pending = this.#pending.get(frame.id);
          if (!pending) return;
          this.#pending.delete(frame.id);
          pending.remote.receive({ ...frame, id: pending.id });
        } else {
          for (const remote of this.#remotes) remote.receive(frame);
        }
      },
    }, { authenticated: true, edge: 'gateway' });
    this.#open = true;
    this.#conversation.receive(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, client: 'human' }));
  }

  stop(): Promise<void> {
    this.#closing = true;
    this.#open = false;
    return this.#stopping ??= Promise.resolve().then(() => this.#stop());
  }

  async #stop(): Promise<void> {
    const failures: unknown[] = [];
    const attempt = async (run: () => unknown) => { try { await run(); } catch (error) { failures.push(error); } };
    await attempt(() => this.#conversation?.closed());
    // Startup cannot acquire another remote or conversation after the closing fence.
    // Join a held start before disposing anything it can still write or acquire.
    await this.#starting?.catch(() => {});
    for (const { remote, id } of this.#pending.values()) await attempt(() => remote.receive({ type: 'result', id, ok: false, error: 'gateway stopped before the answer' }));
    this.#pending.clear();
    for (const remote of this.#started) await attempt(() => remote.stop());
    if (failures.length) throw new AggregateError(failures, 'gateway shutdown failed');
  }
}
