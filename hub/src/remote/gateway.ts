import type { Conversation, Dispatcher } from '../hub/dispatch.ts';
import { PROTOCOL_VERSION, type HubFrame, type RemoteVia, type RemoteConnection, type TopicMessage } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { remoteRedactor, redactFrame, redactHubFrame, redactValue, type RemoteRedactor } from './redact.ts';
import type { GatewayLease } from './poller-lease.ts';
import type { PairingCodes } from './pairing.ts';
import type { Pairing } from './state.ts';
import { remoteStopCause } from './notices.ts';
import { gatewayInbox } from './authority.ts';
import { createHash } from 'node:crypto';

/** Trusted native identity, carried separately from the frame and scoped by messenger. */
export type RemoteIngress = { chatId: string; messageId: string };
export type RemoteSend = (frame: Record<string, unknown>, ingress?: RemoteIngress, bytes?: readonly Buffer[]) => void;
export type RemoteBatch = (write: () => void) => void;
export type RemoteReceipt = (ingress: RemoteIngress) => TopicMessage | null;

function inputId(via: RemoteVia, ingress: RemoteIngress): string {
  return `remote-${createHash('sha256').update(JSON.stringify([via, ingress.chatId, ingress.messageId])).digest('hex')}`;
}

/** One active remote per messenger. The gateway owns its lifetime and frame port. */
export type Remote = {
  id: string;
  via: RemoteVia;
  /** Optional lifetime signal is aborted before the gateway joins an in-flight start. */
  start: (send: RemoteSend, pair?: (identity: Pairing) => string | null, signal?: AbortSignal, receipt?: RemoteReceipt, batch?: RemoteBatch) => void | Promise<void>;
  receive: (frame: HubFrame) => void | Promise<void>;
  /** Successful platform exchanges, never inferred from starting a loop. */
  status?: () => RemoteConnection;
  /** Optional native connection transitions; older injected clients remain supported. */
  subscribe?: (changed: () => void) => () => void;
  /** Validate the token, then send exactly one line when a destination is paired. */
  test?: (pairing: Pairing | null, text: string) => void | Promise<void>;
  /** Notify the adapter after local approval commits; absent on older remotes. */
  pairingApproved?: (pairing: Pairing) => void | Promise<void>;
  /** Send one line to the captured old destination, never the newly paired chat. */
  pairingReplaced?: (previous: Pairing, text: string) => void | Promise<void>;
  /** Lifetime promise for the platform loop; stop must settle it and drain its writers. */
  run?: () => Promise<void>;
  /** Mark configuration removal before stop; absent on older adapters. */
  disable?: () => void;
  stop: () => void | Promise<void>;
};

export type { RemoteStatus } from './state.ts';
import type { RemoteStatus } from './state.ts';
export type RemoteStates = {
  forMessenger: (id: string) => {
    status: () => RemoteStatus;
    setStatus: (status: RemoteStatus) => void;
  };
};

export type GatewayOptions = { changed?: () => void; pairing?: Pick<PairingCodes, 'issue'>; lease?: GatewayLease; state?: RemoteStates; log?: LogFn; redact?: (text: string) => string };

/** An in-process edge: all remotes share one human dispatcher conversation. */
export class Gateway {
  readonly #lease: GatewayLease | undefined;
  readonly #pairing: Pick<PairingCodes, 'issue'> | undefined;
  readonly #leaseAbort = new AbortController();
  readonly #dispatcher: Pick<Dispatcher, 'open'>;
  readonly #remotes: readonly Remote[];
  readonly #started: Remote[] = [];
  readonly #pending = new Map<string, { remote: Remote; id: string }>();
  readonly #disabled = new Set<Remote>();
  readonly #stops = new Map<Remote, Promise<void>>();
  readonly #work = new Set<Promise<void>>();
  readonly #state: RemoteStates;
  readonly #log: LogFn;
  readonly #redact: (text: string) => string;
  readonly #output: RemoteRedactor['value'];
  readonly #hubOutput: (frame: HubFrame) => HubFrame;
  readonly #changed: () => void;
  readonly #unsubscribers: Array<() => void> = [];
  #conversation: Conversation | undefined;
  #nextId = 0;
  #open = false;
  #closing = false;
  #starting: Promise<void> | undefined;
  #stopping: Promise<void> | undefined;

