import { clientSessionCredential, credentialActor } from './credential-actor.ts';
// One authenticated JSON-line request; shared by CLI and fixture admission.
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import { PROTOCOL_VERSION, parseFrame } from './protocol-frame.ts';
import type { Discovery } from './project-discovery.ts';
import { sessionOf } from './frame-actor.ts';
import { realClock, type Clock } from './clock.ts';
import { enforcedFeatures, requireHubFeatures } from './hub-features.ts';

export class HubTimeout extends Error {
  readonly timeoutMs: number;
  readonly requestSent: boolean;
  constructor(message: string, timeoutMs: number, requestSent = false) {
    super(message);
    this.timeoutMs = timeoutMs;
    this.requestSent = requestSent;
  }
}

/** A reply was received: keep its class separate from transport failures, preserving the old message. */
export class HubRefusal extends Error {
  readonly refusalCode: string | undefined;
  constructor(message: string, refusalCode?: string) { super(message); this.refusalCode = refusalCode; }
}

/** The frames that are a session's own plumbing (`cland hook`), not a call somebody makes: they carry no actor. */
const PLUMBING: ReadonlySet<string> = new Set(['session.signal', 'session.bridge']);

/**
 * One request frame of any type (its `id` is added here) over the socket. In a launched session's shell the frame
 * says whose it is (`as`, from `sessionOf`), unless the caller already named an actor.
 */
export function askHubFrame(d: Pick<Discovery, 'socket' | 'secret' | 'root'>, frame: { type: string } & Record<string, unknown>, timeoutMs = 3000, env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, requiredFeatures: readonly string[] = []): Promise<unknown> {
  return exchange(d, frame, timeoutMs, env, clock, requiredFeatures);
}

/** An authenticated welcome proves liveness without collecting a full status.
 * This handshake also works with older hubs that have no dedicated ping frame. */
export async function probeHub(d: Pick<Discovery, 'socket' | 'secret' | 'root'>, timeoutMs = 3000): Promise<void> {
  await exchange(d, null, timeoutMs, {}, realClock);
}

/** Read the hub's enforcement advertisement; old welcomes have no features. */
export async function hubEnforcedFeatures(d: Pick<Discovery, 'socket' | 'secret' | 'root'>, timeoutMs = 3000): Promise<string[]> {
  const welcome = await exchange(d, null, timeoutMs, {}, realClock) as Record<string, unknown>;
  return enforcedFeatures(welcome);
}

function exchange(d: Pick<Discovery, 'socket' | 'secret' | 'root'>, frame: ({ type: string } & Record<string, unknown>) | null, timeoutMs: number, env: NodeJS.ProcessEnv, clock: Clock, requiredFeatures: readonly string[] = []): Promise<unknown> {
  const session = frame && frame.as === undefined ? (PLUMBING.has(frame.type) ? credentialActor(d, env) : sessionOf(env)) : undefined;
  let request: ({ type: string } & Record<string, unknown>) | null = session && frame ? { ...frame, as: session } : frame;
  const actor = request?.as;
  if (actor && typeof actor === 'object' && !Object.hasOwn(actor, 'credential')) {
    const credential = clientSessionCredential(d, env);
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
          try { requireHubFeatures(frame, requiredFeatures); }
          catch (error) { done(error as Error); continue; }
          if (request === null) { done(null, frame); continue; }
          socket.write(`${JSON.stringify({ ...request, id })}\n`, error => { if (!error) requestSent = true; });
        }
        else if (frame.type === 'error') done(new HubRefusal(`the hub refused: ${String(frame.message)}`, typeof frame.code === 'string' ? frame.code : undefined));
        else if (frame.type === 'result' && frame.id === id) {
          if (frame.ok === true) done(null, frame.value);
          else done(new HubRefusal(String(frame.error), typeof frame.code === 'string' ? frame.code : undefined));
        }
      }
      if (!settled && start < chunk.length) parts.push(chunk.slice(start));
    });
    socket.on('error', (err) => done(err));
    socket.on('close', () => done(new Error(`the hub closed ${d.socket} before answering`)));
  });
}

