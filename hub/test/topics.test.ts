// T3: real child stdio hub startup and frame transport.
// Topics and the UI's frames (spec 4.2, 4.5): a real daemon in a temporary project, a scripted UI client
// on its Unix socket or on a child hub's stdio, and spokes — raw frames on the socket where the frame
// itself is asserted, the real spoke over MCP where the session's view is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { PROTOCOL_VERSION } from '../src/protocol.ts';
import { CLI_ENTRY, frameClient, isolateVerification, killDaemon, readDiscovery, spawnSpoke, tempProject, type FrameClient } from './harness.ts';

type Topic = { id: string; title: string; status: string; standing: boolean; createdAt: string; updatedAt: string };

type TopicMessage = { id: string; topic: string; from: string; fromKind: string; fromRole?: string; to: string[]; text: string; ts: string; stage?: string };

async function topics(ui: FrameClient): Promise<Topic[]> {
  const r = await ui.request({ type: 'topic.list' });
  assert.equal(r.ok, true, r.error);
  return (r.value as { topics: Topic[] }).topics;
}

test('the same frames over stdio: a UI spawning `cland hub serve --stdio` as its child', async (t) => {
  const root = await tempProject(t);
  await isolateVerification(root);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_')) env[k] = v;
  const child = spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve', '--stdio'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (c: string) => (stderr += c));
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  t.after(() => killDaemon(child.pid as number));
  child.stdout.setEncoding('utf8');
  const ui = frameClient(
    (line) => child.stdin.write(line),
    (fn) => child.stdout.on('data', fn),
    () => child.stdin.end(),
  );
  // the parent spawned the hub: no secret on this edge
  ui.send({ type: 'hello', protocol: PROTOCOL_VERSION, client: 'ui' });
  const welcome = await ui.waitFor((f) => f.type === 'welcome' || f.type === 'error', 15_000).catch((err: Error) => {
    throw new Error(`${err.message}\nstderr:\n${stderr}`);
  });
  assert.equal(welcome.type, 'welcome', JSON.stringify(welcome));
  assert.deepEqual((await topics(ui)).map((x) => x.id), ['general', 'agents']);
  await ui.request({ type: 'subscribe' });
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'over stdio' });
  const { message } = sent.value as { message: TopicMessage };
  assert.equal(message.stage, 'queued');

  // the child is the project's hub: a session finds it through hub.json
  assert.equal((await readDiscovery(root)).pid, child.pid);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForEvent((e) => e.params.content === 'over stdio', 15_000);
  assert.deepEqual(await ui.waitFor((f) => f.type === 'delivery'), { type: 'delivery', topic: 'general', message: message.id, stage: 'delivered', withdrawable: false });
  await coord.call('send', { text: 'heard you' });
  const event = (await ui.waitFor((f) => f.type === 'message' && (f.message as TopicMessage).from === 'coord')) as { message: TopicMessage };
  assert.equal(event.message.text, 'heard you');

  // the parent closing stdin ends the hub
  child.stdin.end();
  assert.equal(await exited, 0, stderr);
});
