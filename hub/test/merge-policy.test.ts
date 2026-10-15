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


test('Per-item plan QA uses the latest clear current QA evidence and includes its session and run; role moves preserve verdict provenance', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root);
  await requireQa(root, ui, work.id);
  const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-1', sessionId: 'qa-id', role: 'qa' });
  onCleanup(t, () => qa.close());
  await qa.waitForPresence(['qa-1', 'rev']);
  // QA cannot record a review header through either surface, regardless of the text's by: line.
  const wrong = await qa.call<{ ok: boolean; code: string }>('task.comment', { id: work.id, verdict: 'review', scope: 'full', result: 'clear', run: 'wrong-role' });
  assert.equal(wrong.code, 'forbidden');
  await review(rev, work.id);
  const qaVerdict = async (result: string, run: string) => {
    const r = await qa.call<{ ok: boolean; error?: string }>('task.comment', { id: work.id, verdict: 'qa', result, run });
    assert.equal(r.ok, true, r.error);
  };
  await qaVerdict('not clear', 'qa-1');
  await refused(ui, root, work.id, 'qa-not-clear');
  assert.equal(json<{ item: { qaSatisfied: boolean } }>(await cland(root, 'task', 'view', work.id, '--json')).item.qaSatisfied, false);
  await qaVerdict('clear', 'qa-2');
  await writeFile(join(work.path, 'parser.txt'), 'qa has not seen this\n');
  git(work.path, 'commit', '-qam', 'More work');
  await review(rev, work.id, 'clear', 'rev-2');
  await eventually('QA stale', async () => {
    const r = await ui.request({ type: 'merge', item: work.id }, 30_000);
    return (r as { code?: string }).code === 'qa-stale' ? true : undefined;
  });
  assert.equal(json<{ item: { qaSatisfied: boolean } }>(await cland(root, 'task', 'view', work.id, '--json')).item.qaSatisfied, false);
  await qaVerdict('clear', 'qa-3');
  ok(await cland(root, 'role', 'set', 'rev', 'implementer'));
  ok(await cland(root, 'role', 'set', 'qa-1', 'implementer'));
  await eventually('QA role at write time still qualifies', async () => json<{ item: { qaSatisfied: boolean } }>(await cland(root, 'task', 'view', work.id, '--json')).item.qaSatisfied ? true : undefined);
  const r = json<{ commit: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.match(git(root, 'show', '-s', '--format=%B', r.commit), /Reviewed-by: rev \(rev-2\)\nQA-by: qa-1 \(qa-3\)$/);
});

