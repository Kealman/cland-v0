// T3: native Git squash publication, CLI landing inspection and worktree/session cleanup boundaries.
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup } from './process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, eventually, inProcessSpoke, nativeProjectHub, tempProject } from './harness.ts';
import { parseItem } from '../src/tracker/item.ts';
import { git, ok, json, project, task, review } from './merge-native-support.ts';


test('a current hub review lands one squash commit in the root and territory, closes the item and topic, and removes its worktree and branch', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root);
  const topic = await ui.request({ type: 'topic.create', title: 'Parser', item: work.id });
  assert.equal(topic.ok, true, topic.error);
  const before = git(root, 'rev-parse', 'dev');
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: work.id, verdict: 'review', scope: 'full', result: 'clear', run: 'rev-1' })).ok, true);
  await eventually('ready without criteria', async () => {
    const v = json<{ item: { status: string; criteria: unknown[] } }>(await cland(root, 'task', 'view', work.id, '--json'));
    assert.deepEqual(v.item.criteria, []);
    return v.item.status === 'ready' ? true : undefined;
  });
  const itemPath = join(root, '.cland/tasks/T-1-ship-the-parser.md');
  const retainedClosed = '2001-01-01T00:00:00.000Z';
  await writeFile(itemPath, (await readFile(itemPath, 'utf8')).replace(/^updated:.*\n/m, line => `${line}closed: ${retainedClosed}\n`));
  const merged = json<{ commit: string; base: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(merged.base, 'dev');
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  assert.equal(git(root, 'rev-parse', 'HEAD'), merged.commit);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), merged.commit);
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'finished\n');
  assert.equal(git(root, 'show', '-s', '--format=%B', merged.commit), 'Ship the parser (T-1)\n\nItem: T-1\nReviewed-by: rev (rev-1)');
  const view = json<{ item: { state: string; closed: string; claim: unknown; comments: Array<{ text: string }> } }>(await cland(root, 'task', 'view', work.id, '--json'));
  assert.equal(view.item.state, 'closed');
  assert.match(view.item.closed, /^\d{4}-\d\d-\d\dT/);
  assert.notEqual(view.item.closed, retainedClosed, 'merge records the new close after a hand reopen');
  assert.equal(parseItem(await readFile(join(root, '.cland/tasks/T-1-ship-the-parser.md'), 'utf8')).fm.closed, view.item.closed);
  assert.equal(view.item.claim, null);
  assert.ok(view.item.comments.at(-1)?.text.includes(merged.commit));
  assert.equal(existsSync(work.path), false);
  assert.equal(git(root, 'branch', '--list', work.branch), '');
  const history = await ui.request({ type: 'topic.history', topic: (topic.value as { topic: { id: string } }).topic.id });
  assert.equal((history.value as { topic: { status: string } }).topic.status, 'closed');
  const agents = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.ok((agents.value as { messages: Array<{ text: string }> }).messages.some((m) => m.text.includes(merged.commit)));
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8'), /"event":"task-merged"/);
});

test('discussion after a completed merge never blocks CLI push or recreates its worktree', async t => {
  const { root, ui, rev, stop } = await project(t);
  const work = await task(root);
  const created = await ui.request({ type: 'topic.create', title: 'Landed task', item: work.id });
  assert.equal(created.ok, true, created.error);
  const topic = (created.value as { topic: { id: string } }).topic.id;
  await review(rev, work.id);
  ok(await cland(root, 'merge', work.id));
  assert.equal(existsSync(work.path), false);
  const posted = await ui.request({ type: 'topic.send', topic, text: 'A follow-up discussion after landing' });
  assert.equal(posted.ok, true, posted.error);
  git(root, 'add', '.cland/tasks');
  git(root, 'commit', '-qm', 'Record completed tracker');
  ok(await cland(root, 'push'));
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), git(root, 'rev-parse', 'dev'));
  await stop();
  await nativeProjectHub(t, root, {}, { harnesses: 'fake' });
  ok(await cland(root, 'push'));
  assert.equal(existsSync(work.path), false);
  assert.equal(git(root, 'branch', '--list', work.branch), '');
});

