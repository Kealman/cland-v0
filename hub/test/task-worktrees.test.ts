// Task branches and worktrees (T-58; T-20 decisions D3, D7, D8): real Git on disk in a temporary project with a
// territory, a real hub, the CLI as its own process, a Coordinator spoke over MCP and the fake Claude Code at the
// harness boundary (the launch cwd, the claim, the WorktreeCreate hook it runs).
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CLI_ENTRY, cland, clandWithEnv, connectUi, connectWsUi, startHub, eventually, fakeClaude, spawnSpoke, startDaemon, tempProject, type CliResult, type FrameClient } from './harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import type { Sessions } from '../src/adapters/sessions.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { provisionTerritory } from '../src/territory.ts';
import { Report } from '../src/init/files.ts';

const git = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
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
  const root = await tempProject(t, 'cland-worktrees-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Initial');
  if (options.territory !== false) ok(await cland(root, 'init', '--json'));
  return root;
}

type Notice = { text: string; kind?: string; detail?: Record<string, unknown> };
const agentsNotices = async (ui: FrameClient, kind: string): Promise<Notice[]> => {
  const r = await ui.request({ type: 'topic.history', topic: 'agents', limit: 200 });
  assert.equal(r.ok, true, r.error);
  return (r.value as { messages: Notice[] }).messages.filter((m) => m.kind === kind);
};

test('the first claim of an open task makes t/T-<n>-<slug> at dev and its worktree, writes branch: and tells Agents; later claims reuse both', async (t) => {
  const root = await project(t);
  // dev moves ahead of main: the branch starts at dev's tip
  git(root, 'commit', '--allow-empty', '-qm', 'On dev');
  const devTip = git(root, 'rev-parse', 'dev');
  assert.notEqual(devTip, git(root, 'rev-parse', 'main'));
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  ok(await cland(root, 'task', 'create', 'Fix the parser', '--kind', 'task'));

  const first = json<Claimed>(await cland(root, 'task', 'claim', 'T-1', '--json'));
  assert.equal(first.claim?.session, 'human');
  const path = join(root, '.cland', 'worktrees', 'T-1');
  assert.deepEqual(first.worktree, { item: 'T-1', branch: 't/T-1-fix-the-parser', path, base: 'dev', createdBranch: true, createdWorktree: true });
  assert.equal(git(root, 'rev-parse', 't/T-1-fix-the-parser'), devTip);
  assert.equal(git(path, 'branch', '--show-current'), 't/T-1-fix-the-parser');
  // linked to the project's own repository (D3): one common Git directory
  assert.equal(git(path, 'rev-parse', '--git-common-dir'), join(root, '.git'));
  assert.match(await readFile(join(root, '.cland', 'tasks', 'T-1-fix-the-parser.md'), 'utf8'), /^branch: t\/T-1-fix-the-parser$/m);
  const notice = await eventually('the worktree notice', async () => (await agentsNotices(ui, 'worktree'))[0]);
  assert.equal(notice.text, 'T-1: branch t/T-1-fix-the-parser from dev and worktree .cland/worktrees/T-1 created for human');
  assert.equal(notice.detail?.item, 'T-1');
  // the text output names the worktree too
  assert.match(ok(await cland(root, 'task', 'claim', 'T-1')).stdout, /worktree {2}.*\.cland\/worktrees\/T-1 on t\/T-1-fix-the-parser\n/);

  // a work commit, then a release and a claim again: the same branch and worktree, the commit kept, no new notice
  await writeFile(join(path, 'work.txt'), 'work\n');
  git(path, 'add', 'work.txt');
  git(path, 'commit', '-qm', 'Work');
  const tip = git(path, 'rev-parse', 'HEAD');
  ok(await cland(root, 'task', 'claim', 'T-1', '--release'));
  const again = json<Claimed>(await cland(root, 'task', 'claim', 'T-1', '--json'));
  assert.deepEqual(again.worktree, { item: 'T-1', branch: 't/T-1-fix-the-parser', path, base: null, createdBranch: false, createdWorktree: false });
  assert.equal(git(root, 'rev-parse', 't/T-1-fix-the-parser'), tip);
  assert.equal((await agentsNotices(ui, 'worktree')).length, 1);
  // a branch the item already names is the one used (cland's own items carry theirs)
  ok(await cland(root, 'task', 'create', 'Named branch', '--kind', 'task'));
  ok(await cland(root, 'task', 'link', 'T-2', '--branch', 't/T-2-short'));
  assert.equal(json<Claimed>(await cland(root, 'task', 'claim', 'T-2', '--json')).worktree?.branch, 't/T-2-short');
});

