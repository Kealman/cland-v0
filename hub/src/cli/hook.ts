// `cland hook <event>`: what a launched session's harness runs from inside the session — its hooks and the cland
// mod — to tell the hub what is happening (spec 4.3, 4.9). It posts one `session.signal` over the hub's Unix
// socket and exits; it never fails the harness (exit 0 whatever happened, a note on stderr).
//
//   cland hook <event> --session <name> [--launch <id>] [--hub-file <.cland/hub.json>]   the harness's JSON payload on stdin
//   cland hook bridge  --session <name> [--launch <id>] [--hub-file <.cland/hub.json>]   the mod's bridge: stays
//                                                       connected, prints each inject frame as a JSON line
//
// `--launch` is the cland session id the hub launched the session with: the hub ignores what an earlier
// launch under the same name still sends.
import { createConnection, type Socket } from 'node:net';
import { PROTOCOL_VERSION, parseFrame, type ClientHello } from '../protocol.ts';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';

export const HOOK_USAGE = `  hook <event>    from inside a launched session (its hooks, the cland mod): post a signal to the hub
                  --session <name> --launch <id> --hub-file <path>; the harness's JSON payload on stdin
`;

/** The payload fields the hub reads; the prompt itself never leaves the session, only the message ids it carries. */
const KEPT = ['session_id', 'hook_event_name', 'tool_name', 'notification_type', 'model', 'source', 'reason', 'message', 'usage', 'isAborted', 'ids'] as const;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function readStdin(timeoutMs: number): Promise<string> {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve) => {
    let data = '';
    const done = () => {
      clearTimeout(timer);
      process.stdin.removeAllListeners();
      process.stdin.pause();
      resolve(data);
    };
    const timer = setTimeout(done, timeoutMs);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => (data += chunk));
    process.stdin.once('end', done);
    process.stdin.once('error', done);
  });
}

/** The signal's payload: the kept fields, with a prompt's text reduced to the cland message ids it carries. */
export function signalPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const k of KEPT) if (raw[k] !== undefined) payload[k] = raw[k];
  const text = typeof raw.prompt === 'string' ? raw.prompt : typeof raw.text === 'string' ? raw.text : null;
  if (text !== null) payload.ids = [...text.matchAll(/<channel source="cland"[^>]* msg_id="([^"]+)"/g)].map((m) => m[1]);
  return payload;
}

function discovery(args: string[]) {
  const file = flag(args, '--hub-file') ?? hubDiscovery(process.cwd());
  return file ? { file, d: readDiscovery(file) } : { file: null, d: null };
}

/**
 * When the harness fired the event: this process's start. The hub orders a session's signals by it, and a
 * hook's process takes hundreds of milliseconds to start on a loaded machine — longer than a short turn — so
 * a time read once the process runs would let an older Stop that started slowly outrank a newer turn's start.
 * The mod passes the event's own time as `at` in the payload, which wins.
 */
export const startedAt = (): number => Math.floor(performance.timeOrigin);

async function post(event: string, args: string[]): Promise<number> {
  const at = startedAt();
  const session = flag(args, '--session') ?? process.env.CLAND_SESSION_NAME;
  const launch = flag(args, '--launch');
  let raw: Record<string, unknown> = {};
  const input = await readStdin(2000);
  if (input.trim()) {
    try {
      const v: unknown = JSON.parse(input);
      if (typeof v === 'object' && v !== null) raw = v as Record<string, unknown>;
    } catch {
      process.stderr.write(`cland hook ${event}: the payload on stdin is not JSON; posting without it\n`);
    }
  }
  const { file, d } = discovery(args);
  if (!d) {
    process.stderr.write(`cland hook ${event}: no running hub (${file ?? 'no .cland/hub.json found'})\n`);
    return 0;
  }
  const payload = signalPayload(raw);
  const sessionId = typeof raw.session_id === 'string' ? raw.session_id : undefined;
  try {
    await askHubFrame(d, { type: 'session.signal', event, at: typeof raw.at === 'number' ? raw.at : at, payload, ...(session ? { session } : {}), ...(launch ? { launch } : {}), ...(sessionId ? { sessionId } : {}) }, 3000);
  } catch (err) {
    process.stderr.write(`cland hook ${event}: ${err instanceof Error ? err.message : String(err)}\n`);
  }
  return 0;
}

/**
 * The mod's bridge: one client connection that asks for the session's inject frames and prints each as a JSON
 * line. It reconnects (reading `hub.json` again: a restarted hub has a new socket and secret) until its stdout
 * closes or its parent — the harness — is gone.
 */
async function bridge(args: string[]): Promise<number> {
  const session = flag(args, '--session') ?? process.env.CLAND_SESSION_NAME;
  if (!session) {
    process.stderr.write('cland hook bridge: --session is required\n');
    return 2;
  }
  const launch = flag(args, '--launch');
  const parent = process.ppid;
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.stdout.on('error', stop);
  const parentWatch = setInterval(() => {
    if (process.ppid !== parent) stop();
  }, 1000);
  while (!stopped) {
    const { d } = discovery(args);
    if (d) await bridgeOnce(d, session, launch, () => stopped);
    if (!stopped) await new Promise((r) => setTimeout(r, 500));
  }
  clearInterval(parentWatch);
  return 0;
}

function bridgeOnce(d: { socket: string; secret: string }, session: string, launch: string | undefined, isStopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    let socket: Socket;
    try {
      socket = createConnection(d.socket);
    } catch {
      resolve();
      return;
    }
    let buffer = '';
    const check = setInterval(() => {
      if (isStopped()) socket.destroy();
    }, 500);
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      const hello: ClientHello = { type: 'hello', protocol: PROTOCOL_VERSION, secret: d.secret, client: 'mod-bridge' };
      socket.write(`${JSON.stringify(hello)}\n`);
    });
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const frame = parseFrame(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (!frame) continue;
        if (frame.type === 'welcome') socket.write(`${JSON.stringify({ type: 'session.bridge', id: 'bridge', session, ...(launch ? { launch } : {}) })}\n`);
        else if (frame.type === 'result' && frame.id === 'bridge') {
          if (frame.ok === true) process.stdout.write(`${JSON.stringify({ type: 'bridged', session })}\n`);
          else {
            process.stderr.write(`cland hook bridge: ${String(frame.error)}\n`);
            socket.destroy();
          }
        } else if (frame.type === 'inject') process.stdout.write(`${JSON.stringify(frame)}\n`);
        else if (frame.type === 'error') socket.destroy();
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      clearInterval(check);
      resolve();
    });
  });
}

export async function runHook(args: string[]): Promise<number> {
  const [event, ...rest] = args;
  if (!event) {
    process.stderr.write(`usage: cland hook <event> --session <name> [--hub-file <path>]\n`);
    return 2;
  }
  if (event === 'bridge') return bridge(rest);
  return post(event, rest);
}
