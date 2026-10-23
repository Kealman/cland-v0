// T3: native Git linked-worktree identity/base/reuse, first-turn cwd and WorktreeCreate refusal; interactive prune proves stdio and Git removal.
import { fixtureEnvironment, runnerFixtureEnvironment } from './fixture-environment.ts';
import { onCleanup } from './process-cleanup.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CLI_ENTRY, cland, clandWithEnv, connectUi, eventually, fakeClaude, inProcessSpoke, nativeProjectHub as projectHub, type CliResult, type FrameClient } from './harness.ts';
import { preparedProject } from './prepared-project.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

const git = (cwd: string, ...args: string[]): string => execFileSync('git', args, { env: fixtureEnvironment(cwd, process.env), cwd, encoding: 'utf8' }).trim();
const ok = (r: CliResult): CliResult => {
  assert.equal(r.code, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
};
const json = <T>(r: CliResult): T => JSON.parse(ok(r).stdout) as T;

type Worktree = { item: string; branch: string; path: string; base: string | null; createdBranch: boolean; createdWorktree: boolean };
type Claimed = { id: string; claim: { session: string; sessionId: string } | null; worktree?: Worktree | null; reason?: string };
type Entry = { item: string; path: string; branch: string | null; state: string | null; title: string | null; sessions: string[]; base: string | null; ahead: string[] };

/** A Git project on `main` with one commit, put on its territory by `cland init` (the root moves to `dev`). */
async function project(t: TestContext, options: { territory?: boolean } = {}): Promise<string> {
  const root = await preparedProject(t, options.territory === false ? 'repository' : 'territory', 'cland-worktrees-');
  return root;
}

type Notice = { text: string; kind?: string; detail?: Record<string, unknown> };
const agentsNotices = async (ui: FrameClient, kind: string): Promise<Notice[]> => {
  const r = await ui.request({ type: 'topic.history', topic: 'agents', limit: 200 });
  assert.equal(r.ok, true, r.error);
  return (r.value as { messages: Notice[] }).messages.filter((m) => m.kind === kind);
};

test('cland session launch --item starts the Implementer in the worktree with the claim taken over from the Coordinator; its Claude Code refuses a worktree of its own', async (t) => {
  const root = await project(t);
  // dev moves ahead of main: the branch starts at dev's tip
  git(root, 'commit', '--allow-empty', '-qm', 'On dev');
  const devTip = git(root, 'rev-parse', 'dev');
  assert.notEqual(devTip, git(root, 'rev-parse', 'main'));
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  onCleanup(t, () => coord.close());
  await coord.waitForPresence(['coord']);
  ok(await cland(root, 'task', 'create', '--size', 'M', 'Ship it', '--kind', 'task'));
  {
    const first = json<Claimed>(await cland(root, 'task', 'claim', 'T-1', '--json'));
    assert.equal(first.claim?.session, 'human');
    const path = join(root, '.cland', 'worktrees', 'T-1');
    assert.deepEqual(first.worktree, { item: 'T-1', branch: 't/T-1-ship-it', path, base: 'dev', createdBranch: true, createdWorktree: true });
    assert.equal(git(root, 'rev-parse', 't/T-1-ship-it'), devTip);
    assert.equal(git(path, 'branch', '--show-current'), 't/T-1-ship-it');
    // linked to the project's own repository (D3): one common Git directory
    assert.equal(git(path, 'rev-parse', '--git-common-dir'), join(root, '.git'));
    assert.match(await readFile(join(root, '.cland', 'tasks', 'T-1-ship-it.md'), 'utf8'), /^branch: t\/T-1-ship-it$/m);
    const notice = await eventually('the worktree notice', async () => (await agentsNotices(ui, 'worktree'))[0]);
    assert.equal(notice.text, 'T-1: branch t/T-1-ship-it from dev and worktree .cland/worktrees/T-1 created for human');
    assert.equal(notice.detail?.item, 'T-1');
    // the text output names the worktree too
    assert.match(ok(await cland(root, 'task', 'claim', 'T-1')).stdout, /worktree {2}.*\.cland\/worktrees\/T-1 on t\/T-1-ship-it\n/);

    // a work commit, then a release and a claim again: the same branch and worktree, the commit kept, no new notice
    await writeFile(join(path, 'work.txt'), 'work\n');
    git(path, 'add', 'work.txt');
    git(path, 'commit', '-qm', 'Work');
    const tip = git(path, 'rev-parse', 'HEAD');
    ok(await cland(root, 'task', 'claim', 'T-1', '--release'));
    const again = json<Claimed>(await cland(root, 'task', 'claim', 'T-1', '--json'));
    assert.deepEqual(again.worktree, { item: 'T-1', branch: 't/T-1-ship-it', path, base: null, createdBranch: false, createdWorktree: false });
    assert.equal(git(root, 'rev-parse', 't/T-1-ship-it'), tip);
    assert.equal((await agentsNotices(ui, 'worktree')).length, 1);
    git(root, 'merge', '--ff-only', tip);
    ok(await cland(root, 'task', 'claim', 'T-1', '--release'));
  }
  // The Coordinator takes over the released claim and reuses the proven linked worktree.
  const coordClaim = await coord.call<Claimed & { ok: boolean }>('task.claim', { id: 'T-1' });
  assert.equal(coordClaim.claim?.session, 'coord');
  const path = join(root, '.cland', 'worktrees', 'T-1');
  assert.equal(coordClaim.worktree?.path, path);

  const launched = json<{ process: HarnessProcessView; claim: { session: string; sessionId: string }; worktree: Worktree }>(
    await cland(root, 'session', 'launch', 'impl-1', '--role', 'implementer', '--harness', 'claude-code', '--item', 'T-1', '--json'),
  );
  assert.equal(launched.process.cwd, path);
  assert.equal(launched.process.item, 'T-1');
  assert.equal(launched.worktree.createdWorktree, false);
  assert.deepEqual([launched.claim.session, launched.claim.sessionId], ['impl-1', launched.process.sessionId]);
  const session = (await fake.sessions()).find((s) => s.name === 'impl-1');
  assert.equal(session?.cwd, path);
  // T-1 beside impl-1: the item's live claim is the session's
  const view = json<{ item: { claim: { session: string } } }>(await cland(root, 'task', 'view', 'T-1', '--json'));
  assert.equal(view.item.claim.session, 'impl-1');
  const took = await eventually('the takeover notice', async () => (await agentsNotices(ui, 'claim')).find((n) => n.text.includes('impl-1')));
  assert.match(took.text, /impl-1 \[Implementer\] claimed T-1 \(taken over from coord\)/);
  // the text form names the worktree
  assert.equal(launched.process.status, 'running');

  // the session's Claude Code has the WorktreeCreate hook; a worktree of its own is refused, naming its own
  const context = JSON.parse(await readFile(join(fake.home, 'jobs', `${session?.id}.context.json`), 'utf8')) as { hooks: Record<string, string[]> };
  assert.equal(context.hooks.WorktreeCreate?.length, 1);
  const command = await ui.request({ type: 'topic.send', topic: 'general', text: '@impl-1 worktree side-quest' });
  assert.equal(command.ok, true);
  const answer = await ui.waitFor((f) => f.type === 'message' && (f.message as { from: string }).from === 'impl-1' && (f.message as { text: string }).text.startsWith('worktree side-quest: '), 30_000);
  assert.deepEqual([(answer.topic as { id: string }).id, (answer.message as { replyTo?: string }).replyTo], ['general', (command.value as { message: { id: string } }).message.id]);
  const text = (answer.message as { text: string }).text;
  assert.match(text, /^worktree side-quest: refused \(exit 2\): cland: impl-1 works in its own task worktree /);
  assert.ok(text.includes(path), text);
  const refused = await eventually('the refusal in the journal', async () =>
    (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>).find((e) => e.event === 'worktree-refused'),
  );
  assert.deepEqual([refused.session, refused.worktree, refused.requested, refused.item], ['impl-1', path, 'side-quest', 'T-1']);

  // a session launched without an item gets no such hook (D8: the Coordinator's sub-agent worktrees stay)
  ok(await cland(root, 'session', 'launch', 'rev-1', '--role', 'reviewer', '--harness', 'claude-code', '--cwd', path));
  const reviewer = (await fake.sessions()).find((s) => s.name === 'rev-1');
  const reviewerContext = JSON.parse(await readFile(join(fake.home, 'jobs', `${reviewer?.id}.context.json`), 'utf8')) as { hooks: Record<string, string[]> };
  assert.equal(reviewerContext.hooks.WorktreeCreate, undefined);
  assert.equal(reviewer?.cwd, path);

  // cland worktree list: the item, its branch and state, the sessions standing inside
  const listed = json<{ worktrees: Entry[] }>(await cland(root, 'worktree', 'list', '--json')).worktrees;
  assert.equal(listed.length, 1);
  assert.deepEqual({ ...listed[0], sessions: [...(listed[0]?.sessions ?? [])].sort() }, { item: 'T-1', path, branch: 't/T-1-ship-it', state: 'open', title: 'Ship it', kind: 'task', sessions: ['impl-1', 'rev-1'], base: 'dev', ahead: [] });
  assert.match(ok(await cland(root, 'worktree', 'list')).stdout, /^T-1 {2}open {2}t\/T-1-ship-it {2}\.cland\/worktrees\/T-1\n {4}Ship it\n {4}nothing beyond dev; sessions inside: (impl-1, rev-1|rev-1, impl-1)\n$/);
  // a branch the item already names is the one used (cland's own items carry theirs)
  ok(await cland(root, 'task', 'create', '--size', 'M', 'Named branch', '--kind', 'task'));
  ok(await cland(root, 'task', 'link', 'T-2', '--branch', 't/T-2-short'));
  assert.equal(json<Claimed>(await cland(root, 'task', 'claim', 'T-2', '--json')).worktree?.branch, 't/T-2-short');
});

test("cland worktree prune shows a closed item's unmerged commits and removes its worktree and branch only after y; a session's shell is refused", async (t) => {
  const root = await project(t);
  await projectHub(t, root);
  for (const title of ['Merged work', 'Kept work', 'Still open']) ok(await cland(root, 'task', 'create', '--size', 'M', title, '--kind', 'task'));
  for (const id of ['T-1', 'T-2', 'T-3']) ok(await cland(root, 'task', 'claim', id));
  const wt = (id: string) => join(root, '.cland', 'worktrees', id);
  await writeFile(join(wt('T-1'), 'one.txt'), '1\n');
  git(wt('T-1'), 'add', '.');
  git(wt('T-1'), 'commit', '-qm', 'Unmerged change');
  ok(await cland(root, 'task', 'close', 'T-1'));
  ok(await cland(root, 'task', 'close', 'T-2'));

  // from a session's shell: refused as the human's, before anything is listed or removed
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl-9', sessionId: 'sess-impl-9', role: 'implementer' });
  onCleanup(t, () => spoke.close());
  await spoke.waitForPresence(['impl-9']);
  const refused = await clandWithEnv(root, { CLAND_SESSION_NAME: 'impl-9', CLAND_SESSION_ID: 'sess-impl-9' }, 'worktree', 'prune', '--yes');
  assert.equal(refused.code, 1, refused.stdout);
  assert.match(refused.stderr, /forbidden: worktree\.prune \(only the human may do this/);
  assert.ok(existsSync(wt('T-1')));
  // listing is anyone's
  assert.equal(json<{ worktrees: Entry[] }>(await clandWithEnv(root, { CLAND_SESSION_NAME: 'impl-9', CLAND_SESSION_ID: 'sess-impl-9' }, 'worktree', 'list', '--json')).worktrees.length, 3);

  // the human answers y for T-1 and n for T-2; T-3 is open and never offered
  const pruned = await new Promise<CliResult>((resolve, reject) => {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_')) env[k] = v;
    const p = spawn(process.execPath, [CLI_ENTRY, 'worktree', 'prune'], { cwd: root, env: runnerFixtureEnvironment(root, env) });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (c: Buffer) => (stdout += String(c)));
    p.stderr.on('data', (c: Buffer) => (stderr += String(c)));
    p.on('error', reject);
    p.on('close', (code) => resolve({ code, stdout, stderr }));
    p.stdin.end('y\nn\n');
  });
  ok(pruned);
  assert.match(pruned.stdout, /T-1 {2}closed {2}t\/T-1-merged-work/);
  assert.match(pruned.stdout, /unmerged commits \(not on dev\):\n {6}[0-9a-f]+ Unmerged change\n/);
  assert.match(pruned.stdout, /remove \.cland\/worktrees\/T-1 and t\/T-1-merged-work\? \[y\/N\]/);
  assert.match(pruned.stdout, /removed T-1: \.cland\/worktrees\/T-1 and t\/T-1-merged-work\n/);
  assert.match(pruned.stdout, /kept T-2\n/);
  assert.doesNotMatch(pruned.stdout, /T-3/);
  assert.equal(existsSync(wt('T-1')), false);
  assert.equal(git(root, 'branch', '--list', 't/T-1-merged-work'), '');
  assert.ok(existsSync(wt('T-2')));
  assert.ok(existsSync(wt('T-3')));
  // --yes takes all that is left
  const all = json<{ removed: Array<{ item: string }>; failed: unknown[]; kept: string[] }>(await cland(root, 'worktree', 'prune', '--yes', '--json'));
  assert.deepEqual(all.removed.map((r) => r.item), ['T-2']);
  assert.equal(existsSync(wt('T-2')), false);
  assert.equal(git(root, 'branch', '--list', 't/T-2-kept-work'), '');
  assert.match(ok(await cland(root, 'worktree', 'prune')).stdout, /no worktrees of closed items/);
});

test("the territory's cland.taskBase decides the base branch over dev (cland's own repository starts from main until T-59)", async (t) => {
  const root = await project(t);
  git(root, 'commit', '--allow-empty', '-qm', 'On dev');
  git(join(root, '.cland', 'territory.git'), 'config', 'cland.taskBase', 'main');
  await projectHub(t, root);
  ok(await cland(root, 'task', 'create', '--size', 'M', 'From main', '--kind', 'task'));
  const r = json<Claimed>(await cland(root, 'task', 'claim', 'T-1', '--json'));
  assert.equal(r.worktree?.base, 'main');
  assert.equal(git(root, 'rev-parse', 't/T-1-from-main'), git(root, 'rev-parse', 'main'));
  git(join(root, '.cland', 'territory.git'), 'config', 'cland.taskBase', 'gone');
  ok(await cland(root, 'task', 'create', '--size', 'M', 'Bad base', '--kind', 'task'));
  const bad = json<Claimed>(await cland(root, 'task', 'claim', 'T-2', '--json'));
  assert.equal(bad.claim?.session, 'human');
  assert.equal(bad.reason, "no worktree: the territory's cland.taskBase names gone, which has no local branch");
});