test('configured container worktree refusals choose an article from the kind', async t => {
  const root = await project(t);
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["initiative", "feature"]\n');
  await startDaemon(t, root);
  for (const [kind, article, id] of [['initiative', 'an', 'T-1'], ['feature', 'a', 'T-2']]) {
    ok(await cland(root, 'task', 'create', `Planning ${kind}`, '--kind', kind!));
    const result = json<Claimed>(await cland(root, 'task', 'claim', id!, '--json'));
    assert.equal(result.worktree, null);
    assert.equal(result.reason, `${id} is ${article} ${kind}: only a task gets a branch and a worktree`);
  }
  assert.equal(existsSync(join(root, '.cland/worktrees')), false);
});

test('a release, epic, spec, question or map, a closed task, or a project without a territory gets no worktree; the claim works and says why', async (t) => {
  const root = await project(t);
  await startDaemon(t, root);
  for (const kind of ['epic', 'spec', 'question', 'map']) ok(await cland(root, 'task', 'create', `A ${kind}`, '--kind', kind));
  ok(await cland(root, 'task', 'create', 'Done already', '--kind', 'task'));
  ok(await cland(root, 'task', 'close', 'T-5'));
  ok(await cland(root, 'task', 'create', 'A release', '--kind', 'release'));
  const reasons: string[] = [];
  for (const id of ['T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6']) {
    const r = json<Claimed>(await cland(root, 'task', 'claim', id, '--json'));
    assert.equal(r.claim?.session, 'human', id);
    assert.equal(r.worktree, null, id);
    reasons.push(r.reason ?? '');
  }
  assert.deepEqual(reasons, [
    'T-1 is an epic: only a task gets a branch and a worktree',
    'T-2 is a spec: only a task gets a branch and a worktree',
    'T-3 is a question: only a task gets a branch and a worktree',
    'T-4 is a map: only a task gets a branch and a worktree',
    'T-5 is closed: no worktree',
    'T-6 is a release: only a task gets a branch and a worktree',
  ]);
  assert.match(ok(await cland(root, 'task', 'claim', 'T-1')).stdout, /worktree {2}none: T-1 is an epic/);
  assert.equal(existsSync(join(root, '.cland', 'worktrees')), false);
  assert.equal(git(root, 'branch', '--list', 't/*'), '');

  const bare = await project(t, { territory: false });
  await startDaemon(t, bare);
  ok(await cland(bare, 'task', 'create', 'No territory', '--kind', 'task'));
  const r = json<Claimed>(await cland(bare, 'task', 'claim', 'T-1', '--json'));
  assert.equal(r.claim?.session, 'human');
  assert.equal(r.worktree, null);
  assert.equal(r.reason, 'the project has no territory (cland init makes one): no branch or worktree');
});

test("the territory's cland.taskBase decides the base branch over dev (cland's own repository starts from main until T-59)", async (t) => {
  const root = await project(t);
  git(root, 'commit', '--allow-empty', '-qm', 'On dev');
  git(join(root, '.cland', 'territory.git'), 'config', 'cland.taskBase', 'main');
  await startDaemon(t, root);
  ok(await cland(root, 'task', 'create', 'From main', '--kind', 'task'));
  const r = json<Claimed>(await cland(root, 'task', 'claim', 'T-1', '--json'));
  assert.equal(r.worktree?.base, 'main');
  assert.equal(git(root, 'rev-parse', 't/T-1-from-main'), git(root, 'rev-parse', 'main'));
  git(join(root, '.cland', 'territory.git'), 'config', 'cland.taskBase', 'gone');
  ok(await cland(root, 'task', 'create', 'Bad base', '--kind', 'task'));
  const bad = json<Claimed>(await cland(root, 'task', 'claim', 'T-2', '--json'));
  assert.equal(bad.claim?.session, 'human');
  assert.equal(bad.reason, "no worktree: the territory's cland.taskBase names gone, which has no local branch");
});

