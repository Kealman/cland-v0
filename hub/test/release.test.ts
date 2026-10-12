import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, connectWsUi, spawnSpoke, startDaemon, startHub, tempProject, type CliResult } from './harness.ts';
import { preparedReleaseProject } from './prepared-project.ts';
import { Store } from '../src/hub/store.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { fixedRoles } from '../src/roles/config.ts';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const ok = (r: CliResult) => { assert.equal(r.code, 0, r.stderr || r.stdout); return r; };
const json = <T>(r: CliResult): T => JSON.parse(ok(r).stdout) as T;

async function project(t: TestContext, env: Record<string, string> = {}) {
  const { root, github } = await preparedReleaseProject(t, 'cland-release-');
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  return { root, github, ui, discovery, territory: join(root, '.cland', 'territory.git') };
}

async function merged(root: string, title: string, file: string) {
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', title, '--json'));
  const { worktree } = json<{ worktree: { path: string } }>(await cland(root, 'task', 'claim', item.id, '--json'));
  await writeFile(join(worktree.path, file), 'finished\n');
  git(worktree.path, 'add', file);
  git(worktree.path, 'commit', '-qm', title);
  ok(await cland(root, 'merge', item.id, '--override', 'test fixture'));
  return item.id;
}

test('release atomically publishes dev and an annotated tag with item titles, then advances local and territory main', async (t) => {
  const { root, github, territory } = await project(t);
  await merged(root, 'Ship the parser', 'parser.txt');
  await merged(root, 'Ship the renderer', 'renderer.txt');
  git(root, 'commit', '--allow-empty', '-qm', 'Record release metadata');
  const dev = git(root, 'rev-parse', 'dev');
  ok(await cland(root, 'release', 'v0.1.0'));
  for (const repo of [root, github, territory]) assert.equal(git(repo, 'rev-parse', 'main'), dev);
  assert.equal(git(github, 'cat-file', '-t', 'v0.1.0'), 'tag');
  assert.equal(git(github, 'rev-parse', 'v0.1.0^{}'), dev);
  assert.equal(git(github, 'for-each-ref', '--format=%(contents)', 'refs/tags/v0.1.0'), 'T-1 Ship the parser\nT-2 Ship the renderer\nRecord release metadata');
  assert.equal(git(root, 'rev-parse', 'v0.1.0'), git(github, 'rev-parse', 'v0.1.0'));
});

async function clean(root: string) {
  git(root, 'add', '.');
  git(root, 'commit', '--allow-empty', '-qm', 'Commit tracker and project setup');
}

async function collaborator(t: TestContext, github: string, file: string, content: string) {
  const clone = await tempProject(t, 'cland-collaborator-');
  git(clone, 'clone', '-q', github, '.');
  git(clone, 'config', 'user.name', 'Collaborator');
  git(clone, 'config', 'user.email', 'collaborator@example.com');
  await writeFile(join(clone, file), content);
  git(clone, 'add', file);
  git(clone, 'commit', '-qm', 'Work on GitHub');
  git(clone, 'push', '-q', 'origin', 'main');
  return git(clone, 'rev-parse', 'HEAD');
}

