// T2: real CLI inbox snapshots from an injected hub and in-process Aide; screens are in nvim/test/inbox-requests.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cland, connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import type { Inbox } from '../src/protocol.ts';

test('the chip equals cland inbox before and after an Aide review request is replied to', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'Demo review' });
  assert.equal(created.ok, true, created.error);
  const subject = (created.value as { item: { id: string } }).item.id;
  const aide = await inProcessSpoke(t, { discover: true, cwd: root, name: 'aide-1', role: 'aide', sessionId: 'sess-demo' });
  t.after(() => aide.close());
  await aide.waitForPresence(['aide-1']);
  const initial = JSON.parse((await cland(root, 'inbox', '--json')).stdout) as Inbox;
  assert.equal(initial.needsYou, 0);
  assert.equal((await aide.call<{ ok: boolean }>('send', { kind: 'request', request: 'review', subject, text: 'Review the demo' })).ok, true);
  const before = JSON.parse((await cland(root, 'inbox', '--json')).stdout) as Inbox;
  assert.equal(before.needsYou, initial.needsYou + 1);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Reviewed' })).ok, true);
  const after = JSON.parse((await cland(root, 'inbox', '--json')).stdout) as Inbox;
  assert.equal(after.needsYou, initial.needsYou);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = (await cland(root, 'hub', 'journal', '--json')).stdout;
  assert.match(journal, /"event":"inbox-departure".*"reason":"replied"/);
});