test('cland session launch --item starts the Implementer in the worktree with the claim taken over from the Coordinator; its Claude Code refuses a worktree of its own', async (t) => {
  const root = await project(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  ok(await cland(root, 'task', 'create', 'Ship it', '--kind', 'task'));
  // the Coordinator claimed it first: no worktree yet (its spoke's claim makes one)
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
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: '@impl-1 worktree side-quest' })).ok, true);
  const answer = await ui.waitFor((f) => f.type === 'message' && (f.message as { from: string }).from === 'impl-1' && (f.message as { text: string }).text.startsWith('worktree side-quest: '), 30_000);
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
});

test('the spoke\'s session.launch with item launches in the worktree; a Reviewer, item with cwd, or another session\'s claim is refused', async (t) => {
  const root = await project(t);
  const fake = await fakeClaude(t);
  await startDaemon(t, root, fake.env);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  ok(await cland(root, 'task', 'create', 'Spoke item', '--kind', 'task'));
  ok(await cland(root, 'task', 'create', 'An epic', '--kind', 'epic'));
  const tool = (await coord.client.listTools()).tools.find((x) => x.name === 'session.launch');
  assert.ok(tool?.inputSchema.properties?.item);

  type Launch = { ok: boolean; error?: string; process: HarnessProcessView; claim: { session: string } | null; worktree: Worktree | null; reason?: string };
  const asReviewer = await coord.call<Launch>('session.launch', { name: 'rev-1', role: 'reviewer', harness: 'claude-code', item: 'T-1' });
  assert.equal(asReviewer.ok, false);
  assert.match(asReviewer.error ?? '', /`item` is for an Implementer/);
  const both = await coord.call<Launch>('session.launch', { name: 'impl-1', role: 'implementer', harness: 'claude-code', item: 'T-1', cwd: '.' });
  assert.equal(both.ok, false);
  assert.match(both.error ?? '', /give `item` or `cwd`, not both/);
  // the worktree exists before the session: nothing was made or launched by the refusals
  assert.equal(existsSync(join(root, '.cland', 'worktrees', 'T-1')), false);
  assert.deepEqual(await fake.sessions(), []);

  const launched = await coord.call<Launch>('session.launch', { name: 'impl-1', role: 'implementer', harness: 'claude-code', item: 'T-1' });
  assert.equal(launched.ok, true, launched.error);
  const path = join(root, '.cland', 'worktrees', 'T-1');
  assert.equal(launched.process.cwd, path);
  assert.equal(launched.worktree?.createdWorktree, true);
  assert.equal(launched.claim?.session, 'impl-1');
  assert.equal(git(path, 'branch', '--show-current'), 't/T-1-spoke-item');
  // another Implementer for an item impl-1 holds: refused, before any launch
  const second = await coord.call<Launch>('session.launch', { name: 'impl-2', role: 'implementer', harness: 'claude-code', item: 'T-1' });
  assert.equal(second.ok, false);
  assert.match(second.error ?? '', /T-1 is claimed by impl-1 \(implementer\): release it before launching another session for it/);
  assert.equal((await fake.sessions()).some((s) => s.name === 'impl-2'), false);
  // an epic: launched at the project root, with the claim, and the reason
  const epic = await coord.call<Launch>('session.launch', { name: 'impl-3', role: 'implementer', harness: 'claude-code', item: 'T-2' });
  assert.equal(epic.ok, true, epic.error);
  assert.equal(epic.process.cwd, root);
  assert.equal(epic.process.item, null);
  assert.equal(epic.worktree, null);
  assert.equal(epic.reason, 'T-2 is an epic: only a task gets a branch and a worktree');
  assert.equal(epic.claim?.session, 'impl-3');
});

test("cland worktree prune shows a closed item's unmerged commits and removes its worktree and branch only after y; a session's shell is refused", async (t) => {
  const root = await project(t);
  await startDaemon(t, root);
  for (const title of ['Merged work', 'Kept work', 'Still open']) ok(await cland(root, 'task', 'create', title, '--kind', 'task'));
  for (const id of ['T-1', 'T-2', 'T-3']) ok(await cland(root, 'task', 'claim', id));
  const wt = (id: string) => join(root, '.cland', 'worktrees', id);
  await writeFile(join(wt('T-1'), 'one.txt'), '1\n');
  git(wt('T-1'), 'add', '.');
  git(wt('T-1'), 'commit', '-qm', 'Unmerged change');
  ok(await cland(root, 'task', 'close', 'T-1'));
  ok(await cland(root, 'task', 'close', 'T-2'));

  // from a session's shell: refused as the human's, before anything is listed or removed
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'impl-9', sessionId: 'sess-impl-9', role: 'implementer' });
  t.after(() => spoke.close());
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
    const p = spawn(process.execPath, [CLI_ENTRY, 'worktree', 'prune'], { cwd: root, env });
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

