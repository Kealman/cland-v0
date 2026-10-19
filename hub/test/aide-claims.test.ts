// T2: claim idempotence, lead routing and independent review through in-process MCP with injected Git facts.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import type { ItemView } from '../src/tracker/tracker.ts';

async function project(t: TestContext) {
  const root = await tempProject(t, 'cland-aide-claims-');
  const clock = new FakeClock();
  const head = 'a'.repeat(40);
  const branch = 't/T-1-aide-work';
  const { discovery } = await projectHub(t, root, {}, {
    clock,
    readBase: async () => 'dev',
    git: async args => {
      if (args[0] === 'for-each-ref') return `${head} refs/heads/dev\n${head} refs/heads/${branch}`;
      if (args[0] === 'rev-parse') return head;
      return null;
    },
  });
  const ui = await connectUi(t, discovery);
  const aide = await inProcessSpoke(t, { discover: true, cwd: root, name: 'aide-1', sessionId: 'aide-id', role: 'aide', clock });
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', sessionId: 'reviewer-id', role: 'reviewer', clock });
  await aide.waitForPresence(['aide-1', 'rev']);
  const made = await aide.call<{ ok: boolean; item: ItemView }>('task.create', { size: 'M', title: 'Aide work', branch });
  assert.equal(made.ok, true);
  const id = made.item.id;
  assert.equal((await aide.call<{ ok: boolean }>('task.edit', { id, status: 'planned' })).ok, true);
  const claimed = await aide.call<{ ok: boolean; claim: ItemView['claim'] }>('task.claim', { id });
  assert.equal(claimed.ok, true);
  return { ui, aide, rev, id, claim: claimed.claim };
}

test('an in-process Aide claim is idempotent and routes lead messages through independent review', async t => {
  const { ui, aide, rev, id, claim } = await project(t);
  assert.equal(claim?.session, 'aide-1');
  assert.equal(claim?.sessionId, 'aide-id');
  assert.equal(claim?.role, 'aide');
  let view = await aide.call<{ item: ItemView }>('task.view', { id });
  assert.equal(view.item.status, 'in progress');
  const opened = await aide.call<{ ok: boolean; topic: { id: string } }>('topic.create', { item: id, title: 'Aide item' });
  assert.equal(opened.ok, true);
  const human = await ui.request({ type: 'topic.send', topic: opened.topic.id, text: `@lead ${id} finish this item` });
  assert.equal(human.ok, true, human.error);
  await aide.waitForEvent(e => e.params.content.includes('finish this item'));
  const missing = await ui.request({ type: 'merge', item: id }, 30_000);
  assert.equal((missing as { code?: string }).code, 'review-missing');
  assert.equal((await aide.call<{ ok: boolean }>('task.edit', { id, status: 'review' })).ok, true);
  const again = await aide.call<{ ok: boolean }>('task.claim', { id });
  assert.equal(again.ok, true);
  view = await aide.call<{ item: ItemView }>('task.view', { id });
  assert.equal(view.item.status, 'review', 'an idempotent claim preserves handover status');
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id })).ok, true);
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id, verdict: 'review', scope: 'full', result: 'clear', run: 'aide-review' })).ok, true);
  await eventually('independent review makes the Aide item ready', async () => {
    const current = await aide.call<{ item: ItemView }>('task.view', { id });
    return current.item.status === 'ready' ? true : undefined;
  });
  assert.equal((await rev.call<{ ok: boolean }>('send', { to: [`lead ${id}`], topic: opened.topic.id, text: 'Independent review is clear' })).ok, true);
  await aide.waitForEvent(e => e.params.content.includes('Independent review is clear'));
});

for (const kind of ['review', 'qa'] as const) {
  test(`an in-process Aide claimant cannot supply its own ${kind} after becoming a verifier`, async t => {
    const { ui, aide, rev, id } = await project(t);
    if (kind === 'qa') {
      const made = await ui.request({ type: 'task.create', title: 'Required QA', kind: 'epic' });
      assert.equal(made.ok, true, made.error);
      const epic = (made.value as { item: ItemView }).item.id;
      assert.equal((await ui.request({ type: 'task.link', item: id, parent: epic })).ok, true);
      const planned = await ui.request({ type: 'task.plan', item: epic, op: 'set', yaml: `stages:\n- name: Required QA\n  qa: {scope: affected, when: per-item}\n  lanes: [[${id}]]\n` });
      assert.equal(planned.ok, true, planned.error);
      assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id, verdict: 'review', scope: 'full', result: 'clear', run: 'independent-review' })).ok, true);
      await eventually('independent review is current', async () => {
        const view = await aide.call<{ item: ItemView }>('task.view', { id });
        return view.item.verdicts[0]?.current === true ? true : undefined;
      });
    }
    assert.equal((await ui.request({ type: 'role.set', session: 'aide-1', role: kind === 'review' ? 'reviewer' : 'qa' })).ok, true);
    assert.equal((await aide.call<{ ok: boolean }>('task.comment', { id, verdict: kind, ...(kind === 'review' ? { scope: 'full' } : {}), result: 'clear', run: 'self-verdict' })).ok, true);
    const gate = await ui.request({ type: 'merge', item: id }, 30_000);
    assert.equal(gate.ok, false, JSON.stringify(gate));
    assert.equal((gate as { code?: string }).code, `${kind}-claimant`);
    const view = await aide.call<{ item: ItemView }>('task.view', { id });
    assert.equal(view.item.state, 'open');
    assert.notEqual(view.item.status, 'ready');
    assert.equal(view.item.claim?.role, 'aide');
    assert.equal(view.item.claim?.sessionId, 'aide-id');
  });
}
