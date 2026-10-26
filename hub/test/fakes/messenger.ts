import { frameClient } from '../harness.ts';
import type { HubFrame, RemoteVia } from '../../src/protocol.ts';
import type { Outbox } from '../../src/remote/outbox.ts';
import { outboxMessenger } from './outbox-messenger.ts';
import type { RemoteStatus } from '../../src/remote/gateway.ts';

export function testRemoteStates() {
  const rows = new Map<string, RemoteStatus>();
  return { forMessenger: (id: string) => ({
    status: () => ({ ...(rows.get(id) ?? { disabled: false, reason: null }) }),
    setStatus: (status: RemoteStatus) => { rows.set(id, { ...status }); },
  }) };
}

/** A platform boundary only: requests and receipts use the existing frame protocol. */
export function testMessenger(id = 'test', source: RemoteVia | { via?: RemoteVia; startError?: Error } = 'telegram') {
  const options: { via?: RemoteVia; startError?: Error } = typeof source === 'string' ? { via: source } : source;
  const via = options.via ?? 'telegram';
  let send: ((frame: Record<string, unknown>) => void) | undefined;
  let receive!: (chunk: string) => void;
  let outbox: Outbox | undefined;
  const delivery = outboxMessenger();
  let started = false;
  let stopped = false;
  let loop: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  let receiveFailure: { error: Error; type: string; async: boolean } | undefined;
  const client = frameClient(line => {
    if (!send || stopped) throw new Error('test messenger is not running');
    send(JSON.parse(line) as Record<string, unknown>);
  }, fn => { receive = fn; }, () => {});
  return {
    id, via, client, delivery,
    mirror(queue: Outbox) { outbox = queue; },
    get started() { return started; },
    get stopped() { return stopped; },
    get running() { return loop !== undefined && !stopped; },
    fail(error: Error) {
      if (!loop) throw new Error('test messenger run loop has not started');
      loop.reject(error);
    },
    failReceive(error: Error, type = 'message', async = false) { receiveFailure = { error, type, async }; },
    start(request: (frame: Record<string, unknown>) => void) {
      send = request; started = true;
      if (options.startError) throw options.startError;
    },
    receive(frame: HubFrame): void | Promise<void> {
      if (receiveFailure?.type === frame.type) {
        if (receiveFailure.async) return Promise.reject(receiveFailure.error);
        throw receiveFailure.error;
      }
      if (outbox && frame.type === 'message' && frame.message.topic === 'general') {
        outbox.enqueue({ kind: 'general', source: frame.message.id, payload: { text: frame.message.text } });
      }
      receive(`${JSON.stringify(frame)}\n`);
    },
    run() { loop = Promise.withResolvers<void>(); return loop.promise; },
    stop() { stopped = true; loop?.resolve(); return outbox?.stop(); },
  };
}
