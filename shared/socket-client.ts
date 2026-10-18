// One authenticated JSON-line request; shared by CLI and fixture admission.
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import { PROTOCOL_VERSION, parseFrame } from './protocol-frame.ts';
import type { Discovery } from './project-discovery.ts';
import { sessionOf } from './frame-actor.ts';
import { realClock, type Clock } from './clock.ts';

export class HubTimeout extends Error {
  readonly timeoutMs: number;
  readonly requestSent: boolean;
  constructor(message: string, timeoutMs: number, requestSent = false) {
    super(message);
    this.timeoutMs = timeoutMs;
    this.requestSent = requestSent;
  }
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
    let requestSent = false;
    const done = (err: Error | null, value?: unknown) => {
      if (settled) return;
      settled = true;
      clock.clearTimeout(timer);
      socket.destroy();
      if (err) reject(err);
      else resolve(value);
    };
    const timer = clock.setTimeout(() => done(new HubTimeout(`the hub did not answer on ${d.socket} within ${timeoutMs} ms`, timeoutMs, requestSent)), timeoutMs);
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      const hello = { type: 'hello', protocol: PROTOCOL_VERSION, secret: d.secret, client: 'cli' };
      socket.write(`${JSON.stringify(hello)}\n`);
    });
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const frame = parseFrame(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (!frame) continue;
        if (frame.type === 'welcome') {
          socket.write(`${JSON.stringify({ ...request, id })}\n`, error => { if (!error) requestSent = true; });
        }
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

