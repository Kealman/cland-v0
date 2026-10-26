import { frameClient } from '../harness.ts';
import type { HubFrame } from '../../src/protocol.ts';

/** A platform boundary only: requests and receipts use the existing frame protocol. */
export function testMessenger(id = 'test') {
  let send: ((frame: Record<string, unknown>) => void) | undefined;
  let receive!: (chunk: string) => void;
  let started = false;
  let stopped = false;
  const client = frameClient(line => {
    if (!send || stopped) throw new Error('test messenger is not running');
    send(JSON.parse(line) as Record<string, unknown>);
  }, fn => { receive = fn; }, () => {});
  return {
    id, client,
    get started() { return started; },
    get stopped() { return stopped; },
    start(request: (frame: Record<string, unknown>) => void) { send = request; started = true; },
    receive(frame: HubFrame) { receive(`${JSON.stringify(frame)}\n`); },
    stop() { stopped = true; },
  };
}
