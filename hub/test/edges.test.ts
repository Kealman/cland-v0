// The JSON-lines edges (spec 4.2): the Unix socket of a real daemon and the stdio of a child hub. Each line
// is a frame and is held to the frame limit on its own, however the bytes arrive.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_FRAME_BYTES, PROTOCOL_VERSION, type VerificationQueue } from '../src/protocol.ts';
import { CLI_ENTRY, connectSocket, frameClient, killDaemon, pidAlive, startDaemon, tempProject, type FrameClient } from './harness.ts';

/** A valid `topic.list` request one byte under the frame limit (its newline not counted). */
export function nearLimitFrame(id: string): string {
  const base = JSON.stringify({ type: 'topic.list', id, pad: '' });
  const frame = JSON.stringify({ type: 'topic.list', id, pad: 'x'.repeat(MAX_FRAME_BYTES - 1 - Buffer.byteLength(base)) });
  assert.equal(Buffer.byteLength(frame), MAX_FRAME_BYTES - 1);
  return frame;
}

test('the Unix socket reads a near-limit frame and the next one from a single write; a line or a remainder over the limit closes', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectSocket(discovery.socket);
  t.after(() => ui.close());
  ui.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'ui' });
  assert.equal((await ui.next()).type, 'welcome');

  // a small frame first, so the near-limit one does not start on a read boundary; all three in one write
  ui.write(`${JSON.stringify({ type: 'topic.list', id: 'first' })}\n${nearLimitFrame('big')}\n${JSON.stringify({ type: 'topic.list', id: 'small' })}\n`);
  assert.equal((await ui.next(10_000)).id, 'first');
  const big = await ui.next(10_000);
  assert.equal(big.id, 'big');
  assert.equal(big.ok, true);
  const small = await ui.next();
  assert.equal(small.id, 'small');
  assert.equal(small.ok, true);

  // one line over the limit, even arriving complete with its newline, ends the connection
  ui.write(`${'x'.repeat(MAX_FRAME_BYTES + 1)}\n`);
  await ui.closed;

  // an unfinished line already over the limit ends it too, before its newline ever comes
  const other = await connectSocket(discovery.socket);
  t.after(() => other.close());
  other.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'ui' });
  assert.equal((await other.next()).type, 'welcome');
  other.write('x'.repeat(MAX_FRAME_BYTES + 1));
  await other.closed;
});

// ------------------------------------------------------------------ stdio, with and without listeners

type StdioHub = { ui: FrameClient; pid: number; stderr: () => string; exited: Promise<number | null>; write: (raw: string) => void };

/** `cland hub serve --stdio …` as a UI's child, optionally under a command prefix (a sandbox). */
function spawnStdioHub(t: TestContext, root: string, args: string[], prefix: string[] = []): StdioHub {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_')) env[k] = v;
  const argv = [...prefix, process.execPath, CLI_ENTRY, 'hub', 'serve', '--stdio', ...args];
  const child = spawn(argv[0] as string, argv.slice(1), { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (c: string) => (stderr += c));
  child.stdout.setEncoding('utf8');
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  t.after(async () => {
    child.stdin.end();
    await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
    if (child.exitCode === null) await killDaemon(child.pid as number);
  });
  const ui = frameClient(
    (line) => child.stdin.write(line),
    (fn) => child.stdout.on('data', fn),
    () => child.stdin.end(),
  );
  return { ui, pid: child.pid as number, stderr: () => stderr, exited, write: (raw) => child.stdin.write(raw) };
}

/** The UI's conversation with a hub that has no listeners: every frame it needs, over stdio alone. */
async function driveUi(hub: StdioHub): Promise<void> {
  const { ui } = hub;
  ui.send({ type: 'hello', protocol: PROTOCOL_VERSION, client: 'ui' });
  const welcome = await ui.waitFor((f) => f.type === 'welcome' || f.type === 'error', 15_000).catch((err: Error) => {
    throw new Error(`${err.message}\nstderr:\n${hub.stderr()}`);
  });
  assert.equal(welcome.type, 'welcome', JSON.stringify(welcome));
  const list = await ui.request({ type: 'topic.list' });
  assert.deepEqual((list.value as { topics: Array<{ id: string }> }).topics.map((x) => x.id), ['general', 'agents']);
  assert.deepEqual((await ui.request({ type: 'subscribe' })).value, { subscribed: true });
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'no sockets here' });
  assert.equal(sent.ok, true, sent.error);
  const { message } = sent.value as { message: { id: string; stage: string } };
  assert.equal(message.stage, 'queued');
  const event = (await ui.waitFor((f) => f.type === 'message')) as { message: { id: string; text: string } };
  assert.equal(event.message.id, message.id);
  assert.equal(event.message.text, 'no sockets here');
  const status = await ui.request({ type: 'hub.status' });
  assert.equal(status.ok, true, status.error);
  assert.equal((status.value as { pid: number }).pid, hub.pid);

  // the same framing as the socket: a near-limit frame between two others, in one write
  hub.write(`${JSON.stringify({ type: 'topic.list', id: 'first' })}\n${nearLimitFrame('big')}\n${JSON.stringify({ type: 'topic.list', id: 'small' })}\n`);
  // results are routed by id; these ids were not issued by request(), so they land in frames
  for (const id of ['first', 'big', 'small']) await ui.waitFor((f) => f.type === 'result' && f.id === id, 10_000);
}