test('sync imports GitHub main and replays unreleased dev commits, updating the root and territory without a GitHub push', async (t) => {
  const { root, github, territory } = await project(t);
  await merged(root, 'Ship the parser', 'parser.txt');
  await clean(root);
  const oldDev = git(root, 'rev-parse', 'dev');
  const remote = await collaborator(t, github, 'collaborator.txt', 'from github\n');
  ok(await cland(root, 'sync'));
  assert.equal(git(root, 'rev-parse', 'main'), remote);
  assert.equal(git(territory, 'rev-parse', 'main'), remote);
  assert.equal(git(github, 'rev-parse', 'main'), remote);
  assert.notEqual(git(root, 'rev-parse', 'dev'), oldDev);
  assert.equal(git(root, 'rev-parse', 'HEAD'), git(root, 'rev-parse', 'dev'));
  assert.equal(git(territory, 'rev-parse', 'dev'), git(root, 'rev-parse', 'dev'));
  assert.equal(git(root, 'show', 'dev:collaborator.txt'), 'from github');
  assert.equal(await readFile(join(root, 'collaborator.txt'), 'utf8'), 'from github\n');
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'finished\n');
  assert.match(git(root, 'log', '--format=%B', 'main..dev'), /Item: T-1/);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

const snapshot = (...repos: string[]) => repos.map(repo => git(repo, 'show-ref')).join('\n---\n');

test('release refusals and dry-run keep every local, territory and GitHub ref, with named GitHub commits', async (t) => {
  const { root, github, territory } = await project(t);
  const refuses = async (args: string[], message: RegExp) => {
    const before = snapshot(root, territory, github);
    const r = await cland(root, 'release', ...args);
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, message);
    assert.equal(snapshot(root, territory, github), before);
  };
  await refuses([], /release-version/);
  await refuses(['v1'], /release-version/);
  await refuses(['v01.0.0'], /release-version/);
  await refuses(['v0.1.0'], /release-empty/);
  await merged(root, 'Ship the parser', 'parser.txt');
  const before = snapshot(root, territory, github);
  const preview = ok(await cland(root, 'release', 'v0.1.0', '--dry-run'));
  assert.match(preview.stdout, /T-1 Ship the parser/);
  assert.match(preview.stdout, /refs\/heads\/main/);
  assert.match(preview.stdout, /refs\/tags\/v0.1.0/);
  assert.equal(snapshot(root, territory, github), before);
  git(root, 'tag', 'v0.1.0');
  await refuses(['v0.1.0'], /release-tag/);
  git(root, 'tag', '-d', 'v0.1.0');
  git(github, 'tag', 'v0.1.0', 'main');
  await refuses(['v0.1.0'], /release-tag/);
  git(github, 'tag', '-d', 'v0.1.0');
  git(root, 'remote', 'remove', 'github');
  await refuses(['v0.1.0'], /release-github/);
  git(root, 'remote', 'add', 'github', github);
  await writeFile(join(root, '.git', 'MERGE_HEAD'), `${git(root, 'rev-parse', 'main')}\n`);
  await refuses(['v0.1.0'], /release-state.*MERGE_HEAD/s);
  await rm(join(root, '.git', 'MERGE_HEAD'));
  const remote = await collaborator(t, github, 'collaborator.txt', 'from github\n');
  await refuses(['v0.1.0'], new RegExp(`release-behind[\\s\\S]*${remote.slice(0, 7)} Work on GitHub[\\s\\S]*run .cland sync.`));
});

test('a rejected atomic GitHub push retains main and tags and reports the remote hook message', async (t) => {
  const { root, github, territory } = await project(t);
  await merged(root, 'Ship the parser', 'parser.txt');
  const hook = join(github, 'hooks', 'pre-receive');
  await writeFile(hook, '#!/bin/sh\necho "Release rejected by fixture policy" >&2\nexit 1\n');
  await chmod(hook, 0o755);
  const before = snapshot(root, territory, github);
  const rejected = await cland(root, 'release', 'v0.1.0');
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /Release rejected by fixture policy/);
  assert.equal(snapshot(root, territory, github), before);
  await rm(hook);
  ok(await cland(root, 'release', 'v0.1.0'));
  assert.equal(git(github, 'rev-parse', 'main'), git(root, 'rev-parse', 'dev'));
});

test('only the human and the Coordinator shell release; Implementer, Reviewer and QA shells cannot impersonate them', async (t) => {
  const { root, github, territory } = await project(t);
  await merged(root, 'Ship the parser', 'parser.txt');
  for (const role of ['implementer', 'reviewer', 'qa', 'coordinator']) {
    const name = `caller-${role}`;
    const sessionId = `${role}-id`;
    const spoke = await spawnSpoke({ discover: true, cwd: root, name, sessionId, role });
    t.after(() => spoke.close());
    await spoke.waitForPresence([name]);
    const before = snapshot(root, territory, github);
    const r = await clandWithEnv(root, { CLAND_SESSION_NAME: name, CLAND_SESSION_ID: sessionId, CLAND_ROLE: 'coordinator' }, 'release', 'v0.1.0');
    if (role === 'coordinator') ok(r);
    else { assert.notEqual(r.code, 0); assert.match(r.stderr, /may not use release/); assert.equal(snapshot(root, territory, github), before); }
    const tools = await spoke.client.listTools();
    assert.equal(tools.tools.some(tool => tool.name === 'release' || tool.name === 'sync'), false);
  }
});

