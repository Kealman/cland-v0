// T3: native Git lifecycle regressions: rejected atomic pushes, restart recovery and conflicting sync.
// The atomic release/sync core lives in scenarios/release.test.ts.
import { releaseCover } from './release-support.ts';
import { onCleanup } from './process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectWsUi, projectHub, spawnSpoke, startDaemon, startHub, tempProject } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { git, ok, json, project, merged, clean, collaborator } from './release-support.ts';
import { gitIn, initIn, masterClone, scratchMachine } from './init-machine.ts';

const snapshot = (...repos: string[]) => repos.map(repo => git(repo, 'show-ref')).join('\n---\n');

async function scratchHub(machine: Awaited<ReturnType<typeof scratchMachine>>, root: string) {
  // projectHub normally merges the host environment. Scope startup as well as Git/CLI commands
  // so injected Git config, credentials and native probes cannot reach the developer's state.
  const original = process.env;
  try {
    process.env = machine.env;
    return await projectHub(machine.context, root, {}, { probes: 'native' });
  } finally { process.env = original; }
}

// T3: native ref transactions and remote publication require real Git. All commands use a scratch HOME/XDG,
// identity and local bare GitHub stand-in; the hub runs in-process with no daemon or harness lifecycle.
test('release publishes the recorded master default without creating main', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const { clone: root, upstream: github } = await masterClone(machine);
  const readGit = async (repo: string, ...args: string[]) => ok(await gitIn(machine, repo, ...args)).stdout.trim();
  ok(await initIn(machine, root, 'init', '--json'));
  const territory = join(root, '.cland', 'territory.git');
  await readGit(root, 'add', '.');
  await readGit(root, 'commit', '-qm', 'Project setup');
  const dev = await readGit(root, 'rev-parse', 'dev');
  await scratchHub(machine, root);
  const before = await readGit(github, 'show-ref');
  await releaseCover(root);
  const preview = json<{ refs: string[] }>(await initIn(machine, root, 'release', 'v0.1.0', '--dry-run', '--json'));
  assert.deepEqual(preview.refs, [`${dev}:refs/heads/master`, 'refs/tags/v0.1.0:refs/tags/v0.1.0']);
  assert.equal(await readGit(github, 'show-ref'), before);
  await releaseCover(root);
  const released = json<{ commit: string; followUp?: unknown }>(await initIn(machine, root, 'release', 'v0.1.0', '--json'));
  assert.equal(released.commit, dev);
  assert.equal(released.followUp, undefined);
  for (const repo of [root, territory, github]) {
    assert.equal(await readGit(repo, 'rev-parse', 'master'), dev);
    assert.equal(await readGit(repo, 'rev-parse', 'v0.1.0^{}'), dev);
    assert.equal(await readGit(repo, 'for-each-ref', '--format=%(refname)', 'refs/heads/main'), '');
  }
});

// T3: Git ancestry, replay and local/remote ref isolation need native Git under scratch HOME/XDG.
test('sync imports master after release refuses commits dev lacks', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const { clone: root, upstream: github } = await masterClone(machine);
  const readGit = async (repo: string, ...args: string[]) => ok(await gitIn(machine, repo, ...args)).stdout.trim();
  ok(await initIn(machine, root, 'init', '--json'));
  await scratchHub(machine, root);
  await writeFile(join(root, 'local.txt'), 'unreleased\n');
  await readGit(root, 'add', '.');
  await readGit(root, 'commit', '-qm', 'Unreleased work');
  const dev = await readGit(root, 'rev-parse', 'dev');
  // Commit directly in the bare stand-in; no external remote or credential is used.
  const remote = await readGit(github, 'commit-tree', 'master^{tree}', '-p', 'master', '-m', 'Collaborator work');
  await readGit(github, 'update-ref', 'refs/heads/master', remote);
  const before = await readGit(github, 'show-ref');
  await releaseCover(root);
  const refused = await initIn(machine, root, 'release', 'v0.1.0', '--dry-run');
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /release-behind: github\/master has commits dev lacks/);
  assert.match(refused.stderr, /Collaborator work/);
  const synced = ok(await initIn(machine, root, 'sync'));
  assert.match(synced.stdout, new RegExp(`Synced master ${remote}; dev `));
  const territory = join(root, '.cland', 'territory.git');
  const replayed = await readGit(root, 'rev-parse', 'dev');
  assert.notEqual(replayed, dev);
  for (const repo of [root, territory]) {
    assert.equal(await readGit(repo, 'rev-parse', 'master'), remote);
    assert.equal(await readGit(repo, 'rev-parse', 'dev'), replayed);
    assert.equal(await readGit(repo, 'for-each-ref', '--format=%(refname)', 'refs/heads/main'), '');
  }
  assert.equal(await readFile(join(root, 'local.txt'), 'utf8'), 'unreleased\n');
  assert.equal(await readGit(root, 'status', '--porcelain'), '');
  assert.equal(await readGit(github, 'show-ref'), before, 'sync never pushes to GitHub');
});

