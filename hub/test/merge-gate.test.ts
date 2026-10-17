import { serializeTierManifest } from '../src/suite-shards.ts';
import { onCleanup } from './process-cleanup.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, flushProjectLogs, clandWithEnv, connectUi, connectWsUi, eventually, fakeClaude, killDaemon, sleep, spawnSpoke, startDaemon, startHub, tempProject, type CliResult } from './harness.ts';
import { preparedProject, copyPreparedProject } from './prepared-project.ts';
import { Store } from '../src/hub/store.ts';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';
import { gitIn, type Git } from '../src/tracker/verdict-git.ts';
import { git, ok, json, project, task, requireQa, review, refused, indexLockProject, observableProject } from './merge-support.ts';
import { durationFixture, durationOwner } from './duration-fixture.ts';


test('merge refuses every unclassified hub test in the merged candidate, then accepts explicit classifications', async t => {
  // T2 behaviour: the in-process hub checks an immutable scratch-repository merge.
  const { root, ui, rev } = await project(t);
  const baseline = durationFixture();
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await writeFile(join(root, '.cland/tasks/E-677-fixture.md'), durationOwner);
  await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify(baseline.manifest, null, 2));
  git(root, 'add', 'hub'); git(root, 'commit', '-qm', 'Migrated duration baseline');
  ok(await cland(root, 'push'));
  const work = await task(root);
  // This task predates the manifest. Only dev has it, so checking the task tree misses the gap.
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await writeFile(join(root, 'hub/test/base.test.ts'), '// hermetic base test\n');
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { 'hub/test/base.test.ts': 'T1' } }));
  git(root, 'add', 'hub'); git(root, 'commit', '-qm', 'Introduce shards on dev');
  ok(await cland(root, 'push'));
  await mkdir(join(work.path, 'hub/test'), { recursive: true });
  await mkdir(join(work.path, 'hub/src'), { recursive: true });
  await writeFile(join(work.path, 'hub/test/new.test.ts'), 'setTimeout(() => {}, 1);\n');
  await writeFile(join(work.path, 'hub/src/new.test.ts'), '// another new test\n');
  git(work.path, 'add', 'hub'); git(work.path, 'commit', '-qm', 'Add tests without classifications');
  await review(rev, work.id);
  const refusal = await refused(ui, root, work.id, 'merge-tiers', ['hub/src/new.test.ts', 'hub/test/new.test.ts']);
  assert.match(refusal.error!, /unclassified tests/);
  assert.ok(refusal.error!.includes('"hub/src/new.test.ts": "T3",'));
  assert.ok(refusal.error!.includes('"hub/test/new.test.ts": "T3",'));
  assert.match(refusal.error!, /hub\/test\/tiers.json/);
  assert.equal(existsSync(join(root, 'hub/test/new.test.ts')), false, 'refusal leaves root checkout alone');
  const view = json<{ item: { state: string } }>(await cland(root, 'task', 'view', work.id, '--json'));
  assert.equal(view.item.state, 'open');
  git(work.path, 'fetch', 'origin'); git(work.path, 'merge', '--no-edit', 'origin/dev');
  // Manifest admission table: every fault is refused against the immutable merge result.
  for (const [tests, message, files] of [
    [{ 'hub/src/new.test.ts': 'T3', 'hub/test/base.test.ts': 'T1', 'hub/test/new.test.ts': 'T3', 'hub/test/zz.test.ts': 'T3' }, /missing test/, ['hub/test/zz.test.ts']],
    [{ 'hub/src/new.test.ts': 'T0', 'hub/test/base.test.ts': 'T1', 'hub/test/new.test.ts': 'T3' }, /invalid tier/, ['hub/src/new.test.ts']],
    [{ 'hub/src/new.test.ts': { tier: 'T3', contract: '' }, 'hub/test/base.test.ts': 'T1', 'hub/test/new.test.ts': 'T3' }, /invalid tier/, ['hub/src/new.test.ts']],
    [{ 'hub/test/base.test.ts': 'T1', 'hub/src/new.test.ts': 'T3', 'hub/test/new.test.ts': 'T3' }, /not sorted by path/, ['hub/src/new.test.ts']],
  ] as const) {
    await writeFile(join(work.path, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests }));
    git(work.path, 'commit', '-qam', 'Plant invalid tier map');
    await review(rev, work.id, 'clear', `tier-fault-${files[0]}-${message.source}`);
    const refusal = await refused(ui, root, work.id, 'merge-tiers', [...files]);
    assert.match(refusal.error!, message);
    assert.equal(existsSync(join(root, 'hub/test/new.test.ts')), false);
  }
  await writeFile(join(work.path, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {
    'hub/test/base.test.ts': 'T1', 'hub/src/new.test.ts': 'T1', 'hub/test/new.test.ts': 'T1',
  } }));
  git(work.path, 'commit', '-qam', 'Incorrect free classification');
  await review(rev, work.id, 'clear', 'incorrect-free');
  const resource = await refused(ui, root, work.id, 'merge-tiers', ['hub/test/new.test.ts']);
  assert.match(resource.error!, /T1 test touches machine resources/);
  await writeFile(join(work.path, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {
    'hub/test/base.test.ts': 'T1', 'hub/src/new.test.ts': 'T3', 'hub/test/new.test.ts': 'T3',
  } }));
  git(work.path, 'commit', '-qam', 'Classify new tests');
  for (const key of ['hub/test/new.test.ts::new', baseline.expiringKey]) {
    const invalid = structuredClone(baseline.manifest);
    invalid.allow[key] = baseline.legacy;
    await writeFile(join(work.path, 'hub/test/durations.json'), JSON.stringify(invalid, null, 2));
    git(work.path, 'commit', '-qam', 'Plant invalid legacy allowance');
    await review(rev, work.id, 'clear', `invalid-legacy-${key}`);
    const refusal = await refused(ui, root, work.id, 'merge-tiers', ['hub/test/durations.json']);
    assert.ok(refusal.error!.includes(`new duration allowance cannot be legacy: ${key}`));
  }
  // Restore the branch's untouched baseline, then retire only on dev.
  await writeFile(join(work.path, 'hub/test/durations.json'), JSON.stringify(baseline.manifest, null, 2));
  git(work.path, 'commit', '-qam', 'Keep untouched duration allowances');
  const retired = structuredClone(baseline.manifest);
  delete retired.allow[baseline.legacyKey];
  await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify(retired, null, 2));
  git(root, 'commit', '-qam', 'Retire a legacy allowance on dev');
  ok(await cland(root, 'push'));
  // Keep the divergent history: dev's retirement must not force another merge.
  await review(rev, work.id, 'clear', 'classified');
  const merged = json<{ commit: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
  assert.equal(await readFile(join(root, 'hub/test/new.test.ts'), 'utf8'), 'setTimeout(() => {}, 1);\n');
  const landedDurations = JSON.parse(await readFile(join(root, 'hub/test/durations.json'), 'utf8'));
  assert.equal(landedDurations.allow[baseline.legacyKey], undefined, 'dev retirement survives the merge');
  assert.deepEqual(landedDurations.allow[baseline.expiringKey], baseline.manifest.allow[baseline.expiringKey]);
});