test('sync refuses a dirty root, and a replay conflict names its files while preserving every ref and root file', async (t) => {
  const { root, github, territory, ui } = await project(t);
  await merged(root, 'Change the readme', 'README.md');
  await clean(root);
  await collaborator(t, github, 'README.md', 'from github\n');
  const before = snapshot(root, territory, github);
  await writeFile(join(root, 'local.txt'), 'keep my work\n');
  const dirty = await ui.request({ type: 'sync' }, 30_000);
  assert.equal(dirty.ok, false);
  assert.match(dirty.error ?? '', /sync-dirty/);
  assert.equal(await readFile(join(root, 'local.txt'), 'utf8'), 'keep my work\n');
  await rm(join(root, 'local.txt'));
  const conflict = await ui.request({ type: 'sync' }, 30_000);
  assert.equal(conflict.ok, false);
  assert.match(conflict.error ?? '', /sync-conflict/);
  assert.deepEqual((conflict as { files?: string[] }).files, ['README.md']);
  assert.equal(snapshot(root, territory, github), before);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'finished\n');
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.equal(git(root, 'worktree', 'list', '--porcelain').includes('sync-'), false);
});

test('a release accepted by GitHub but blocked locally reports follow-up and retries the same tag after a hub restart', async (t) => {
  const { root, github, territory } = await project(t);
  await merged(root, 'Ship the parser', 'parser.txt');
  const dev = git(root, 'rev-parse', 'dev');
  const main = git(root, 'rev-parse', 'main');
  const lock = join(root, '.git', 'refs', 'heads', 'main.lock');
  await writeFile(lock, 'fixture obstruction\n');
  const r = json<{ commit: string; followUp?: { error: string } }>(await cland(root, 'release', 'v0.1.0', '--json'));
  assert.equal(r.commit, dev);
  assert.match(r.followUp?.error ?? '', /released; follow-up failed.*main.lock/s);
  assert.equal(git(github, 'rev-parse', 'main'), dev);
  assert.equal(git(root, 'rev-parse', 'main'), main);
  assert.equal(git(root, 'tag', '--list'), '');
  const tag = git(github, 'rev-parse', 'v0.1.0');
  ok(await cland(root, 'hub', 'stop'));
  await rm(lock);
  await startDaemon(t, root);
  const retry = json<{ commit: string; followUp?: unknown }>(await cland(root, 'release', 'v0.1.0', '--json'));
  assert.equal(retry.commit, dev);
  assert.equal(retry.followUp, undefined);
  assert.equal(git(root, 'rev-parse', 'main'), dev);
  assert.equal(git(territory, 'rev-parse', 'main'), dev);
  assert.equal(git(root, 'rev-parse', 'v0.1.0'), tag);
});

test('release territory failure is recoverable without publishing later dev work', async (t) => {
  const { root, github, territory } = await project(t);
  await merged(root, 'Ship the parser', 'parser.txt');
  const dev = git(root, 'rev-parse', 'dev');
  const hook = join(territory, 'hooks', 'pre-receive');
  await writeFile(hook, '#!/bin/sh\necho "Territory unavailable" >&2\nexit 1\n');
  await chmod(hook, 0o755);
  const r = json<{ followUp?: { error: string } }>(await cland(root, 'release', 'v0.1.0', '--json'));
  assert.match(r.followUp?.error ?? '', /Territory unavailable/);
  git(root, 'commit', '--allow-empty', '-qm', 'Later work');
  await rm(hook);
  ok(await cland(root, 'release', 'v0.1.0'));
  for (const repo of [root, territory, github]) assert.equal(git(repo, 'rev-parse', 'main'), dev);
  assert.notEqual(git(root, 'rev-parse', 'dev'), dev);
});

test('sync territory failure retries its prepared replay and blocks release until the territory is repaired', async (t) => {
  const { root, github, territory, ui } = await project(t);
  await merged(root, 'Ship the parser', 'parser.txt');
  await clean(root);
  await collaborator(t, github, 'collaborator.txt', 'from github\n');
  const hook = join(territory, 'hooks', 'pre-receive');
  await writeFile(hook, '#!/bin/sh\necho "Territory unavailable" >&2\nexit 1\n');
  await chmod(hook, 0o755);
  const r = json<{ main: string; dev: string; followUp?: { error: string } }>(await cland(root, 'sync', '--json'));
  assert.match(r.followUp?.error ?? '', /Territory unavailable/);
  const before = snapshot(root, territory, github);
  const release = await ui.request({ type: 'release', version: 'v0.1.0' }, 30_000);
  assert.equal(release.ok, false, 'a pending sync must finish before GitHub publication');
  assert.match(release.error ?? '', /sync-recovery/);
  assert.equal(snapshot(root, territory, github), before);
  await rm(hook);
  const retry = json<{ main: string; dev: string; followUp?: unknown }>(await cland(root, 'sync', '--json'));
  assert.equal(retry.main, r.main);
  assert.equal(retry.dev, r.dev);
  assert.equal(retry.followUp, undefined);
  assert.equal(git(territory, 'rev-parse', 'dev'), r.dev);
});

