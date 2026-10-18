// The CLI's side of the hub's Unix socket: connect, hello with the secret, one request, close.
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import { PROTOCOL_VERSION, parseFrame, type ClientHello, type ClientRequest, type HubStatus } from '../protocol.ts';
import type { Discovery } from '../project.ts';
import { sessionOf } from './actor.ts';
import { realClock, type Clock } from '../hub/clock.ts';

export class HubTimeout extends Error {}

/** One request over the socket; rejects on a refusal, an error result, a closed socket or the timeout. */
export function askHub(d: Pick<Discovery, 'socket' | 'secret'>, type: ClientRequest['type'], timeoutMs = 3000): Promise<unknown> {
  return askHubFrame(d, { type }, timeoutMs);
}

/** The frames that are a session's own plumbing (`cland hook`), not a call somebody makes: they carry no actor. */
const PLUMBING: ReadonlySet<string> = new Set(['session.signal', 'session.bridge']);

/**
 * One request frame of any type (its `id` is added here) over the socket. In a launched session's shell the frame
 * says whose it is (`as`, from `sessionOf`), unless the caller already named an actor.
 */
export function askHubFrame(d: Pick<Discovery, 'socket' | 'secret'>, frame: { type: string } & Record<string, unknown>, timeoutMs = 3000, env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock): Promise<unknown> {
  const session = frame.as === undefined && !PLUMBING.has(frame.type) ? sessionOf(env) : undefined;
  const request = session ? { ...frame, as: session } : frame;
  return new Promise((resolve, reject) => {
    const socket = createConnection(d.socket);
    const id = randomUUID();
    let buffer = '';
    let settled = false;
    const done = (err: Error | null, value?: unknown) => {
      if (settled) return;
      settled = true;
      clock.clearTimeout(timer);
      socket.destroy();
      if (err) reject(err);
      else resolve(value);
    };
    const timer = clock.setTimeout(() => done(new HubTimeout(`the hub did not answer on ${d.socket} within ${timeoutMs} ms`)), timeoutMs);
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      const hello: ClientHello = { type: 'hello', protocol: PROTOCOL_VERSION, secret: d.secret, client: 'cli' };
      socket.write(`${JSON.stringify(hello)}\n`);
    });
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const frame = parseFrame(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (!frame) continue;
        if (frame.type === 'welcome') socket.write(`${JSON.stringify({ ...request, id })}\n`);
        else if (frame.type === 'error') done(new Error(`the hub refused: ${String(frame.message)}`));
        else if (frame.type === 'result' && frame.id === id) {
          if (frame.ok === true) done(null, frame.value);
          else done(new Error(String(frame.error)));
        }
      }
    });
    socket.on('error', (err) => done(err));
    socket.on('close', () => done(new Error(`the hub closed ${d.socket} before answering`)));
  });
}

/** The hub's status, or null when nothing answers on the socket. */
export async function probe(d: Pick<Discovery, 'socket' | 'secret'>, timeoutMs?: number): Promise<HubStatus | null> {
  try {
    return (await askHub(d, 'hub.status', timeoutMs)) as HubStatus;
  } catch {
    return null;
  }
}