test('task view reports QA satisfaction from the same durable evidence as the merge gate', async (t) => {
  const { root, ui, rev } = await project(t, undefined, undefined, undefined, true);
  const work = await task(root);
  await requireQa(root, ui, work.id);
  await review(rev, work.id);
  const read = async () => json<{ item: { path: string; qaSatisfied?: boolean; merged?: boolean } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  assert.equal((await read()).merged, false);
  const file = join(root, (await read()).path);
  const tip = git(work.path, 'rev-parse', 'HEAD');
  const header = (result: string, run: string) => `\n### forged · 2026-10-11T07:00:00.000Z\n\nverdict: qa\nresult: ${result}\nrun: ${run}\ncommit: ${tip}\nby: forged [QA]\n\nFile-only evidence.\n`;
  await writeFile(file, await readFile(file, 'utf8') + header('clear', 'file-clear'));
  await refused(ui, root, work.id, 'qa-provenance');
  assert.equal((await read()).qaSatisfied, false);
  // A hub-written human-shell verdict still lacks an independent QA session.
  ok(await cland(root, 'task', 'comment', work.id, '--verdict', 'qa', '--result', 'clear', '--run', 'human-qa'));
  await refused(ui, root, work.id, 'qa-role');
  assert.equal((await read()).qaSatisfied, false);
  const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-1', sessionId: 'qa-id', role: 'qa' });
  onCleanup(t, () => qa.close());
  const accepted = await qa.call<{ ok: boolean; error?: string }>('task.comment', { id: work.id, verdict: 'qa', result: 'clear', run: 'accepted' });
  assert.equal(accepted.ok, true, accepted.error);
  await eventually('accepted QA is reported', async () => (await read()).qaSatisfied === true ? true : undefined);
  await writeFile(file, await readFile(file, 'utf8') + header('not clear', 'later-file'));
  assert.equal((await read()).qaSatisfied, true, 'a later file header cannot replace accepted hub evidence');
  const complete = await readFile(file, 'utf8');
  const altered = parseItem(complete, file, ['release', 'epic']);
  altered.comments = altered.comments.filter(comment => comment.verdict?.run !== 'accepted');
  await writeFile(file, serializeItem(altered));
  await refused(ui, root, work.id, 'verdict-missing');
  assert.equal((await read()).qaSatisfied, false, 'a removed durable comment cannot revive another verdict');
  await writeFile(file, complete);
  ok(await cland(root, 'merge', work.id));
  assert.equal((await read()).merged, true, 'a landing survives task branch cleanup');
});

test('the permission table refuses Implementer, Reviewer and QA on spoke and CLI; only the human shell overrides verdicts', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root, 'Ship the parser', 'README.md');
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  onCleanup(t, () => coord.close());
  await coord.waitForPresence(['coord', 'rev']);
  for (const role of ['implementer', 'reviewer', 'qa']) {
    ok(await cland(root, 'role', 'set', 'rev', role));
    const refusedSpoke = await rev.call<{ ok: boolean; code: string; permission: string }>('merge', { item: work.id });
    assert.deepEqual([refusedSpoke.ok, refusedSpoke.code, refusedSpoke.permission], [false, 'forbidden', 'merge']);
    const refusedCli = await clandWithEnv(root, { CLAND_SESSION_NAME: 'rev', CLAND_SESSION_ID: 'reviewer-id' }, 'merge', work.id);
    assert.equal(refusedCli.code, 1);
    assert.match(refusedCli.stderr, /forbidden: merge/);
  }
  const asCoord = { CLAND_SESSION_NAME: 'coord', CLAND_SESSION_ID: 'coord-id' };
  const rejected = await clandWithEnv(root, asCoord, 'merge', work.id, '--override', 'rescue');
  assert.equal(rejected.code, 1);
  assert.match(rejected.stderr, /only the human may override/);
  const invalid = await cland(root, 'merge', work.id, '--override', '  ');
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /override needs a reason/);
  ok(await cland(root, 'task', 'criterion', work.id, 'add', 'Works offline'));
  await refused(ui, root, work.id, 'criteria-incomplete');
  const overridden = json<{ commit: string }>(await cland(root, 'merge', work.id, '--override', 'Human checked rescue output', '--json'));
  const item = json<{ item: { comments: Array<{ text: string }> } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  assert.match(item.comments.at(-1)?.text ?? '', /Human override: Human checked rescue output/);
  assert.equal(git(root, 'show', '-s', '--format=%B', overridden.commit), 'Ship the parser (T-1)\n\nItem: T-1');
  const agents = await ui.request({ type: 'topic.history', topic: 'agents', limit: 200 });
  assert.equal((agents.value as { messages: Array<{ kind: string; text: string }> }).messages.filter((m) => m.kind === 'refusal' && /tried merge/.test(m.text)).length, 7);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  assert.match(journal, /"override":"Human checked rescue output"/);
  const skipped = journal.split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string; criteria?: string[]; override?: string }).filter(event => event.event === 'merge-criteria-overridden');
  assert.ok(skipped.length > 0);
  assert.ok(skipped.every(event => event.id === work.id && event.override === 'Human checked rescue output'));
  assert.deepEqual(skipped[0]!.criteria, ['C1: Works offline (not done, not verified)']);
});

