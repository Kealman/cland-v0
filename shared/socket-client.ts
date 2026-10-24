// One authenticated JSON-line request; shared by CLI and fixture admission.
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import { PROTOCOL_VERSION, parseFrame } from './protocol-frame.ts';
import type { Discovery } from './project-discovery.ts';
import { dirname, join } from 'node:path';
import { readSessionCredential } from './session-credential.ts';
import { hubDiscovery } from './project-discovery.ts';
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
export function askHubFrame(d: Pick<Discovery, 'socket' | 'secret' | 'root'>, frame: { type: string } & Record<string, unknown>, timeoutMs = 3000, env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock): Promise<unknown> {
  return exchange(d, frame, timeoutMs, env, clock);
}

/** An authenticated welcome proves liveness without collecting a full status.
 * This handshake also works with older hubs that have no dedicated ping frame. */
export async function probeHub(d: Pick<Discovery, 'socket' | 'secret' | 'root'>, timeoutMs = 3000): Promise<void> {
  await exchange(d, null, timeoutMs, {}, realClock);
}

function exchange(d: Pick<Discovery, 'socket' | 'secret' | 'root'>, frame: ({ type: string } & Record<string, unknown>) | null, timeoutMs: number, env: NodeJS.ProcessEnv, clock: Clock): Promise<unknown> {
  const session = frame && frame.as === undefined && !PLUMBING.has(frame.type) ? sessionOf(env) : undefined;
  let request: ({ type: string } & Record<string, unknown>) | null = session && frame ? { ...frame, as: session } : frame;
  const actor = request?.as;
  if (actor && typeof actor === 'object' && !Object.hasOwn(actor, 'credential')) {
    const own = sessionOf(env);
    const clandDir = d.root ? join(d.root, '.cland') : dirname(hubDiscovery(process.cwd(), env));
    const credential = env.CLAND_LAUNCH_TOKEN !== undefined ? env.CLAND_LAUNCH_TOKEN
      : own?.sessionId ? readSessionCredential(clandDir, own.sessionId) : undefined;
    if (credential !== undefined && request) request = { ...request, as: { ...actor, credential } };
  }
  return new Promise((resolve, reject) => {
    const socket = createConnection(d.socket);
    const id = randomUUID();
    // Keep incomplete lines as chunks. Scanning/flattening an accumulated string
    // on every read makes large status replies quadratic in their byte count.
    let parts: string[] = [];
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
      let start = 0;
      let nl: number;
      while (!settled && (nl = chunk.indexOf('\n', start)) >= 0) {
        parts.push(chunk.slice(start, nl));
        const frame = parseFrame(parts.join(''));
        parts = [];
        start = nl + 1;
        if (!frame) continue;
        if (frame.type === 'welcome') {
          if (request === null) { done(null); continue; }
          socket.write(`${JSON.stringify({ ...request, id })}\n`, error => { if (!error) requestSent = true; });
        }
        else if (frame.type === 'error') done(new Error(`the hub refused: ${String(frame.message)}`));
        else if (frame.type === 'result' && frame.id === id) {
          if (frame.ok === true) done(null, frame.value);
          else done(new Error(String(frame.error)));
        }
      }
      if (!settled && start < chunk.length) parts.push(chunk.slice(start));
    });
    socket.on('error', (err) => done(err));
    socket.on('close', () => done(new Error(`the hub closed ${d.socket} before answering`)));
  });
}