const SANDBOX = existsSync('/usr/bin/sandbox-exec') && spawnSync('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)', '/usr/bin/true']).status === 0;

test('in a sandbox that forbids listening, `serve --stdio` still serves the UI over stdio, holding the lock and writing no hub.json', { skip: SANDBOX ? false : 'needs macOS sandbox-exec' }, async (t) => {
  const root = await tempProject(t);
  const lock = join(root, 'hand.lock');
  const started = spawnSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], { encoding: 'utf8' }).stdout.trim().replace(/\s+/g, ' ');
  assert.ok(started, 'the parent can publish a real process identity before sandboxing the hub');
  mkdirSync(join(root, '.cland'));
  writeFileSync(join(root, '.cland', 'config.toml'), `[verification]\nlock_path = ${JSON.stringify(lock)}\n`);
  mkdirSync(lock);
  writeFileSync(join(lock, 'holder.json'), JSON.stringify({ pid: process.pid, started, since: new Date().toISOString(), token: 'hand', worktree: root }));
  const hub = spawnStdioHub(t, root, [], ['/usr/bin/sandbox-exec', '-p', '(version 1)(allow default)(deny network-bind)']);
  await driveUi(hub);
  const result = await hub.ui.request({ type: 'suite.queue' });
  assert.equal(result.ok, true, result.error);
  const queue = result.value as VerificationQueue;
  assert.equal(queue.holder?.kind, 'hand run');
  assert.equal(queue.holder?.pid, process.pid);
  assert.equal(queue.holder?.etaMs, null);
  assert.ok(existsSync(lock), 'unavailable process discovery preserves the live hand holder');
  assert.match(hub.stderr(), /"event":"listen-failed"/);
  assert.equal(existsSync(join(root, '.cland', 'hub.json')), false, 'nobody can reach a hub with no listeners: no discovery file');
  assert.equal(existsSync(join(root, '.cland', 'hub.lock')), true, 'the store is still this hub\'s alone');
  hub.ui.close();
  assert.equal(await hub.exited, 0, hub.stderr());
  assert.equal(existsSync(join(root, '.cland', 'hub.lock')), false);
});

test('`serve --stdio --no-listen` binds nothing and serves the UI over stdio', async (t) => {
  const root = await tempProject(t);
  const hub = spawnStdioHub(t, root, ['--no-listen']);
  await driveUi(hub);
  assert.doesNotMatch(hub.stderr(), /"event":"listening"/);
  assert.equal(existsSync(join(root, '.cland', 'hub.json')), false);
  assert.deepEqual(readdirSync(join(root, '.cland')).filter((f) => f.endsWith('.sock')), []);
  hub.ui.close();
  assert.equal(await hub.exited, 0, hub.stderr());
});

test('when one listener cannot bind, `serve --stdio` closes the other and goes on over stdio alone', async (t) => {
  const root = await tempProject(t);
  // a directory where the socket goes: the Unix socket cannot be put in place, after the WebSocket bound
  mkdirSync(join(root, '.cland', 'hub.sock'), { recursive: true });
  const hub = spawnStdioHub(t, root, []);
  await driveUi(hub);
  assert.match(hub.stderr(), /"event":"listen-failed"/);
  assert.equal(existsSync(join(root, '.cland', 'hub.json')), false);
  const status = await hub.ui.request({ type: 'hub.status' });
  assert.equal((status.value as { port: number }).port, 0, 'no WebSocket is left listening');
  hub.ui.close();
  assert.equal(await hub.exited, 0, hub.stderr());
});

test('while a daemon serves the project, `serve --stdio` refuses with a clear error and leaves the daemon alone', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const hub = spawnStdioHub(t, root, []);
  assert.equal(await hub.exited, 1);
  assert.match(hub.stderr(), new RegExp(`a hub already runs for ${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(pid ${discovery.pid}`));
  assert.match(hub.stderr(), /cland hub stop/);
  assert.equal(pidAlive(discovery.pid), true);
});