test('notes read Git trailers, not Item lines in prose, and retain subjects for removed items', async (t) => {
  const { root, github } = await project(t);
  git(root, 'commit', '--allow-empty', '-qm', 'Explain the notation\n\nItem: T-99\n\nThis is prose after the example.');
  git(root, 'commit', '--allow-empty', '-qm', 'A removed item\n\nItem: T-42');
  ok(await cland(root, 'release', 'v0.1.0'));
  assert.equal(git(github, 'for-each-ref', '--format=%(contents)', 'refs/tags/v0.1.0'), 'T-42 A removed item\nExplain the notation');
});

test('release refuses multiple GitHub push destinations because their refs cannot form one atomic push', async (t) => {
  const { root, github, territory } = await project(t);
  const second = await tempProject(t, 'cland-second-github-');
  git(root, 'clone', '-q', '--bare', github, second);
  git(root, 'config', '--add', 'remote.github.pushurl', github);
  git(root, 'config', '--add', 'remote.github.pushurl', second);
  git(root, 'commit', '--allow-empty', '-qm', 'Release this commit');
  const before = snapshot(root, territory, github, second);
  const r = await cland(root, 'release', 'v0.1.0');
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /release-github.*one push destination/s);
  assert.equal(snapshot(root, territory, github, second), before);
});

test('a lost successful GitHub push reply recovers from its receipt even after the unreferenced tag object is pruned', async (t) => {
  const bin = await tempProject(t, 'cland-git-wrapper-');
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const wrapper = join(bin, 'git');
  const marker = join(bin, 'lose-next-reply');
  await writeFile(wrapper, `#!/bin/sh\nif [ "$1" = push ]; then\n  '${realGit.replaceAll("'", "'\\''")}' "$@"\n  code=$?\n  if [ "$code" = 0 ] && [ -f "$CLAND_LOST_PUSH_MARKER" ]; then\n    rm "$CLAND_LOST_PUSH_MARKER"\n    echo "Fixture lost the push reply" >&2\n    exit 1\n  fi\n  exit "$code"\nfi\nexec '${realGit.replaceAll("'", "'\\''")}' "$@"\n`);
  await chmod(wrapper, 0o755);
  const { root, github, territory } = await project(t, { PATH: `${bin}:${process.env.PATH}`, CLAND_LOST_PUSH_MARKER: marker });
  await merged(root, 'Ship the parser', 'parser.txt');
  const main = git(root, 'rev-parse', 'main');
  const dev = git(root, 'rev-parse', 'dev');
  await writeFile(marker, 'lose reply\n');
  const lost = await cland(root, 'release', 'v0.1.0');
  assert.notEqual(lost.code, 0);
  assert.match(lost.stderr, /Fixture lost the push reply/);
  assert.equal(git(root, 'rev-parse', 'main'), main);
  assert.equal(git(root, 'tag', '--list'), '');
  assert.equal(git(github, 'rev-parse', 'main'), dev);
  const tag = git(github, 'rev-parse', 'v0.1.0');
  git(root, 'gc', '--prune=now');
  ok(await cland(root, 'release', 'v0.1.0'));
  assert.equal(git(root, 'rev-parse', 'v0.1.0'), tag);
  assert.equal(git(territory, 'rev-parse', 'main'), dev);
});