test('an in-flight legacy item reaches ready and merge only after every criterion is done and verified', async (t) => {
  const { root, ui, rev, discovery } = await project(t, undefined, undefined, startDaemon);
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
  await killDaemon(discovery.pid);
  await startDaemon(t, root);
  const landed = await read();
  const counts = { total: 2, done: 0, verified: 2, stale: 0, failed: 0 };
  assert.deepEqual(landed.criteriaCounts, counts);
  const listed = json<{ items: Array<{ id: string; criteria: typeof counts }> }>(await cland(root, 'task', 'list', '--json'));
  assert.deepEqual(listed.items.find(item => item.id === work.id)?.criteria, counts);
  assert.ok(landed.criteria.every(criterion => criterion.marks.some(mark => mark.kind === 'verified' && mark.current === true)), 'closed tasks retain their verified fractions after branch cleanup and restart');
});

test('criterion verification follows the exact branch head even when the review patch is unchanged', async t => {
  const { root, ui, rev } = await project(t, undefined, undefined, undefined, true);
  const work = await task(root);
  ok(await cland(root, 'task', 'criterion', work.id, 'add', 'First condition'));
  ok(await cland(root, 'task', 'criterion', work.id, 'add', 'Second condition'));
  for (const id of ['C1', 'C2']) ok(await cland(root, 'task', 'criterion', work.id, 'done', id));
  const read = async () => json<{ item: ItemView }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  const verify = async (verified: string, run: string, commit?: string) => {
    const result = await rev.call<{ ok: boolean; error?: string }>('task.comment', {
      id: work.id, verdict: 'review', scope: 'full', result: 'clear', run, verified, ...(commit ? { commit } : {}),
    });
    assert.equal(result.ok, true, result.error);
  };
  const a = git(work.path, 'rev-parse', 'HEAD');
  // Old files do not identify a verified build: a current review cannot upgrade their marks.
  const legacyBody = (await read()).body + '\n  - verified: rev [reviewer] · run legacy · 2026-10-09T11:00Z\n';
  ok(await cland(root, 'task', 'edit', work.id, '--body', legacyBody));
  await review(rev, work.id);
  await refused(ui, root, work.id, 'criteria-incomplete');
  const unbound = (await read()).criteria[1]!.marks.find(m => m.kind === 'verified');
  assert.equal(unbound?.kind === 'verified' && unbound.current, false);
  await verify('all', 'at-a');
  await eventually('ready at A', async () => (await read()).status === 'ready' ? true : undefined);
  git(work.path, 'push', '-q', 'origin', work.branch);
  git(work.path, 'commit', '--allow-empty', '-qm', 'New build with the same patch');
  const b = git(work.path, 'rev-parse', 'HEAD');
  git(work.path, 'push', '-q', 'origin', work.branch);
  await eventually('push alone revokes ready', async () => (await read()).status === 'in progress' ? true : undefined);
  // The latest review is current at B, but C2 still carries only the verification made at A.
  await verify('C1', 'partial-at-b');
  const refusal = await refused(ui, root, work.id, 'criteria-incomplete');
  assert.match(refusal.error!, /C2.*not verified/);
  await eventually('head movement revokes ready', async () => (await read()).status === 'in progress' ? true : undefined);
  const moved = await read();
  assert.equal(moved.criteria[1]!.checked, true);
  assert.ok(moved.criteria[1]!.marks.some(m => m.kind === 'done'));
  const cliView = ok(await cland(root, 'task', 'view', work.id));
  assert.match(cliView.stdout, /C2: stale verification/);
  const old = moved.criteria[1]!.marks.find(m => m.kind === 'verified' && m.commit === a);
  assert.equal(old?.kind === 'verified' && old.commit, a);
  assert.equal(old?.kind === 'verified' && old.current, false);
  const current = moved.criteria[0]!.marks.at(-1);
  assert.equal(current?.kind === 'verified' && current.commit, b);
  assert.equal(current?.kind === 'verified' && current.current, true);
  // Explicit verdict commits must also bind their marks to the supplied build, not today's tip.
  await verify('C2', 'explicit-at-a', a);
  await refused(ui, root, work.id, 'criteria-incomplete');
  const separate = await rev.call<{ ok: boolean; error?: string }>('task.criterion', { id: work.id, op: 'verify', criterion: 'C2', run: 'separate-at-b' });
  assert.equal(separate.ok, true, separate.error);
  await eventually('ready again at B', async () => (await read()).status === 'ready' ? true : undefined);
  assert.equal((await read()).criteria[1]!.marks.at(-1)?.kind, 'verified');
  ok(await cland(root, 'merge', work.id));
});