  constructor(dispatcher: Pick<Dispatcher, 'open'>, remotes: readonly Remote[], options: GatewayOptions = {}) {
    this.#dispatcher = dispatcher;
    this.#changed = options.changed ?? (() => {});
    this.#remotes = [...remotes];
    this.#lease = options.lease;
    this.#pairing = options.pairing;
    const statuses = new Map<string, RemoteStatus>();
    this.#state = options.state ?? { forMessenger: id => ({
      status: () => ({ ...(statuses.get(id) ?? { disabled: false, reason: null }) }),
      setStatus: status => { statuses.set(id, { ...status }); },
    }) };
    this.#redact = options.redact ?? remoteRedactor();
    // Previous callers may still supply a plain diagnostic function.
    const registered = this.#redact as Partial<RemoteRedactor>;
    const text = Object.hasOwn(registered, 'text') && typeof registered.text === 'function' ? registered.text : this.#redact;
    this.#output = input => redactFrame(input, text);
    this.#hubOutput = frame => redactHubFrame(frame, text);
    this.#log = entry => options.log?.(redactValue(entry, text));
  }

  start(): Promise<void> {
    if (this.#starting || this.#closing) return Promise.reject(new Error('gateway already started or stopped'));
    if (new Set(this.#remotes.map(remote => remote.id)).size !== this.#remotes.length) return Promise.reject(new Error('gateway requires one remote per messenger'));
    // Publish ownership before invoking a remote: even a synchronous callback may stop us.
    return this.#starting = Promise.resolve().then(() => this.#start());
  }

  async #start(): Promise<void> {
    try { await this.#lease?.acquire(this.#leaseAbort.signal); }
    catch (error) {
      if (this.#closing) throw error;
      // No platform has started. Disable the gateway's remotes, preserving the
      // existing owner and every other hub edge; there is nothing here to stop.
      for (const remote of this.#remotes) this.#disable(remote, error);
      return;
    }
    for (const remote of this.#remotes) {
      if (this.#closing) throw new Error('gateway stopped during startup');
      // A partially started remote still owns resources that stop must drain.
      this.#started.push(remote);
      if (remote.subscribe) this.#unsubscribers.push(remote.subscribe(this.#changed));
      this.#state.forMessenger(remote.id).setStatus({ disabled: false, reason: null });
      try {
        await remote.start((frame, ingress, bytes) => {
          if (!this.#open || this.#disabled.has(remote)) throw new Error('gateway is not running');
          const id = `gateway-${++this.#nextId}`;
          this.#pending.set(id, { remote, id: typeof frame.id === 'string' ? frame.id : '?' });
          const messageId = ingress ? inputId(remote.via, ingress) : undefined;
          try {
            const metadata = bytes && frame.type === 'artifact.upload' && Array.isArray(frame.files)
              ? { ...frame, files: frame.files.map(file => { const { data, ...rest } = file as Record<string, unknown>; return rest; }) } : frame;
            this.#conversation!.receive(JSON.stringify(this.#output({ ...metadata, id })), remote.via, messageId, bytes);
          }
          catch (error) { this.#disable(remote, error); throw new Error(this.#reason(error)); }
        }, this.#pairing ? identity => {
          if (!this.#open || this.#disabled.has(remote)) throw new Error('gateway is not running');
          try {
            // The display name is content; numeric identity stays routing and may never be rewritten.
            const safe = this.#output({ userId: identity.userId, chatId: identity.chatId, guildId: identity.guildId, text: identity.name });
            const reply = this.#pairing!.issue(remote.via, { userId: safe.userId, chatId: safe.chatId, guildId: safe.guildId, name: safe.text });
            return reply === null ? null : this.#output({ text: reply }).text;
          } catch (error) { this.#disable(remote, error); throw new Error(this.#reason(error)); }
        } : undefined, this.#leaseAbort.signal, identity => {
          if (!this.#open || this.#disabled.has(remote)) return null;
          const message = this.#conversation?.messageReceipt?.(inputId(remote.via, identity), remote.via);
          return message?.fromKind === 'human' && message.via === remote.via ? this.#output(message) : null;
        }, write => {
          if (!this.#open || this.#disabled.has(remote)) throw new Error('gateway is not running');
          if (this.#conversation?.commitBatch) this.#conversation.commitBatch(write);
          else write(); // Previous dispatchers retain individual commits.
        });
      } catch (error) {
        this.#disable(remote, error);
      }
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
          this.#receive(pending.remote, { ...frame, id: pending.id });
        } else {
          for (const remote of this.#started) this.#receive(remote, frame);
        }
      },
    }, { authenticated: true, edge: 'gateway' });
    this.#open = true;
    this.#changed();
    this.#conversation.receive(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, client: 'human' }));
    for (const remote of this.#started) {
      if (this.#closing || this.#disabled.has(remote) || !remote.run) continue;
      try { this.#observe(remote, remote.run()); }
      catch (error) { this.#disable(remote, error); }
    }
  }

  #observe(remote: Remote, work: Promise<void>): void {
    const observed = work.catch(error => { this.#disable(remote, error); });
    this.#work.add(observed);
    void observed.then(() => { this.#work.delete(observed); });
  }

  async test(messenger: RemoteVia, pairing: Pairing | null): Promise<void> {
    const remote = this.#started.find(remote => remote.via === messenger);
    if (!this.#open || this.#closing || !remote || this.#disabled.has(remote) || !remote.test)
      throw new Error('messenger test is unavailable; enable it with a token and a supported client');
    const safe = this.#output({ userId: pairing?.userId ?? null, chatId: pairing?.chatId ?? null,
      guildId: pairing?.guildId ?? null, text: pairing?.name ?? '', note: 'cland remote test' });
    const destination = pairing ? { userId: safe.userId!, chatId: safe.chatId!, guildId: safe.guildId, name: safe.text } : null;
    const work = Promise.resolve().then(() => remote.test!(destination, safe.note)).catch(error => {
      this.#disable(remote, error);
      throw new Error(this.#reason(error));
    });
    this.#observe(remote, work);
    await work;
  }

  status(messenger: RemoteVia): RemoteConnection {
    const remote = this.#started.find(remote => remote.via === messenger);
    if (!this.#open || !remote || !remote.status)
      return { connected: false, lastInbound: null, lastOutbound: null, botLink: null };
    try { return { ...remote.status(), ...(this.#disabled.has(remote) ? { connected: false } : {}) }; }
    catch (error) { this.#disable(remote, error); return { connected: false, lastInbound: null, lastOutbound: null, botLink: null }; }
  }

  /** A local reload retries runtime/startup failures even with unchanged configuration. */
  needsRestart(): boolean { return this.#disabled.size > 0; }

  pairingApproved(messenger: RemoteVia, pairing: Pairing): void {
    const remote = this.#started.find(remote => remote.via === messenger);
    if (!this.#open || !remote || this.#disabled.has(remote) || !remote.pairingApproved) return;
    try {
      const safe = this.#output({ userId: pairing.userId, chatId: pairing.chatId, guildId: pairing.guildId, text: pairing.name });
      const work = remote.pairingApproved({ userId: safe.userId, chatId: safe.chatId, guildId: safe.guildId, name: safe.text });
      if (work) this.#observe(remote, work);
    } catch (error) { this.#disable(remote, error); }
  }

  pairingReplaced(messenger: RemoteVia, previous: Pairing): void {
    const remote = this.#started.find(remote => remote.via === messenger);
    if (!this.#open || !remote || this.#disabled.has(remote) || !remote.pairingReplaced) {
      this.#log({ event: 'remote-pairing-notice-unavailable', remote: messenger });
      return;
    }
    try {
      const safe = this.#output({ userId: previous.userId, chatId: previous.chatId, guildId: previous.guildId, text: previous.name, note: 'This project is now paired with another chat.' });
      const work = remote.pairingReplaced({ userId: safe.userId, chatId: safe.chatId, guildId: safe.guildId, name: safe.text }, safe.note);
      if (work) this.#observe(remote, work);
    } catch (error) { this.#disable(remote, error); }
  }

  #receive(remote: Remote, frame: HubFrame): void {
    if (this.#disabled.has(remote)) return;
    if (frame.type === 'inbox') frame = { ...frame, inbox: gatewayInbox(frame.inbox) };
    if (frame.type === 'snapshot' && frame.domain === 'inbox') frame = { ...frame, value: gatewayInbox(frame.value) };
    try {
      const work = remote.receive(this.#hubOutput(frame));
      if (work) this.#observe(remote, work);
    }
    catch (error) { this.#disable(remote, error); }
  }

  #disable(remote: Remote, error: unknown): void {
    if (this.#disabled.has(remote)) return;
    this.#disabled.add(remote);
    for (const [id, pending] of this.#pending) if (pending.remote === remote) this.#pending.delete(id);
    const reason = this.#reason(error);
    const stopCause = remoteStopCause(error);
    this.#state.forMessenger(remote.id).setStatus({ disabled: true, reason, ...(stopCause ? { stopCause } : {}) });
    this.#changed();
    this.#log({ event: 'remote-disabled', remote: remote.id, reason });
    if (!this.#started.includes(remote)) return;
    // Keep ownership of partial startup and runtime resources through their stop receipt.
    void this.#stopRemote(remote).catch(error => {
      // stopRemote has already replaced the original error with a sanitized Error.
      this.#log({ event: 'remote-stop-failed', remote: remote.id, reason: error.message });
    });
  }

  #reason(error: unknown): string {
    return this.#redact(error instanceof Error ? error.message : String(error));
  }

  #stopRemote(remote: Remote): Promise<void> {
    let stopping = this.#stops.get(remote);
    if (!stopping) {
      stopping = Promise.resolve().then(() => remote.stop()).catch(error => { throw new Error(this.#reason(error)); });
      this.#stops.set(remote, stopping);
    }
    return stopping;
  }

  stop(): Promise<void> {
    this.#closing = true;
    this.#open = false;
    this.#leaseAbort.abort();
    return this.#stopping ??= Promise.resolve().then(() => this.#stop());
  }

  async #stop(): Promise<void> {
    const failures: unknown[] = [];
    const attempt = async (run: () => unknown) => { try { await run(); } catch (error) { failures.push(error); } };
    await attempt(() => this.#conversation?.closed());
    // Startup cannot acquire another remote or conversation after the closing fence.
    // Join a held start before disposing anything it can still write or acquire.
    await this.#starting?.catch(() => {});
    for (const { remote, id } of this.#pending.values()) this.#receive(remote, { type: 'result', id, ok: false, error: 'gateway stopped before the answer' });
    this.#pending.clear();
    for (const remote of this.#started) await attempt(() => this.#stopRemote(remote));
    await Promise.all(this.#work);
    // Incomplete drainage may leave a token consumer; keep its durable owner.
    for (const unsubscribe of this.#unsubscribers.splice(0)) unsubscribe();
    this.#changed();
    if (!failures.length) await attempt(() => this.#lease?.release());
    if (failures.length) throw new AggregateError(failures, 'gateway shutdown failed');
  }
}