test('CLI reopen of a landed task refuses with a follow-up path, then push succeeds without an orphan worktree', async t => {
  const { root, rev } = await project(t);
  const work = await task(root);
  await review(rev, work.id);
  ok(await cland(root, 'merge', work.id));
  for (const args of [['--state', 'open'], ['--status', 'backlog']]) {
    const reopened = await cland(root, 'task', 'edit', work.id, ...args);
    assert.notEqual(reopened.code, 0, 'a landed task cannot start a second work round');
    assert.match(reopened.stderr, /already merged.*follow-up.*cland task create/s);
    const view = json<{ item: { state: string; status: string; claim: unknown } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
    assert.equal(view.state, 'closed');
    assert.equal(view.status, 'done');
    assert.equal(view.claim, null);
  }
  git(root, 'add', '.cland/tasks');
  git(root, 'commit', '-qm', 'Record completed tracker');
  ok(await cland(root, 'push'));
  assert.equal(existsSync(work.path), false);
  assert.equal(git(root, 'branch', '--list', work.branch), '');
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--size', 'M', 'Parser follow-up', '--json'));
  const { worktree } = json<{ worktree: { path: string } }>(await cland(root, 'task', 'claim', item.id, '--json'));
  assert.equal(git(worktree.path, 'rev-parse', 'HEAD'), git(root, 'rev-parse', 'dev'), 'a follow-up starts from current dev');
  assert.equal(await readFile(join(worktree.path, 'parser.txt'), 'utf8'), 'finished\n');
});

test('CLI reopen preserves a landed task when Git cannot inspect its receipt', async t => {
  const bin = await tempProject(t, 'cland-reopen-git-');
  const unavailable = join(bin, 'unavailable');
  const realGit = execFileSync('which', ['git'], { env: fixtureEnvironment(bin, process.env), encoding: 'utf8' }).trim();
  const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
  await writeFile(join(bin, 'git'), `#!/bin/sh
if [ "$1" = show ] && [ -f ${quote(unavailable)} ]; then
  echo 'fixture landing inspection unavailable' >&2
  exit 3
fi
exec ${quote(realGit)} "$@"
`, { mode: 0o755 });
  const { root, rev } = await project(t, { PATH: `${bin}:${process.env.PATH}` });
  const work = await task(root);
  await review(rev, work.id);
  ok(await cland(root, 'merge', work.id));
  await writeFile(unavailable, 'fail Git inspection\n');
  const reopened = await cland(root, 'task', 'edit', work.id, '--state', 'open');
  assert.notEqual(reopened.code, 0);
  assert.match(reopened.stderr, /fixture landing inspection unavailable/);
  const view = json<{ item: { state: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  assert.equal(view.state, 'closed');
  assert.equal(existsSync(work.path), false);
});

test('CLI merge removes a closed landed task stale worktree when dev contains its changed branch', async t => {
  const { root, rev } = await project(t);
  const work = await task(root);
  await review(rev, work.id);
  const merged = json<{ commit: string }>(await cland(root, 'merge', work.id, '--json'));
  git(root, 'add', '.cland/tasks');
  git(root, 'commit', '-qm', 'Tracker after landing');
  ok(await cland(root, 'push'));
  const dev = git(root, 'rev-parse', 'dev');
  const other = join(root, '.cland', 'other-worktree');
  git(root, 'worktree', 'add', '-b', 'keep-other-work', other, dev);
  await writeFile(join(other, 'unfinished.txt'), 'keep this work\n');
  git(root, 'worktree', 'add', '-b', work.branch, work.path, dev);
  const cleaned = json<{ commit: string; cleanup: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(cleaned.commit, merged.commit, 'cleanup never lands another squash');
  assert.equal(cleaned.cleanup, 'removed');
  assert.equal(cleaned.followUp, undefined);
  assert.equal(git(root, 'rev-parse', 'dev'), dev);
  assert.equal(existsSync(work.path), false);
  assert.equal(git(root, 'branch', '--list', work.branch), '');
  assert.equal(await readFile(join(other, 'unfinished.txt'), 'utf8'), 'keep this work\n');
  assert.equal(git(other, 'rev-parse', 'HEAD'), dev);
  assert.equal(git(other, 'branch', '--show-current'), 'keep-other-work');
  ok(await cland(root, 'push'));
});

test('simultaneous Coordinator spoke merges serialize and the second commit includes the first task', async (t) => {
  const { root, rev } = await project(t);
  const one = await task(root, 'First task', 'one.txt');
  const two = await task(root, 'Second task', 'two.txt');
  await review(rev, one.id);
  await review(rev, two.id);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  onCleanup(t, () => coord.close());
  await coord.waitForPresence(['coord', 'rev']);
  const before = git(root, 'rev-parse', 'dev');
  const results = await Promise.all([one, two].map((w) => coord.call<{ ok: boolean; commit: string; error?: string }>('merge', { item: w.id })));
  for (const r of results) assert.equal(r.ok, true, r.error);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '2');
  const first = results[0]!.commit;
  const second = results[1]!.commit;
  assert.equal(git(root, 'rev-parse', `${second}^`), first);
  assert.equal(git(root, 'rev-parse', `${first}^`), before);
  assert.equal(git(root, 'rev-parse', 'dev'), second);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), second);
  assert.equal(await readFile(join(root, 'one.txt'), 'utf8'), 'finished\n');
  assert.equal(await readFile(join(root, 'two.txt'), 'utf8'), 'finished\n');
});

test('merge closes the item while a launched session is inside, then removes the worktree and branch after it stops', async (t) => {
  const { root, ui, rev } = await project(t);
  // Keep the session alive to exercise deferred cleanup after an explicit stop.
  assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.stop_after', value: 'never' })).ok, true);
  const work = await task(root);
  ok(await cland(root, 'session', 'launch', 'impl-1', '--role', 'implementer', '--harness', 'claude-code', '--item', work.id));
  await review(rev, work.id);
  const tip = git(work.path, 'rev-parse', 'HEAD');
  const result = json<{ cleanup: string; commit: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(result.cleanup, 'waiting for sessions');
  assert.equal(git(root, 'rev-parse', work.branch), tip, 'merge never rewrites the task branch');
  assert.ok(existsSync(work.path));
  const view = json<{ item: { state: string; claim: unknown } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  assert.equal(view.state, 'closed');
  assert.equal(view.claim, null);
  ok(await cland(root, 'session', 'stop', 'impl-1'));
  await eventually('deferred cleanup after session stop', () => !existsSync(work.path) ? true : undefined, 30_000);
  await eventually('branch removed too', () => git(root, 'branch', '--list', work.branch) === '' ? true : undefined);
  assert.equal(git(root, 'rev-parse', 'dev'), result.commit);
});
