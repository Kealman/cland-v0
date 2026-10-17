// T3 scenario: claim, criteria review, real verification and verdict-gated merge.
// Rule coverage (T1/T2): hub/test/merge-policy.test.ts, hub/test/merge-override.test.ts, hub/test/suite-cache.test.ts; residual criteria in hub/test/merge-gate.test.ts.
// Hub process starts: 0; projectHub serves/reopens the legacy step; verification fixture uses projectHub. Only one hub is live at a time.
import { onCleanup } from '../process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, cland, clandWithEnv, eventually, spawnSpoke } from '../harness.ts';
import { type ItemView } from '../../src/tracker/tracker.ts';
import { git, ok, json, project, task, review, refused } from '../merge-support.ts';

test('an in-flight legacy item reaches ready and merge only after every criterion is done and verified', async (t) => {
  let stop = async () => {};
  const serve: typeof projectHub = async (...args) => { const hub = await projectHub(...args); stop = hub.stop; return hub; };
  const { root, ui, rev } = await project(t, undefined, undefined, serve);
  const work = await task(root);
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', sessionId: 'impl-id', role: 'implementer' });
  onCleanup(t, () => impl.close());
  ok(await cland(root, 'task', 'claim', work.id, '--release'));
  ok(await cland(root, 'task', 'edit', work.id, '--assignee', 'impl'));
  const claimed = await impl.call<{ ok: boolean; error?: string }>('task.claim', { id: work.id });
  assert.equal(claimed.ok, true, claimed.error);
  const read = async () => json<{ item: { path: string; status: string; criteriaCounts: { total: number; done: number; verified: number; stale: number; failed: number }; criteria: Array<{ id: string | null; marks: Array<{ kind: string; current?: boolean }> }>; verdicts: Array<{ current?: boolean }> } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  const file = join(root, (await read()).path);
  await writeFile(file, await readFile(file, 'utf8') + '\n## Acceptance criteria\n\n- [x] Parses input\n- [ ] Reports errors\n');
  await review(rev, work.id);
  await eventually('current legacy review', async () => (await read()).verdicts[0]?.current);
  const legacy = await refused(ui, root, work.id, 'criteria-incomplete');
  assert.match(legacy.error!, /Parses input.*not done.*not verified/s);
  assert.match(legacy.error!, /Reports errors.*not done.*not verified/s);
  assert.match(legacy.error!, /Implementer.*done.*--verified/s);
  assert.match(legacy.error!, /ids.*first/i);
  assert.notEqual((await read()).status, 'ready');

  const done = async (criterion: string) => {
    const result = await impl.call<{ ok: boolean; error?: string }>('task.criterion', { id: work.id, op: 'done', criterion });
    assert.equal(result.ok, true, result.error);
  };
  const verify = async (verified: string, run: string) => {
    ok(await clandWithEnv(root, { CLAND_SESSION_NAME: 'rev', CLAND_SESSION_ID: 'reviewer-id' }, 'task', 'comment', work.id, 'Checked', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', run, '--verified', verified));
  };
  await done('C1');
  assert.deepEqual((await read()).criteria.map(c => c.id), ['C1', 'C2']);
  await verify('C2', 'rev-partial');
  const partial = await refused(ui, root, work.id, 'criteria-incomplete');
  assert.match(partial.error!, /C1.*Parses input.*not verified/);
  assert.match(partial.error!, /C2.*Reports errors.*not done/);
  assert.notEqual((await read()).status, 'ready');
  await done('C2');
  const unverified = await refused(ui, root, work.id, 'criteria-incomplete');
  assert.match(unverified.error!, /C1.*not verified/);
  assert.doesNotMatch(unverified.error!, /C2/);
  await verify('all', 'rev-all');
  await eventually('criteria ready', async () => (await read()).status === 'ready' ? true : undefined);
  const merged = json<{ commit: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
  assert.equal((await read()).status, 'done');
  assert.equal(git(root, 'branch', '--list', work.branch), '', 'landing removes the task branch');
  await stop();
  await projectHub(t, root);
  const landed = await read();
  const counts = { total: 2, done: 0, verified: 2, stale: 0, failed: 0 };
  assert.deepEqual(landed.criteriaCounts, counts);
  const listed = json<{ items: Array<{ id: string; criteria: typeof counts }> }>(await cland(root, 'task', 'list', '--json'));
  assert.deepEqual(listed.items.find(item => item.id === work.id)?.criteria, counts);
  assert.ok(landed.criteria.every(criterion => criterion.marks.some(mark => mark.kind === 'verified' && mark.current === true)), 'closed tasks retain their verified fractions after branch cleanup and restart');
});

test('a cached green suite at a new identical tree never revives a stale criterion mark', async t => {
  const { root, ui, rev } = await project(t, {}, true, undefined, true);
  const work = await task(root);
  ok(await cland(root, 'task', 'criterion', work.id, 'add', 'Full suite passes'));
  ok(await cland(root, 'task', 'criterion', work.id, 'done', 'C1'));
  const made = await ui.request({ type: 'topic.create', title: 'Cache gate', item: work.id });
  const topic = (made.value as { topic: { id: string } }).topic.id;
  const run = async () => json<{ id: string; cached?: { run: string; head: string; tree: string } }>(await cland(work.path, 'verify', 'all', '--report', topic, '--to', 'rev', '--json'));
  const completion = async (id: string) => eventually('posted suite result', async () => {
    const history = await ui.request({ type: 'topic.history', topic });
    return (history.value as { messages: Array<{ id: string; text: string }> }).messages.find(m => m.id === `suite:${id}`);
  });
  const a = git(work.path, 'rev-parse', 'HEAD');
  const original = await run();
  assert.match((await completion(original.id)).text, /exit 0/);
  const verify = async (commit: string, run: string) => {
    const result = await rev.call<{ ok: boolean; error?: string }>('task.comment', { id: work.id, verdict: 'review', scope: 'full', result: 'clear', run, commit, verified: 'all' });
    assert.equal(result.ok, true, result.error);
  };
  await verify(a, 'review-a');
  git(work.path, 'commit', '--allow-empty', '-qm', 'same tree new head');
  git(work.path, 'push', 'origin', work.branch);
  const b = git(work.path, 'rev-parse', 'HEAD');
  const hit = await run();
  assert.equal(hit.cached?.run, original.id);
  const evidence = await completion(hit.id);
  assert.ok(evidence.text.includes(`head ${b}`) && evidence.text.includes(`Original run ${original.id}`));
  await refused(ui, root, work.id, 'criteria-incomplete');
  const stale = json<{ item: ItemView }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  assert.ok(stale.criteria[0]?.marks.some(m => m.kind === 'verified' && m.commit === a && m.current === false));
  await verify(b, 'review-b-with-cache');
  await eventually('new-head verification ready', async () => json<{ item: ItemView }>(await cland(root, 'task', 'view', work.id, '--json')).item.status === 'ready' ? true : undefined);
  // A source change cannot inherit the cached green result, or the B criterion mark.
  await writeFile(join(work.path, 'parser.txt'), 'changed after cache');
  git(work.path, 'commit', '-qam', 'different tree'); git(work.path, 'push', 'origin', work.branch);
  const changed = await run();
  assert.equal(changed.cached, undefined);
  assert.match((await completion(changed.id)).text, /exit 0/);
  await refused(ui, root, work.id, 'criteria-incomplete');
  await verify(git(work.path, 'rev-parse', 'HEAD'), 'review-changed');
  json(await cland(root, 'merge', work.id, '--json'));
});