test('post-merge topic discussion permits CLI sync without reviving the task or its worktree', async t => {
  const { root, github, ui } = await project(t);
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', 'Completed parser', '--json'));
  const created = await ui.request({ type: 'topic.create', title: 'Parser discussion', item: item.id });
  assert.equal(created.ok, true, created.error);
  const topic = (created.value as { topic: { id: string } }).topic.id;
  const { worktree } = json<{ worktree: { path: string } }>(await cland(root, 'task', 'claim', item.id, '--json'));
  await writeFile(join(worktree.path, 'parser.txt'), 'finished\n');
  git(worktree.path, 'add', 'parser.txt');
  git(worktree.path, 'commit', '-qm', 'Parser');
  ok(await cland(root, 'merge', item.id, '--override', 'test fixture'));
  const posted = await ui.request({ type: 'topic.send', topic, text: 'Later discussion' });
  assert.equal(posted.ok, true, posted.error);
  await clean(root);
  const remote = await collaborator(t, github, 'collaborator.txt', 'from github\n');
  ok(await cland(root, 'sync'));
  assert.equal(git(root, 'rev-parse', 'main'), remote);
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'finished\n');
  const view = json<{ item: { state: string } }>(await cland(root, 'task', 'view', item.id, '--json')).item;
  assert.equal(view.state, 'closed');
  await assert.rejects(readFile(join(worktree.path, 'parser.txt')), { code: 'ENOENT' });
});

test('sync refuses a landed merge with pending tracker completion, preserving its retry identity', async (t) => {
  const { root, github, territory, discovery } = await project(t);
  const { item } = json<{ item: { id: string; file: string } }>(await cland(root, 'task', 'create', 'Ship the parser', '--json'));
  const { worktree } = json<{ worktree: { path: string } }>(await cland(root, 'task', 'claim', item.id, '--json'));
  await writeFile(join(worktree.path, 'parser.txt'), 'finished\n');
  git(worktree.path, 'add', 'parser.txt');
  git(worktree.path, 'commit', '-qm', 'Parser');
  const obstruction = join(root, '.cland', 'tasks', `.${item.file}.${discovery.pid}.tmp`);
  await mkdir(obstruction);
  const landed = json<{ commit: string; followUp?: { step: string } }>(await cland(root, 'merge', item.id, '--override', 'fixture', '--json'));
  assert.equal(landed.followUp?.step, 'close');
  await rm(obstruction, { recursive: true });
  await clean(root);
  await collaborator(t, github, 'collaborator.txt', 'from github\n');
  const before = snapshot(root, territory, github);
  const sync = await cland(root, 'sync');
  assert.notEqual(sync.code, 0);
  assert.match(sync.stderr, new RegExp(`sync-recovery.*pending cland merge ${item.id}`));
  assert.equal(snapshot(root, territory, github), before);
  const retry = json<{ commit: string; followUp?: unknown }>(await cland(root, 'merge', item.id, '--json'));
  assert.equal(retry.commit, landed.commit);
  assert.equal(retry.followUp, undefined);
  await clean(root);
  ok(await cland(root, 'sync'));
  assert.equal(git(root, 'log', '--format=%B', 'main..dev').match(/Item: T-1/g)?.length, 1);
});

test('a release success-record failure retains its same-version recovery receipt', async (t) => {
  const { root, github } = await project(t);
  await merged(root, 'Ship the parser', 'parser.txt');
  ok(await cland(root, 'hub', 'stop'));
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  let fail = true;
  const hub = await startHub({ tracker, store: new Store(join(root, '.cland', 'hub.db')), roles: fixedRoles(), log: entry => {
    if (entry.event === 'released' && fail) { fail = false; throw new Error('Fixture record failure'); }
  } });
  t.after(async () => { await hub.close(); await tracker.stop(); });
  const ui = await connectWsUi(t, hub);
  const first = await ui.request({ type: 'release', version: 'v0.1.0' }, 30_000);
  assert.equal(first.ok, true, first.error);
  const result = first.value as { commit: string; followUp?: { step: string; error: string } };
  assert.equal(result.followUp?.step, 'record');
  assert.match(result.followUp?.error ?? '', /Fixture record failure/);
  assert.equal(git(github, 'rev-parse', 'main'), result.commit);
  const retry = await ui.request({ type: 'release', version: 'v0.1.0' }, 30_000);
  assert.equal(retry.ok, true, retry.error);
  assert.deepEqual((retry.value as { commit: string }).commit, result.commit);
  assert.equal((retry.value as { followUp?: unknown }).followUp, undefined);
});