// T3: the legacy default must survive real Git replay and a pinned publication retry, not just config parsing.
test('legacy publication receipts recover main without a recorded default', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const { clone: root, upstream: github } = await masterClone(machine);
  const readGit = async (repo: string, ...args: string[]) => ok(await gitIn(machine, repo, ...args)).stdout.trim();
  ok(await initIn(machine, root, 'init', '--json'));
  const territory = join(root, '.cland', 'territory.git');
  for (const repo of [root, territory, github]) await readGit(repo, 'branch', '-m', 'master', 'main');
  await readGit(territory, 'config', '--unset', 'cland.defaultBranch');
  await scratchHub(machine, root);
  await readGit(root, 'add', '.');
  await readGit(root, 'commit', '-qm', 'Project setup');
  const remote = await readGit(github, 'commit-tree', 'main^{tree}', '-p', 'main', '-m', 'Collaborator work');
  await readGit(github, 'update-ref', 'refs/heads/main', remote);
  const synced = ok(await initIn(machine, root, 'sync'));
  assert.match(synced.stdout, new RegExp(`Synced main ${remote}; dev `));
  const dev = await readGit(root, 'rev-parse', 'dev');
  const lock = join(root, '.git', 'refs', 'heads', 'main.lock');
  await writeFile(lock, 'fixture obstruction\n');
  await releaseCover(root);
  const released = json<{ followUp?: { step: string } }>(await initIn(machine, root, 'release', 'v0.1.0', '--json'));
  assert.equal(released.followUp?.step, 'local refs');
  const receipt = JSON.parse(await readFile(join(root, '.cland', 'release.tmp'), 'utf8'));
  assert.deepEqual(Object.keys(receipt).sort(), ['commit', 'github', 'main', 'notes', 'tag', 'version']);
  assert.equal(receipt.main, remote);
  await rm(lock);
  await readGit(root, 'commit', '--allow-empty', '-qm', 'Later dev work');
  await releaseCover(root);
  const retry = json<{ commit: string; followUp?: unknown }>(await initIn(machine, root, 'release', 'v0.1.0', '--json'));
  assert.equal(retry.commit, dev);
  assert.equal(retry.followUp, undefined);
  for (const repo of [root, territory, github]) assert.equal(await readGit(repo, 'rev-parse', 'main'), dev);
});

