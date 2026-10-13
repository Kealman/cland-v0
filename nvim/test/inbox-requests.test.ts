// Real hub/CLI snapshots enter the headless workbench through the stub's protocol boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cland, connectUi, fakeClaude, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import type { Inbox } from '../../hub/src/protocol.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

test('the chip equals cland inbox before and after an Aide review request is replied to', { skip }, async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'Demo review' });
  assert.equal(created.ok, true, created.error);
  const subject = (created.value as { item: { id: string } }).item.id;
  const aide = await spawnSpoke({ discover: true, cwd: root, name: 'aide-1', role: 'aide', sessionId: 'sess-demo' });
  t.after(() => aide.close());
  await aide.waitForPresence(['aide-1']);
  const initial = JSON.parse((await cland(root, 'inbox', '--json')).stdout) as Inbox;
  assert.equal(initial.needsYou, 0);
  assert.equal((await aide.call<{ ok: boolean }>('send', { kind: 'request', request: 'review', subject, text: 'Review the demo' })).ok, true);
  const before = JSON.parse((await cland(root, 'inbox', '--json')).stdout) as Inbox;
  assert.equal(before.needsYou, initial.needsYou + 1);
  const controlPath = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_CONTROL: controlPath, CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: before }),
  });
  await c.waitScreen(s => /needs you\s+1\b/.test(s.split('\n')[0] ?? ''), 'chip counts the real request snapshot');
  await c.lua("require('cland.layout').right_panel('inbox')");
  await c.waitScreen(s => /INBOX.*1 need you/.test(s), 'existing inbox tolerates the new lists');
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Reviewed' })).ok, true);
  const after = JSON.parse((await cland(root, 'inbox', '--json')).stdout) as Inbox;
  assert.equal(after.needsYou, initial.needsYou);
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection(controlPath);
    socket.on('error', reject);
    socket.on('data', () => { socket.end(); resolve(); });
    socket.write(JSON.stringify({ set: { inbox: after }, emit: { type: 'inbox', inbox: after } }) + '\n');
  });
  await c.waitScreen(s => /needs you\s+0\b/.test(s.split('\n')[0] ?? '') && /nothing needs you/.test(s), 'reply snapshot clears chip and inbox');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = (await cland(root, 'hub', 'journal', '--json')).stdout;
  assert.match(journal, /"event":"inbox-departure".*"reason":"replied"/);
});
