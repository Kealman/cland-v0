// T3 scenario: three review-only merges, stage QA refusal/retry and separate epic demo.
// Rule coverage (T1/T2): hub/test/merge-policy.test.ts, hub/test/suite-stage-rules.test.ts, hub/test/suite-close-component.test.ts; residual provenance in hub/test/stage-qa.test.ts.
// Hub process starts: 0; fixture reseeds cover between sequential projectHub instances, then reopens once. Only one hub is live at a time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cland, clandWithEnv, connectUi, eventually, projectHub, spawnSpoke } from '../harness.ts';
import type { ItemView } from '../../src/tracker/tracker.ts';
import { git, fixture } from '../stage-qa-support.ts';

test('three review-only merges, one stage QA on dev, not-clear/retry, restart and separate epic demo', async t => {
  const f = await fixture(t);
  await f.land();
  assert.equal((await f.read()).stages?.[0]?.state, 'open');
  const clear = await f.verdict(); assert.equal(clear.ok, true, clear.error);
  const view = await f.read();
  assert.equal(view.stages?.[0]?.state, 'closed'); assert.equal(view.state, 'open');
  assert.equal(view.criteria[0]?.marks.length, 0, 'stage evidence cannot verify the separate epic demo');
  assert.equal(view.stages?.[0]?.verdict?.commit, git(f.root, 'rev-parse', 'dev'));
  const shown = JSON.parse((await cland(f.root, 'task', 'plan', 'show', f.epic.id, '--json')).stdout);
  assert.equal(shown.stages[0].state, 'closed');
  const close = await f.ui.request({ type: 'task.close', item: f.epic.id });
  assert.equal(close.ok, false); assert.match(close.error ?? '', /no hub-written qa verdict/);
  assert.equal((await f.verdict('not clear')).ok, true);
  assert.equal((await f.read()).stages?.[0]?.state, 'open');
  // The CLI carries stage as a verdict field and uses a real connected QA session's identity.
  const retry = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'qa-one', CLAND_ROLE: 'qa' }, 'task', 'comment', f.epic.id, 'Stage cases pass', '--verdict', 'qa', '--result', 'clear', '--run', 'stage-retry', '--stage', 'Stage 1', '--json');
  assert.equal(retry.code, 0, retry.stderr);
  git(f.root, 'commit', '--allow-empty', '-qm', 'Later stage work');
  await eventually('later dev builds preserve completed stage evidence', async () => (await f.read()).stages?.[0]?.state === 'closed' ? true : undefined);
  await f.rev.close(); await f.qa.close(); f.ui.close(); await f.stop();
  const { discovery } = await projectHub(t, f.root); const ui = await connectUi(t, discovery);
  const persisted = await eventually('restarted hub checks stage build ancestry', async () => {
    const item = ((await ui.request({ type: 'task.view', item: f.epic.id })).value as { item: ItemView }).item;
    return item.stages?.[0]?.state === 'closed' ? item : undefined;
  });
  assert.equal(persisted.stages?.[0]?.state, 'closed'); assert.equal(persisted.stages?.[0]?.verdict?.run, 'stage-retry');
  const qa = await spawnSpoke({ discover: true, cwd: f.root, name: 'qa-two', role: 'qa', sessionId: 'qa-session-two' }); t.after(() => qa.close());
  assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: f.epic.id, verdict: 'qa', result: 'clear', run: 'epic-demo', verified: 'all' })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: f.epic.id })).ok, true);
});