// ------------------------------------------------------------------ the request budget (T-67) after the awaits

/** A Git project on its territory, with a real tracker and an in-process hub whose sessions are a stand-in. */
async function guardedHub(t: TestContext, options: { clock?: { now: number }; sessionsList?: () => HarnessProcessView[] } = {}) {
  const root = await tempProject(t, 'cland-worktrees-guard-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Initial');
  provisionTerritory(new Report(root), root);
  const records: Array<Record<string, unknown>> = [];
  const log = (r: Record<string, unknown>) => records.push(r);
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), log });
  tracker.start();
  t.after(() => tracker.stop());
  const hub = await startHub({ log, tracker, ...(options.clock ? { guard: { now: () => options.clock!.now } } : {}) });
  t.after(() => hub.close());
  const process = { name: 'impl-1', harness: 'claude-code', role: 'implementer', sessionId: 'sess-impl-1', cwd: join(root, '.cland', 'worktrees', 'T-1'), item: 'T-1', status: 'running' } as HarnessProcessView;
  hub.dispatcher.useSessions({ launch: async () => process, list: options.sessionsList ?? (() => []) } as unknown as Sessions);
  return { root, records, tracker, hub };
}

test("session.launch with an item: a synchronous branch-link subscriber after Git is timed once as resumed", async (t) => {
  const clock = { now: 0 };
  const { records, tracker, hub } = await guardedHub(t, { clock });
  const ui = await connectWsUi(t, hub, 'launcher-ui');
  assert.equal((await ui.request({ type: 'task.create', title: 'Guarded', kind: 'task' })).ok, true);
  let measured = false;
  tracker.onChange(change => {
    if (!measured && change.id === 'T-1' && change.item?.branch) {
      measured = true;
      clock.now += 400;
    }
  });
  records.length = 0;
  const r = await ui.request({ type: 'session.launch', name: 'impl-1', role: 'implementer', item: 'T-1' }, 30_000);
  assert.equal(r.ok, true, r.error);
  const slow = records.filter((x) => x.event === 'slow-request' && x.tool === 'session.launch');
  assert.deepEqual(slow.map((x) => [x.phase, x.client]), [['resumed', 'launcher-ui']], JSON.stringify(slow));
  assert.equal(measured, true, 'the real branch-link event reached its synchronous subscriber');
  assert.equal(slow[0]?.ms, 400);
});

test('worktree.list: its work after the Git reads is timed as phase resumed (a slow one is logged once)', async (t) => {
  const clock = { now: 0 };
  let slowSessions = false;
  let snapshots = 0;
  const { records, hub } = await guardedHub(t, {
    clock,
    sessionsList: () => {
      snapshots++;
      // Initial and final snapshots now surround async item/path reads: charge one continuation.
      if (slowSessions) { slowSessions = false; clock.now += 400; }
      return [];
    },
  });
  const ui = await connectWsUi(t, hub, 'list-ui');
  assert.equal((await ui.request({ type: 'task.create', title: 'Listed', kind: 'task' })).ok, true);
  assert.equal(((await ui.request({ type: 'task.claim', item: 'T-1' })).value as Claimed).worktree?.item, 'T-1');
  records.length = 0;
  snapshots = 0;
  slowSessions = true;
  const r = await ui.request({ type: 'worktree.list' }, 30_000);
  slowSessions = false;
  assert.equal(r.ok, true, r.error);
  assert.deepEqual((r.value as { worktrees: Entry[] }).worktrees.map((w) => w.item), ['T-1']);
  assert.equal(snapshots, 2, 'both the initial snapshot and the post-I/O snapshot must run');
  const slow = records.filter((x) => x.event === 'slow-request' && x.tool === 'worktree.list');
  assert.deepEqual(slow.map((x) => [x.phase, x.client]), [['resumed', 'list-ui']], JSON.stringify(slow));
  assert.ok((slow[0]?.ms as number) >= 400, `${String(slow[0]?.ms)} ms`);
});