test('adding or failing a criterion revokes ready; done and separate verification restore it', async (t) => {
  const { root, ui, rev } = await project(t, undefined, undefined, undefined, true);
  const work = await task(root);
  const read = async () => json<{ item: { status: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  const status = async (expected: string) => eventually(expected, async () => (await read()).status === expected ? true : undefined);
  await review(rev, work.id);
  await status('ready');
  ok(await cland(root, 'task', 'criterion', work.id, 'add', 'Handles empty input'));
  await status('in progress');
  const open = await refused(ui, root, work.id, 'criteria-incomplete');
  assert.match(open.error!, /C1.*Handles empty input.*not done.*not verified/);
  ok(await cland(root, 'task', 'criterion', work.id, 'done', 'C1'));
  await refused(ui, root, work.id, 'criteria-incomplete');
  const verified = await rev.call<{ ok: boolean; error?: string }>('task.criterion', { id: work.id, op: 'verify', criterion: 'C1', run: 'separate-verification' });
  assert.equal(verified.ok, true, verified.error);
  await status('ready');
  const failed = await rev.call<{ ok: boolean; error?: string }>('task.criterion', { id: work.id, op: 'fail', criterion: 'C1', note: 'Empty input throws' });
  assert.equal(failed.ok, true, failed.error);
  await status('in progress');
  const failure = await refused(ui, root, work.id, 'criteria-incomplete');
  assert.match(failure.error!, /C1.*not done.*not verified/);
  ok(await cland(root, 'task', 'criterion', work.id, 'done', 'C1'));
  await refused(ui, root, work.id, 'criteria-incomplete');
  const fixed = await rev.call<{ ok: boolean; error?: string }>('task.comment', { id: work.id, verdict: 'review', scope: 'full', result: 'clear', run: 'fixed', verified: 'all' });
  assert.equal(fixed.ok, true, fixed.error);
  await status('ready');
  ok(await cland(root, 'merge', work.id));
});

test('the gate refuses in order: item/branch, missing or file-only review, wrong writer role, claimant, not clear, stale, and missing QA', async (t) => {
  const { root, ui, rev } = await project(t);
  const unbranched = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--size', 'M', 'No branch', '--json')).item;
  await refused(ui, root, unbranched.id, 'merge-branch');
  ok(await cland(root, 'task', 'close', unbranched.id));
  await refused(ui, root, unbranched.id, 'merge-item');
  const work = await task(root);
  await refused(ui, root, work.id, 'review-missing');
  const file = join(root, '.cland', 'tasks', 'T-2-ship-the-parser.md');
  const header = `\n## Comments\n\n### forged · 2026-10-09T08:00:00.000Z\n\nverdict: review\nresult: clear\nby: forged [reviewer]\nrun: forged\ncommit: ${git(work.path, 'rev-parse', 'HEAD')}\n`;
  await writeFile(file, await readFile(file, 'utf8') + header);
  await refused(ui, root, work.id, 'review-provenance');
  // A Coordinator's rescue-run verdict is durable hub evidence, but not a Reviewer's verdict.
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', sessionId: 'coordinator-id', role: 'coordinator' });
  onCleanup(t, () => coord.close());
  await coord.waitForPresence(['coord']);
  await review(coord, work.id);
  await refused(ui, root, work.id, 'review-role');
  await review(rev, work.id);
  ok(await cland(root, 'task', 'edit', work.id, '--assignee', 'rev'));
  ok(await cland(root, 'role', 'set', 'rev', 'implementer'));
  ok(await cland(root, 'task', 'claim', work.id, '--as', 'rev', '--force'));
  ok(await cland(root, 'role', 'set', 'rev', 'reviewer'));
  await refused(ui, root, work.id, 'review-claimant');
  ok(await cland(root, 'task', 'claim', work.id, '--force'));
  await review(rev, work.id, 'not clear', 'rev-2');
  await refused(ui, root, work.id, 'review-not-clear');
  await review(rev, work.id, 'clear', 'rev-3');
  await writeFile(join(work.path, 'parser.txt'), 'unreviewed\n');
  git(work.path, 'commit', '-qam', 'After review');
  // The read preceding merge has to refresh tips itself, even before the cache's timer sees this new commit.
  await eventually('stale refusal', async () => {
    const r = await ui.request({ type: 'merge', item: work.id }, 30_000);
    return (r as { code?: string }).code === 'review-stale' ? true : undefined;
  });
  assert.equal(git(root, 'rev-parse', 'HEAD'), git(root, 'rev-parse', 'main'));
  await review(rev, work.id, 'clear', 'rev-4');
  await requireQa(root, ui, work.id);
  await refused(ui, root, work.id, 'qa-missing');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  for (const code of ['merge-branch', 'merge-item', 'review-missing', 'review-provenance', 'review-role', 'review-claimant', 'review-not-clear', 'review-stale', 'qa-missing']) assert.ok(journal.includes(`"code":"${code}"`), code);
  const agents = await ui.request({ type: 'topic.history', topic: 'agents', limit: 200 });
  assert.ok((agents.value as { messages: Array<{ text: string }> }).messages.some((m) => m.text.includes('review-claimant')));
});


test('deleting any durable hub verdict refuses with the missing run and commit, without reviving an older clear', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root);
  await review(rev, work.id, 'clear', 'older-clear');
  const older = json<{ item: { path: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  const file = join(root, older.path);
  const clearText = await readFile(file, 'utf8');
  await review(rev, work.id, 'not clear', 'deleted-not-clear');
  const tip = git(work.path, 'rev-parse', 'HEAD');
  const intact = parseItem(await readFile(file, 'utf8'), 'T-1-ship-the-parser.md');
  intact.comments.reverse();
  await writeFile(file, serializeItem(intact));
  await refused(ui, root, work.id, 'review-not-clear');
  await writeFile(file, clearText);
  const r = await refused(ui, root, work.id, 'verdict-missing');
  assert.match(r.error ?? '', /deleted-not-clear/);
  assert.ok(r.error?.includes(tip));
  // Even an older missing record blocks: durable history must remain present in the file.
  await review(rev, work.id, 'clear', 'new-clear');
  await refused(ui, root, work.id, 'verdict-missing');
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

test('a task moving during a batched freshness read is rejected at the merge decision; the next operation sees its fresh review', async t => {
  const entered = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  onCleanup(t, () => released.resolve());
  let hold = false;
  const { root, ui, rev, work } = await observableProject(t, real => async (args, input) => {
    const result = await real(args, input);
    if (hold && args[0] === 'for-each-ref') {
      hold = false;
      entered.resolve();
      await released.promise;
    }
    return result;
  });
  await review(rev, work.id);
  const before = git(root, 'rev-parse', 'dev');
  hold = true;
  const merging = ui.request({ type: 'merge', item: work.id }, 30_000);
  await entered.promise;
  await writeFile(join(work.path, 'parser.txt'), 'changed during the read\n');
  git(work.path, 'commit', '-qam', 'Move during freshness read');
  released.resolve();
  const refused = await merging;
  assert.equal(refused.ok, false, JSON.stringify(refused));
  assert.ok(['review-pending', 'review-stale'].includes((refused as { code?: string }).code ?? ''), JSON.stringify(refused));
  assert.equal(git(root, 'rev-parse', 'dev'), before);
  await eventually('moved branch settles stale', async () => {
    const read = await ui.request({ type: 'task.view', item: work.id });
    return (read.value as { item: ItemView }).item.verdicts.at(-1)?.current === false ? true : undefined;
  });
  await review(rev, work.id, 'clear', 'fresh-review');
  const merged = await ui.request({ type: 'merge', item: work.id }, 30_000);
  assert.equal(merged.ok, true, merged.error);
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'changed during the read\n');
});