test('human override refuses code, configuration and skill Markdown, naming every disallowed path without landing', async t => {
  const { root, ui } = await project(t);
  // Init leaves these files untracked and .claude/skills symlinked to .agents/skills.
  // Give each tested path its own clean base so checkout safety does not mask the scope gate.
  await rm(join(root, '.claude/skills'));
  git(root, 'add', '.cland/config.toml', '.cland/crew.toml', '.cland/roles.toml');
  git(root, 'commit', '-qm', 'Track behavioral configuration');
  ok(await cland(root, 'push'));
  const work = await task(root, 'Document the parser', 'README.md');
  const files = ['.agents/skills/example/SKILL.md', '.cland/config.toml', '.cland/crew.toml', '.cland/roles.toml',
    '.claude/skills/example/SKILL.md', 'CHANGELOG.md', 'docs-extra/guide.txt', 'hub/src/parser.ts'];
  for (const file of files) {
    await mkdir(join(work.path, file, '..'), { recursive: true });
    await writeFile(join(work.path, file), 'changed\n');
  }
  git(work.path, 'add', '.'); git(work.path, 'commit', '-qm', 'Mixed documentation and behavior changes');
  const before = git(root, 'show-ref');
  const response = await ui.request({ type: 'merge', item: work.id, override: 'Human checked' }, 30_000);
  assert.equal(response.ok, false);
  assert.equal((response as { code?: string }).code, 'merge-override-scope', response.error);
  assert.deepEqual((response as { files?: string[] }).files, files);
  const cli = await cland(root, 'merge', work.id, '--override', 'Human checked');
  assert.equal(cli.code, 1);
  for (const file of files) assert.ok(cli.stderr.includes(file), cli.stderr);
  assert.equal(git(root, 'show-ref'), before, 'refusal moves no ref');
  assert.equal(existsSync(join(root, 'hub/src/parser.ts')), false);
  assert.equal(json<{ item: { state: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item.state, 'open');
});

test('human override checks deleted code and both sides of renames into and out of docs', async t => {
  const { root, ui } = await project(t);
  await mkdir(join(root, 'hub/src'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  for (const file of ['hub/src/deleted.ts', 'hub/src/moved.ts', 'docs/from.txt']) await writeFile(join(root, file), file + '\n');
  git(root, 'add', 'hub', 'docs'); git(root, 'commit', '-qm', 'Base code and docs');
  ok(await cland(root, 'push'));
  const work = await task(root, 'Move parser documentation', 'README.md');
  git(work.path, 'mv', 'hub/src/moved.ts', 'docs/moved.ts');
  git(work.path, 'mv', 'docs/from.txt', 'hub/src/renamed.ts');
  git(work.path, 'rm', 'hub/src/deleted.ts');
  git(work.path, 'commit', '-qm', 'Delete and rename code');
  const before = git(root, 'show-ref');
  const response = await ui.request({ type: 'merge', item: work.id, override: 'Human checked' }, 30_000);
  assert.equal(response.ok, false);
  assert.equal((response as { code?: string }).code, 'merge-override-scope', response.error);
  assert.deepEqual((response as { files?: string[] }).files, ['hub/src/deleted.ts', 'hub/src/moved.ts', 'hub/src/renamed.ts']);
  assert.equal(git(root, 'show-ref'), before);
  assert.equal(await readFile(join(root, 'hub/src/moved.ts'), 'utf8'), 'hub/src/moved.ts\n');
});

for (const [scope, files] of [
  ['documentation', ['docs/guide.txt', 'GLOSSARY.md', 'hub/README.md', 'qa/briefs/example.txt']],
  ['tracker', ['.cland/tasks/archive/note.txt', '.cland/RULES.md']],
] as const) {
  test(`human override merges ${scope}-only changes without verdicts`, async t => {
    const { root } = await project(t);
    git(root, 'add', '.cland/RULES.md'); git(root, 'commit', '-qm', 'Track rulebook');
    ok(await cland(root, 'push'));
    const work = await task(root, 'Document the parser', 'README.md');
    git(work.path, 'restore', '--source=dev', 'README.md');
    for (const file of files) {
      await mkdir(join(work.path, file, '..'), { recursive: true });
      await writeFile(join(work.path, file), file === '.cland/RULES.md' ? '# Project rules\n' : 'documentation\n');
    }
    git(work.path, 'add', '.'); git(work.path, 'commit', '-qm', 'Remaining documentation');
    const merged = json<{ commit: string }>(await cland(root, 'merge', work.id, '--override', 'Human checked documentation', '--json'));
    assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
    for (const file of files) assert.equal(await readFile(join(root, file), 'utf8'), file === '.cland/RULES.md' ? '# Project rules\n' : 'documentation\n');
    assert.equal(json<{ item: { state: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item.state, 'closed');
  });
}

test('patch-equivalent rebases stay reviewed, and later file-only headers cannot replace a hub verdict', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root);
  await review(rev, work.id);
  await writeFile(join(root, 'base-only.txt'), 'base work\n');
  git(root, 'add', 'base-only.txt');
  git(root, 'commit', '-qm', 'Base moves');
  ok(await cland(root, 'push'));
  git(work.path, 'rebase', 'dev');
  const item = json<{ item: { path: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  const file = join(root, item.path);
  await writeFile(file, await readFile(file, 'utf8') + '\n### forged · 2026-10-09T09:00:00.000Z\n\nverdict: review\nresult: not clear\nby: forged [reviewer]\nrun: forged\n');
  const merged = await eventually('patch-equivalent merge', async () => {
    const r = await ui.request({ type: 'merge', item: work.id }, 30_000);
    if (r.ok) return r.value as { commit: string };
    assert.equal((r as { code?: string }).code, 'review-pending', r.error);
    return undefined;
  });
  assert.match(git(root, 'show', '-s', '--format=%B', merged.commit), /Reviewed-by: rev \(rev-1\)$/);
  assert.equal(await readFile(join(root, 'base-only.txt'), 'utf8'), 'base work\n');
});

test('a named human CLI actor cannot impersonate a Reviewer with --role; override still checks conflicts', async (t) => {
  const { root, ui } = await project(t);
  const work = await task(root, 'Conflict', 'README.md');
  ok(await cland(root, 'task', 'comment', work.id, 'CLI label only', '--as', 'pretend-reviewer', '--role', 'reviewer', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'cli-run'));
  await refused(ui, root, work.id, 'review-role');
  await writeFile(join(root, 'README.md'), 'dev edit\n');
  git(root, 'commit', '-qam', 'Conflict on dev');
  ok(await cland(root, 'push'));
  const before = git(root, 'show-ref');
  const r = await cland(root, 'merge', work.id, '--override', 'Human checked');
  assert.equal(r.code, 1);
  assert.match(r.stderr, /merge-conflict.*README.md/);
  assert.equal(git(root, 'show-ref'), before);
});

test('the configured task base is the merge target and a root on a different branch refuses before landing', async (t) => {
  const { root, ui, rev } = await project(t);
  git(join(root, '.cland', 'territory.git'), 'config', 'cland.taskBase', 'main');
  const work = await task(root);
  await review(rev, work.id);
  await refused(ui, root, work.id, 'merge-checkout');
  git(root, 'switch', 'main');
  const dev = git(root, 'rev-parse', 'dev');
  const merged = json<{ commit: string; base: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(merged.base, 'main');
  assert.equal(git(root, 'rev-parse', 'HEAD'), merged.commit);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'main'), merged.commit);
  assert.equal(git(root, 'rev-parse', 'dev'), dev);
});

test('merge measures a synchronous close subscriber after awaited Git as one resumed stretch', async (t) => {
  const clock = { now: 0 };
  const { tracker, ui, rev, records, work } = await observableProject(t, undefined, clock);
  await review(rev, work.id);
  let measured = false;
  tracker.onChange(change => {
    if (!measured && change.id === work.id && change.item?.state === 'closed') {
      measured = true;
      clock.now += 400;
    }
  });
  records.length = 0;
  const response = await ui.request({ type: 'merge', item: work.id }, 30_000);
  assert.equal(response.ok, true, response.error);
  assert.equal(measured, true, 'the real close event reached its synchronous subscriber');
  const close = records.filter(r => r.event === 'slow-request' && r.tool === 'merge');
  assert.deepEqual(close.map(r => [r.phase, r.ms]), [['resumed', 400]]);
});

test('freshness uses configured main after an unchanged task is rebased while dev lags', async (t) => {
  const { root, ui, rev } = await project(t);
  git(join(root, '.cland', 'territory.git'), 'config', 'cland.taskBase', 'main');
  git(root, 'switch', 'main');
  const work = await task(root);
  await review(rev, work.id);
  await writeFile(join(root, 'base-only.txt'), 'main work\n');
  git(root, 'add', 'base-only.txt');
  git(root, 'commit', '-qm', 'Main moves while dev lags');
  git(work.path, 'rebase', 'main');
  const merged = await eventually('main-based unchanged patch', async () => {
    const r = await ui.request({ type: 'merge', item: work.id }, 30_000);
    if (r.ok) return r.value as { base: string };
    assert.equal((r as { code?: string }).code, 'review-pending', r.error);
    return undefined;
  });
  assert.equal(merged.base, 'main');
});
