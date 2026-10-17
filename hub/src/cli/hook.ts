// `cland hook <event>`: what a launched session's harness runs from inside the session — its hooks and the cland
// mod — to tell the hub what is happening (spec 4.3, 4.9). It posts one `session.signal` over the hub's Unix
// socket and exits; it never fails the harness (exit 0 whatever happened, a note on stderr).
//
//   cland hook <event> --session <name> [--launch <id>] [--hub-file <.cland/hub.json>]   the harness's JSON payload on stdin
//   cland hook bridge  --session <name> [--launch <id>] [--hub-file <.cland/hub.json>]   the mod's bridge: stays
//                                                       connected, prints each inject frame as a JSON line
//
//   cland hook worktree-create --session <name> --worktree <path> [--launch <id>] [--hub-file <path>]
//                                                       Claude Code's WorktreeCreate hook in a session launched
//                                                       with an item: refuses (exit 2), naming the session's own
//                                                       worktree, and tells the hub (T-20 decision D8)
//
// `--launch` is the cland session id the hub launched the session with: the hub ignores what an earlier
// launch under the same name still sends.
import { createConnection, type Socket } from 'node:net';
import { PROTOCOL_VERSION, parseFrame, type ClientHello } from '../protocol.ts';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { bridgeGraceMs } from './hook-timing.ts';
import { askHubFrame } from './socket-client.ts';

export { HOOK_USAGE } from './usage.ts';

/** The payload fields the hub reads; the prompt itself never leaves the session, only the message ids it carries. */
const KEPT = ['session_id', 'prompt_id', 'hook_event_name', 'tool_name', 'notification_type', 'agent_id', 'agent_type', 'model', 'source', 'reason', 'message', 'usage', 'isAborted', 'ids', 'error', 'error_details', 'rateLimits'] as const;

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
  // Display only the Bash command for a permission prompt, never its other tool input fields.
  const input = raw.tool_input;
  if (raw.hook_event_name === 'PermissionRequest' && raw.tool_name === 'Bash' && input && typeof input === 'object' && 'command' in input && typeof input.command === 'string') {
    payload.approvalCommand = input.command;
  } else if (raw.hook_event_name === 'PermissionRequest' && typeof raw.tool_name === 'string' && raw.tool_name !== 'AskUserQuestion') {
    payload.approvalCommand = raw.tool_name;
  }
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
 * closes, its parent — the harness — is gone, or its hub has been unavailable for 60 seconds.
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
  // A hook may first run after its launching parent has already exited. Parent
  // identity alone then stays at PID 1 forever; bound missing/refused/silent hubs too.
  let unavailable: ReturnType<typeof setTimeout> | undefined;
  const retryGrace = () => { unavailable ??= setTimeout(() => {
    process.stdout.write(`${JSON.stringify({ type: 'bridge-expired' })}\n`);
    stop();
  }, bridgeGraceMs(process.env)); };
  const connected = () => { clearTimeout(unavailable); unavailable = undefined; };
  retryGrace();
  process.stdout.on('error', stop);
  const parentWatch = setInterval(() => {
    if (process.ppid !== parent) stop();
  }, 1000);
  while (!stopped) {
    const { d } = discovery(args);
    if (d) await bridgeOnce(d, session, launch, () => stopped, connected);
    retryGrace();
    if (!stopped) await new Promise((r) => setTimeout(r, 500));
  }
  clearInterval(parentWatch);
  clearTimeout(unavailable);
  process.stdout.off('error', stop);
  return 0;
}

function bridgeOnce(d: { socket: string; secret: string }, session: string, launch: string | undefined, isStopped: () => boolean, connected: () => void): Promise<void> {
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
          if (frame.ok === true) {
            connected();
            process.stdout.write(`${JSON.stringify({ type: 'bridged', session })}\n`);
          }
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

/**
 * The harness asked for a worktree of its own: refused, with the session's own named on stderr (what the harness
 * shows the model), and recorded at the hub. The only hook that fails the harness: that is its whole point.
 */
async function refuseWorktree(args: string[]): Promise<number> {
  const at = startedAt();
  const session = flag(args, '--session') ?? process.env.CLAND_SESSION_NAME;
  const worktree = flag(args, '--worktree') ?? '';
  const launch = flag(args, '--launch');
  let requested: string | null = null;
  const input = await readStdin(2000);
  try {
    const v = JSON.parse(input) as Record<string, unknown>;
    requested = typeof v.name === 'string' ? v.name : null;
  } catch {
    // no payload: the refusal stands all the same
  }
  process.stderr.write(`cland: ${session ?? 'this session'} works in its own task worktree ${worktree}; another worktree is refused. Work there (cd ${worktree}), on its branch.\n`);
  const { d } = discovery(args);
  if (d) {
    try {
      await askHubFrame(d, { type: 'session.signal', event: 'worktree-refused', at, payload: { worktree, ...(requested ? { name: requested } : {}) }, ...(session ? { session } : {}), ...(launch ? { launch } : {}) }, 3000);
    } catch (err) {
      process.stderr.write(`cland hook worktree-create: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }
  return 2;
}

export async function runHook(args: string[]): Promise<number> {
  const [event, ...rest] = args;
  if (!event) {
    process.stderr.write(`usage: cland hook <event> --session <name> [--hub-file <path>]\n`);
    return 2;
  }
  if (event === 'bridge') return bridge(rest);
  if (event === 'worktree-create') return refuseWorktree(rest);
  return post(event, rest);
}