// T3: native Git commit selection and unchanged refs prove the publication boundary; no hub process starts.
test('release checks the committed dev package version before preview or publication', { timeout: 5_000 }, async t => {
  const { root, github, territory, ui } = await project(t, undefined, undefined, true);
  const path = join(root, 'package.json');
  await writeFile(path, '{"version":"0.1.3"}\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Record package version');
  const before = snapshot(root, territory, github);
  // An uncommitted bump must not change the version of the build selected from dev.
  await writeFile(path, '{"version":"0.1.4"}\n');
  const status = git(root, 'status', '--porcelain');
  for (const flags of [['--dry-run'], []]) {
    await releaseCover(root);
    const refused = await cland(root, 'release', 'v0.1.4', ...flags);
    assert.notEqual(refused.code, 0);
    assert.match(refused.stderr, /release-version: dev's package.json says 0\.1\.3, the release is v0\.1\.4/);
    assert.match(refused.stderr, /commit the bump on dev, merge it, then preview again/);
    assert.equal(snapshot(root, territory, github), before);
    assert.equal(await readFile(path, 'utf8'), '{"version":"0.1.4"}\n');
    assert.equal(git(root, 'status', '--porcelain'), status);
    await assert.rejects(readFile(join(root, '.cland', 'release.tmp')), { code: 'ENOENT' });
  }
  git(root, 'add', 'package.json');
  git(root, 'commit', '-qm', 'Bump package to 0.1.4');
  const bumped = snapshot(root, territory, github);
  await releaseCover(root);
  const preview = await ui.request({ type: 'release', version: 'v0.1.4', dryRun: true });
  assert.equal(preview.ok, true, preview.error);
  assert.equal((preview.value as { commit: string }).commit, git(root, 'rev-parse', 'dev'));
  assert.equal(snapshot(root, territory, github), bumped);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

// T3: native Git publication remains available for a package without a version.
test('release permits a package without a version key', { timeout: 5_000 }, async t => {
  const { root, github, territory, ui } = await project(t, undefined, undefined, true);
  await writeFile(join(root, 'package.json'), '{"private":true}\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Record unversioned package');
  const dev = git(root, 'rev-parse', 'dev');
  await releaseCover(root);
  const preview = await ui.request({ type: 'release', version: 'v0.1.4', dryRun: true });
  assert.equal(preview.ok, true, preview.error);
  await releaseCover(root);
  const released = await ui.request({ type: 'release', version: 'v0.1.4' });
  assert.equal(released.ok, true, released.error);
  for (const repo of [root, territory, github]) {
    assert.equal(git(repo, 'rev-parse', 'main'), dev);
    assert.equal(git(repo, 'rev-parse', 'v0.1.4^{}'), dev);
  }
  assert.equal(await readFile(join(root, 'package.json'), 'utf8'), '{"private":true}\n');
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('release refusals and dry-run keep every local, territory and GitHub ref, with named GitHub commits', async (t) => {
  const { root, github, territory, ui } = await project(t, undefined, undefined, true);
  const refuses = async (args: string[], message: RegExp, direct = false) => {
    const before = snapshot(root, territory, github);
    if (direct) {
      await releaseCover(root);
      const r = await ui.request({ type: 'release', ...(args[0] ? { version: args[0] } : {}) });
      assert.equal(r.ok, false);
      assert.match(r.error ?? '', message);
    } else {
      await releaseCover(root);
      const r = await cland(root, 'release', ...args);
      assert.notEqual(r.code, 0);
      assert.match(r.stderr, message);
    }
    assert.equal(snapshot(root, territory, github), before);
  };
  await refuses([], /release-version/);
  await refuses(['v1'], /release-version/, true);
  await refuses(['v01.0.0'], /release-version/, true);
  await refuses(['v0.1.0'], /release-empty/);
  await merged(root, 'Ship the parser', 'GLOSSARY.md');
  const before = snapshot(root, territory, github);
  await releaseCover(root);
  const preview = ok(await cland(root, 'release', 'v0.1.0', '--dry-run'));
  assert.match(preview.stdout, /T-1 Ship the parser/);
  assert.match(preview.stdout, /refs\/heads\/main/);
  assert.match(preview.stdout, /refs\/tags\/v0.1.0/);
  assert.equal(snapshot(root, territory, github), before);
  git(root, 'tag', 'v0.1.0');
  await refuses(['v0.1.0'], /release-tag/);
  git(root, 'tag', '-d', 'v0.1.0');
  git(github, 'tag', 'v0.1.0', 'main');
  await refuses(['v0.1.0'], /release-tag/, true);
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
  await merged(root, 'Ship the parser', 'GLOSSARY.md');
  const hook = join(github, 'hooks', 'pre-receive');
  await writeFile(hook, '#!/bin/sh\necho "Release rejected by fixture policy" >&2\nexit 1\n');
  await chmod(hook, 0o755);
  const before = snapshot(root, territory, github);
  await releaseCover(root);
  const rejected = await cland(root, 'release', 'v0.1.0');
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /Release rejected by fixture policy/);
  assert.equal(snapshot(root, territory, github), before);
  await rm(hook);
  await releaseCover(root);
  ok(await cland(root, 'release', 'v0.1.0'));
  assert.equal(git(github, 'rev-parse', 'main'), git(root, 'rev-parse', 'dev'));
});

test('only the human and the Coordinator shell release; Implementer, Reviewer and QA shells cannot impersonate them', async (t) => {
  const { root, github, territory } = await project(t);
  await merged(root, 'Ship the parser', 'GLOSSARY.md');
  await releaseCover(root);
  for (const role of ['implementer', 'reviewer', 'qa', 'coordinator']) {
    const name = `caller-${role}`;
    const sessionId = `${role}-id`;
    const spoke = await spawnSpoke({ discover: true, cwd: root, name, sessionId, role });
    onCleanup(t, () => spoke.close());
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
  const { root, github, territory, ui } = await project(t, undefined, undefined, true);
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
  const { root, github, territory } = await project(t, undefined, startDaemon);
  await merged(root, 'Ship the parser', 'GLOSSARY.md');
  const dev = git(root, 'rev-parse', 'dev');
  const main = git(root, 'rev-parse', 'main');
  const lock = join(root, '.git', 'refs', 'heads', 'main.lock');
  await writeFile(lock, 'fixture obstruction\n');
  await releaseCover(root);
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
  await releaseCover(root);
  const retry = json<{ commit: string; followUp?: unknown }>(await cland(root, 'release', 'v0.1.0', '--json'));
  assert.equal(retry.commit, dev);
  assert.equal(retry.followUp, undefined);
  assert.equal(git(root, 'rev-parse', 'main'), dev);
  assert.equal(git(territory, 'rev-parse', 'main'), dev);
  assert.equal(git(root, 'rev-parse', 'v0.1.0'), tag);
});

test('release territory failure is recoverable without publishing later dev work', async (t) => {
  const { root, github, territory } = await project(t);
  await merged(root, 'Ship the parser', 'GLOSSARY.md');
  const dev = git(root, 'rev-parse', 'dev');
  const hook = join(territory, 'hooks', 'pre-receive');
  await writeFile(hook, '#!/bin/sh\necho "Territory unavailable" >&2\nexit 1\n');
  await chmod(hook, 0o755);
  await releaseCover(root);
  const r = json<{ followUp?: { error: string } }>(await cland(root, 'release', 'v0.1.0', '--json'));
  assert.match(r.followUp?.error ?? '', /Territory unavailable/);
  git(root, 'commit', '--allow-empty', '-qm', 'Later work');
  await rm(hook);
  await releaseCover(root);
  ok(await cland(root, 'release', 'v0.1.0'));
  for (const repo of [root, territory, github]) assert.equal(git(repo, 'rev-parse', 'main'), dev);
  assert.notEqual(git(root, 'rev-parse', 'dev'), dev);
});

test('sync territory failure retries its prepared replay and blocks release until the territory is repaired', async (t) => {
  const { root, github, territory, ui } = await project(t);
  await merged(root, 'Ship the parser', 'GLOSSARY.md');
  await clean(root);
  await collaborator(t, github, 'collaborator.txt', 'from github\n');
  const hook = join(territory, 'hooks', 'pre-receive');
  await writeFile(hook, '#!/bin/sh\necho "Territory unavailable" >&2\nexit 1\n');
  await chmod(hook, 0o755);
  const r = json<{ main: string; dev: string; followUp?: { error: string } }>(await cland(root, 'sync', '--json'));
  assert.match(r.followUp?.error ?? '', /Territory unavailable/);
  const before = snapshot(root, territory, github);
  await releaseCover(root);
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
  await releaseCover(root);
  ok(await cland(root, 'release', 'v0.1.0'));
  assert.equal(git(github, 'for-each-ref', '--format=%(contents)', 'refs/tags/v0.1.0'), 'T-42 A removed item\nExplain the notation');
});

test('release refuses multiple GitHub push destinations because their refs cannot form one atomic push', async (t) => {
  const { root, github, territory, ui } = await project(t, undefined, undefined, true);
  const second = await tempProject(t, 'cland-second-github-');
  git(root, 'clone', '-q', '--bare', github, second);
  git(root, 'config', '--add', 'remote.github.pushurl', github);
  git(root, 'config', '--add', 'remote.github.pushurl', second);
  git(root, 'commit', '--allow-empty', '-qm', 'Release this commit');
  const before = snapshot(root, territory, github, second);
  await releaseCover(root);
  const r = await ui.request({ type: 'release', version: 'v0.1.0' });
  assert.equal(r.ok, false);
  assert.match(r.error ?? '', /release-github.*one push destination/s);
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
  await merged(root, 'Ship the parser', 'GLOSSARY.md');
  const main = git(root, 'rev-parse', 'main');
  const dev = git(root, 'rev-parse', 'dev');
  await writeFile(marker, 'lose reply\n');
  await releaseCover(root);
  const lost = await cland(root, 'release', 'v0.1.0');
  assert.notEqual(lost.code, 0);
  assert.match(lost.stderr, /Fixture lost the push reply/);
  assert.equal(git(root, 'rev-parse', 'main'), main);
  assert.equal(git(root, 'tag', '--list'), '');
  assert.equal(git(github, 'rev-parse', 'main'), dev);
  const tag = git(github, 'rev-parse', 'v0.1.0');
  git(root, 'gc', '--prune=now');
  await releaseCover(root);
  ok(await cland(root, 'release', 'v0.1.0'));
  assert.equal(git(root, 'rev-parse', 'v0.1.0'), tag);
  assert.equal(git(territory, 'rev-parse', 'main'), dev);
});

test('post-merge topic discussion permits CLI sync without reviving the task or its worktree', async t => {
  const { root, github, ui } = await project(t);
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--size', 'M', 'Completed parser', '--json'));
  const created = await ui.request({ type: 'topic.create', title: 'Parser discussion', item: item.id });
  assert.equal(created.ok, true, created.error);
  const topic = (created.value as { topic: { id: string } }).topic.id;
  const { worktree } = json<{ worktree: { path: string } }>(await cland(root, 'task', 'claim', item.id, '--json'));
  await writeFile(join(worktree.path, 'GLOSSARY.md'), 'finished\n');
  git(worktree.path, 'add', 'GLOSSARY.md');
  git(worktree.path, 'commit', '-qm', 'Parser');
  ok(await cland(root, 'merge', item.id, '--override', 'test fixture'));
  const posted = await ui.request({ type: 'topic.send', topic, text: 'Later discussion' });
  assert.equal(posted.ok, true, posted.error);
  await clean(root);
  const remote = await collaborator(t, github, 'collaborator.txt', 'from github\n');
  ok(await cland(root, 'sync'));
  assert.equal(git(root, 'rev-parse', 'main'), remote);
  assert.equal(await readFile(join(root, 'GLOSSARY.md'), 'utf8'), 'finished\n');
  const view = json<{ item: { state: string } }>(await cland(root, 'task', 'view', item.id, '--json')).item;
  assert.equal(view.state, 'closed');
  await assert.rejects(readFile(join(worktree.path, 'GLOSSARY.md')), { code: 'ENOENT' });
});

test('sync refuses a landed merge with pending tracker completion, preserving its retry identity', async (t) => {
  const { root, github, territory, discovery } = await project(t);
  const { item } = json<{ item: { id: string; file: string } }>(await cland(root, 'task', 'create', '--size', 'M', 'Ship the parser', '--json'));
  const { worktree } = json<{ worktree: { path: string } }>(await cland(root, 'task', 'claim', item.id, '--json'));
  await writeFile(join(worktree.path, 'GLOSSARY.md'), 'finished\n');
  git(worktree.path, 'add', 'GLOSSARY.md');
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
  const { root, github } = await project(t, undefined, startDaemon);
  await merged(root, 'Ship the parser', 'GLOSSARY.md');
  ok(await cland(root, 'hub', 'stop'));
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  let fail = true;
  const hub = await startHub({ tracker, store: new Store(join(root, '.cland', 'hub.db')), roles: fixedRoles(), log: entry => {
    if (entry.event === 'released' && fail) { fail = false; throw new Error('Fixture record failure'); }
  } });
  onCleanup(t, () => hub.close());
  onCleanup(t, () => tracker.stop());
  const ui = await connectWsUi(t, hub);
  await releaseCover(root);
  const first = await ui.request({ type: 'release', version: 'v0.1.0' }, 30_000);
  assert.equal(first.ok, true, first.error);
  const result = first.value as { commit: string; followUp?: { step: string; error: string } };
  assert.equal(result.followUp?.step, 'record');
  assert.match(result.followUp?.error ?? '', /Fixture record failure/);
  assert.equal(git(github, 'rev-parse', 'main'), result.commit);
  await releaseCover(root);
  const retry = await ui.request({ type: 'release', version: 'v0.1.0' }, 30_000);
  assert.equal(retry.ok, true, retry.error);
  assert.deepEqual((retry.value as { commit: string }).commit, result.commit);
  assert.equal((retry.value as { followUp?: unknown }).followUp, undefined);
});

test('a fully rolled-back merge preparation does not prevent sync or a later merge', async (t) => {
  const { root, github, territory } = await project(t);
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--size', 'M', 'Ship the parser', '--json'));
  const { worktree } = json<{ worktree: { path: string } }>(await cland(root, 'task', 'claim', item.id, '--json'));
  await writeFile(join(worktree.path, 'GLOSSARY.md'), 'finished\n');
  git(worktree.path, 'add', 'GLOSSARY.md');
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
  const { root, github } = await project(t, undefined, startDaemon);
  await merged(root, 'Ship the parser', 'GLOSSARY.md');
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--size', 'M', 'Later work', '--json'));
  const id = item.id;
  const { worktree } = json<{ worktree: { path: string } }>(await cland(root, 'task', 'claim', id, '--json'));
  await writeFile(join(worktree.path, 'README.md'), 'later\n');
  git(worktree.path, 'add', 'README.md');
  git(worktree.path, 'commit', '-qm', 'Later work');
  await clean(root);
  await collaborator(t, github, 'collaborator.txt', 'from github\n');
  ok(await cland(root, 'hub', 'stop'));
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  let fail = true;
  const hub = await startHub({ tracker, store: new Store(join(root, '.cland', 'hub.db')), roles: fixedRoles(), log: entry => {
    if (entry.event === 'synced' && fail) { fail = false; throw new Error('Fixture sync record failure'); }
  } });
  onCleanup(t, () => hub.close());
  onCleanup(t, () => tracker.stop());
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

test('release consumes genuine verification tree receipts across committed tracker and rulebook changes', async t => {
  const { root, ui } = await project(t, undefined, undefined, true);
  const created = await ui.request({ type: 'task.create', size: 'M', title: 'Committed tracker metadata' });
  assert.equal(created.ok, true);
  const rulebook = join(root, '.cland/RULES.md');
  await writeFile(rulebook, '# Rules\n\nA project rule.\n');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'Release build with metadata');
  const cover = await releaseCover(root);
  const { candidateTree } = await import('../src/verification-tree.ts');
  assert.equal(cover.tree, await candidateTree(root, cover.head));
  assert.notEqual(cover.tree, git(root, 'rev-parse', 'dev^{tree}'), 'receipt excludes committed metadata');
  ok(await cland(root, 'release', 'v0.1.0', '--dry-run'));
  await writeFile(rulebook, '# Rules\n\nAn amended project rule.\n');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'Metadata-only later head');
  assert.notEqual(git(root, 'rev-parse', 'dev'), cover.head);
  ok(await cland(root, 'release', 'v0.1.0', '--dry-run'));
  await writeFile(join(root, 'README.md'), 'A different build\n');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'Changed executable build');
  const missing = await cland(root, 'release', 'v0.1.0', '--dry-run');
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /release-t3: no green T3/);
});