test('a fully rolled-back merge preparation does not prevent sync or a later merge', async (t) => {
  const { root, github, territory } = await project(t);
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', 'Ship the parser', '--json'));
  const { worktree } = json<{ worktree: { path: string } }>(await cland(root, 'task', 'claim', item.id, '--json'));
  await writeFile(join(worktree.path, 'parser.txt'), 'finished\n');
  git(worktree.path, 'add', 'parser.txt');
  git(worktree.path, 'commit', '-qm', 'Parser');
  const before = git(root, 'rev-parse', 'dev');
  const hook = join(territory, 'hooks', 'pre-receive');
  await writeFile(hook, '#!/bin/sh\necho "Reject merge" >&2\nexit 1\n');
  await chmod(hook, 0o755);
  assert.notEqual((await cland(root, 'merge', item.id, '--override', 'fixture')).code, 0);
  assert.equal(git(root, 'rev-parse', 'dev'), before);
  assert.equal(git(territory, 'rev-parse', 'dev'), before);
  await rm(hook);
  await clean(root);
  await collaborator(t, github, 'collaborator.txt', 'from github\n');
  ok(await cland(root, 'sync'));
  ok(await cland(root, 'merge', item.id, '--override', 'fixture'));
  assert.equal(git(root, 'log', '--format=%B', 'main..dev').match(/Item: T-1/g)?.length, 1);
});

test('sync success-record failure prevents a later merge until its same-replay retry completes', async (t) => {
  const { root, github } = await project(t);
  await merged(root, 'Ship the parser', 'parser.txt');
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', 'Later work', '--json'));
  const id = item.id;
  const { worktree } = json<{ worktree: { path: string } }>(await cland(root, 'task', 'claim', id, '--json'));
  await writeFile(join(worktree.path, 'later.txt'), 'later\n');
  git(worktree.path, 'add', 'later.txt');
  git(worktree.path, 'commit', '-qm', 'Later work');
  await clean(root);
  await collaborator(t, github, 'collaborator.txt', 'from github\n');
  ok(await cland(root, 'hub', 'stop'));
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  let fail = true;
  const hub = await startHub({ tracker, store: new Store(join(root, '.cland', 'hub.db')), roles: fixedRoles(), log: entry => {
    if (entry.event === 'synced' && fail) { fail = false; throw new Error('Fixture sync record failure'); }
  } });
  t.after(async () => { await hub.close(); await tracker.stop(); });
  const ui = await connectWsUi(t, hub);
  const first = await ui.request({ type: 'sync' }, 30_000);
  assert.equal(first.ok, true, first.error);
  const result = first.value as { main: string; dev: string; followUp?: { step: string } };
  assert.equal(result.followUp?.step, 'record');
  const merge = await ui.request({ type: 'merge', item: id, override: 'fixture' }, 30_000);
  assert.equal(merge.ok, false, 'pending sync must keep its prepared dev tip');
  assert.match(merge.error ?? '', /merge-recovery.*pending cland sync/s);
  const retry = await ui.request({ type: 'sync' }, 30_000);
  assert.equal(retry.ok, true, retry.error);
  assert.deepEqual(retry.value, { main: result.main, dev: result.dev });
  assert.equal((await ui.request({ type: 'merge', item: id, override: 'fixture' }, 30_000)).ok, true);
});

test('a sync replay conflict keeps its typed code and files when scratch cleanup fails too', async t => {
  const bin = await tempProject(t, 'cland-sync-cleanup-bin-');
  const marker = join(bin, 'fail-cleanup');
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
  await writeFile(join(bin, 'git'), `#!/bin/sh
if [ "$1" = worktree ] && [ -f ${quote(marker)} ]; then
  case "$2" in remove|prune) echo 'fixture scratch cleanup unavailable' >&2; exit 1;; esac
fi
exec ${quote(realGit)} "$@"
`, { mode: 0o755 });
  const { root, github, territory, ui } = await project(t, { PATH: `${bin}:${process.env.PATH}` });
  await merged(root, 'Change the readme', 'README.md');
  await clean(root);
  await collaborator(t, github, 'README.md', 'from github\n');
  const before = snapshot(root, territory, github);
  await writeFile(marker, 'fail');
  const conflict = await ui.request({ type: 'sync' }, 30_000);
  assert.equal(conflict.ok, false);
  assert.match(conflict.error ?? '', /sync-conflict/);
  assert.match(conflict.error ?? '', /cleanup failed:.*fixture scratch cleanup unavailable/);
  assert.deepEqual((conflict as { files?: string[] }).files, ['README.md']);
  assert.equal(snapshot(root, territory, github), before);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'finished\n');
  await rm(marker);
  git(root, 'worktree', 'prune');
});
