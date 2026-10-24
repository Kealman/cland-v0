// T2: worktree policy uses injected territory facts/operations, real tracker persistence and in-process MCP.
// Native Git branch identity, first-turn cwd/hook enforcement and interactive prune are in the lifecycle split.
import { onCleanup } from './process-cleanup.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { TaskWorktrees, type WorktreeGit, type Resumed } from '../src/hub/worktrees.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { RequestGuard } from '../src/hub/budget.ts';
import { projectSessions } from '../src/adapters/index.ts';
import { parseRoles } from '../src/roles/config.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { fakeHarness, FAKE_FLAVOURS } from './fakes/harness.ts';
import { FakeClock } from './fake-clock.ts';
import { cland, connectUi, inProcessSpoke, projectHub, startHub, tempProject } from './harness.ts';

const human = { id: 'human', name: 'human', role: null };
type Worktree = Awaited<ReturnType<WorktreeGit['ensureTaskWorktree']>>;
async function fixture(t: TestContext, options: { territory?: boolean; levels?: string[]; sessionsList?: () => Array<{ name: string; cwd: string }> } = {}) {
  const root = await tempProject(t, 'cland-worktrees-policy-');
  const clock = new FakeClock();
  const records: Array<Record<string, unknown>> = [];
  const log = (entry: Record<string, unknown>) => { records.push(entry); };
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), clock, log, git: async () => null,
    ...(options.levels ? { levels: options.levels } : {}) });
  onCleanup(t, () => tracker.stop());
  const guard = new RequestGuard({ log, now: () => clock.now().getTime() });
  const roles = parseRoles('[coordinator]\n[implementer]\n[reviewer]\n');
  const hub = await startHub({ root, clock, tracker, log, roles: { get: () => roles }, requestGuard: guard,
    hasTerritory: async () => false, git: async () => null });
  onCleanup(t, () => hub.close());
  const project = projectSessions({ core: hub.core, root, discoveryFile: '', log, tracker,
    adapters: FAKE_FLAVOURS.map(flavour => (host, clock) => fakeHarness(flavour, { host, clock })) });
  onCleanup(t, () => project.close());
  hub.dispatcher.useSessions(project.sessions);
  const calls: Array<{ root: string; item: { id: string; slug: string; branch: string | null } }> = [];
  const entries = new Map<string, Worktree>();
  let base: string | null = 'dev';
  let refusal: Error | null = null;
  let listed: Array<Awaited<ReturnType<WorktreeGit['listTaskWorktrees']>>[number]> = [];
  const git: WorktreeGit = {
    ensureTaskWorktree: async (root, item, resumed = work => work(), authorize = () => {}) => {
      calls.push({ root, item });
      resumed(authorize);
      if (refusal) throw refusal;
      const existing = entries.get(item.id);
      if (existing) return { ...existing, base: null, createdBranch: false, createdWorktree: false };
      const path = join(root, '.cland/worktrees', item.id);
      await mkdir(path, { recursive: true });
      const value = { item: item.id, path, branch: item.branch ?? `t/${item.id}-${item.slug}`, base, createdBranch: true, createdWorktree: true };
      entries.set(item.id, value);
      return value;
    },
    taskBase: async () => base,
    listTaskWorktrees: async () => listed,
    commitsAhead: async () => [],
    removeTaskWorktree: async () => { throw new Error('removal belongs to native prune proof'); },
  };
  const worktrees = new TaskWorktrees({ tracker, log, git, hasTerritory: async () => options.territory !== false,
    sessions: options.sessionsList ?? (() => project.sessions.list().map(p => ({ name: p.name, cwd: p.cwd }))) });
  const create = (title: string, kind = 'task') => tracker.create(human, { title, kind });
  const claim = async (id: string) => {
    const result = await tracker.claim(human, id);
    return { ...result, ...await worktrees.afterClaim(id, 'human') };
  };
  return { root, clock, records, tracker, hub, guard, project, worktrees, calls, entries, create, claim,
    set base(value: string | null) { base = value; }, set refusal(value: Error | null) { refusal = value; },
    set listed(value: typeof listed) { listed = value; } };
}

test('task worktree policy links creation once and reuses the territory result on reclaim', async t => {
  const f = await fixture(t);
  await f.create('Fix the parser');
  const first = await f.claim('T-1');
  const path = join(f.root, '.cland/worktrees/T-1');
  assert.equal(first.claim?.session, 'human');
  assert.deepEqual(first.worktree, { item: 'T-1', branch: 't/T-1-fix-the-parser', path, base: 'dev', createdBranch: true, createdWorktree: true });
  assert.deepEqual(f.calls[0], { root: f.root, item: { id: 'T-1', slug: 'fix-the-parser', branch: null } });
  assert.match(await readFile(join(f.root, '.cland/tasks/T-1-fix-the-parser.md'), 'utf8'), /^branch: t\/T-1-fix-the-parser$/m);
  const notice = f.records.find(entry => entry.event === 'task-worktree')!;
  assert.equal(notice.id, 'T-1');
  assert.equal(notice.session, 'human');
  assert.equal(notice.path, '.cland/worktrees/T-1');
  await f.tracker.claim(human, 'T-1', { release: true });
  const again = await f.claim('T-1');
  assert.deepEqual(again.worktree, { item: 'T-1', branch: 't/T-1-fix-the-parser', path, base: null, createdBranch: false, createdWorktree: false });
  assert.equal(f.records.filter(entry => entry.event === 'task-worktree').length, 1);
  await f.create('Named branch');
  await f.tracker.link(human, 'T-2', { branch: 't/T-2-short' });
  assert.equal((await f.claim('T-2')).worktree?.branch, 't/T-2-short');
  assert.equal(f.calls.at(-1)!.item.branch, 't/T-2-short');
});

test('task claim links root dependencies including playwright-core without installing', async t => {
  const f = await fixture(t);
  await mkdir(join(f.root, 'node_modules/playwright-core'), { recursive: true });
  await writeFile(join(f.root, 'node_modules/playwright-core/package.json'), JSON.stringify({ name: 'playwright-core', version: '1.64.1', main: 'index.js' }));
  await writeFile(join(f.root, 'node_modules/playwright-core/index.js'), 'module.exports = "scratch playwright";');
  await f.create('Dependency link');
  const claimed = await f.claim('T-1');
  assert.ok(claimed.worktree);
  assert.equal(await realpath(join(claimed.worktree.path, 'node_modules')), join(f.root, 'node_modules'));
  const require = createRequire(join(claimed.worktree.path, 'package.json'));
  assert.equal(require('playwright-core'), 'scratch playwright');
});

test('reclaim names a stale worktree own install and preserves its files', async t => {
  const f = await fixture(t);
  await f.create('Stale own install');
  const first = await f.claim('T-1');
  const path = first.worktree!.path;
  await writeFile(join(path, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/playwright-core': { version: '1.64.1' } } }));
  await mkdir(join(path, 'node_modules'), { recursive: true });
  await writeFile(join(path, 'node_modules/.package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/playwright-core': { version: '1.60.0' } } }));
  const again = await f.claim('T-1');
  assert.match((again.worktree as { warning?: string }).warning ?? '', /stale worktree install/);
  assert.ok((again.worktree as { warning?: string }).warning?.includes(path));
  assert.match((again.worktree as { warning?: string }).warning ?? '', /own node_modules/);
  assert.match(await readFile(join(path, 'node_modules/.package-lock.json'), 'utf8'), /1.60.0/);
});

test('reclaim identifies a stale dependency link and a missing root install', async t => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'package.json'), '{"name":"scratch"}');
  await f.create('Absent install');
  const missing = await f.claim('T-1');
  assert.match(missing.worktree?.warning ?? '', /root node_modules.*missing/);
  await mkdir(join(f.root, 'node_modules'), { recursive: true });
  await writeFile(join(f.root, 'node_modules/.package-lock.json'), JSON.stringify({ packages: {} }));
  await writeFile(join(missing.worktree!.path, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/playwright-core': { version: '1.64.1' } } }));
  const linked = await f.claim('T-1');
  assert.match(linked.worktree?.warning ?? '', /stale worktree install.*node_modules link/);
  assert.ok(linked.worktree?.warning?.includes(linked.worktree.path));
});

test('reclaim checks actual packages when hidden install metadata matches', async t => {
  for (const kind of ['own', 'link']) for (const actual of ['missing', 'older']) await t.test(`${kind}: ${actual}`, async t => {
    const f = await fixture(t);
    await f.create('Matching metadata');
    const first = await f.claim('T-1');
    const path = first.worktree!.path;
    const modules = kind === 'own' ? join(path, 'node_modules') : join(f.root, 'node_modules');
    await mkdir(modules, { recursive: true });
    const lock = JSON.stringify({ packages: { 'node_modules/playwright-core': { version: '1.64.1' } } });
    await writeFile(join(path, 'package-lock.json'), lock);
    await writeFile(join(modules, '.package-lock.json'), lock);
    if (actual === 'older') {
      await mkdir(join(modules, 'playwright-core'), { recursive: true });
      await writeFile(join(modules, 'playwright-core/package.json'), JSON.stringify({ name: 'playwright-core', version: '1.60.0' }));
    }
    const again = await f.claim('T-1');
    assert.match(again.worktree?.warning ?? '', /stale worktree install/);
    assert.ok(again.worktree?.warning?.includes(path));
    assert.match(again.worktree?.warning ?? '', kind === 'own' ? /own node_modules/ : /node_modules link/);
    assert.equal(await readFile(join(modules, '.package-lock.json'), 'utf8'), lock);
    if (actual === 'older') assert.match(await readFile(join(modules, 'playwright-core/package.json'), 'utf8'), /1.60.0/);
  });
});

test('healthy installs omit optional packages without stale warnings', async t => {
  for (const kind of ['own', 'link']) await t.test(kind, async t => {
    const f = await fixture(t);
    await f.create('Healthy install');
    const first = await f.claim('T-1');
    const path = first.worktree!.path;
    const modules = kind === 'own' ? join(path, 'node_modules') : join(f.root, 'node_modules');
    await mkdir(join(modules, 'playwright-core'), { recursive: true });
    const required = { 'node_modules/playwright-core': { version: '1.64.1' } };
    await writeFile(join(path, 'package-lock.json'), JSON.stringify({ packages: { ...required,
      'node_modules/other-platform': { version: '1.0.0', optional: true, os: ['fixture-other-os'] },
      'node_modules/other-cpu': { version: '1.0.0', optional: true, cpu: ['fixture-other-cpu'] },
      'node_modules/omitted-optional': { version: '1.0.0', optional: true },
    } }));
    await writeFile(join(modules, '.package-lock.json'), JSON.stringify({ packages: required }));
    await writeFile(join(modules, 'playwright-core/package.json'), JSON.stringify({ name: 'playwright-core', version: '1.64.1' }));
    const again = await f.claim('T-1');
    assert.ok(again.worktree);
    assert.equal(again.worktree.warning, undefined);
    assert.equal(await realpath(join(path, 'node_modules')), modules);
  });
});

test('worktree policy uses configured container articles without Git operations', async t => {
  const f = await fixture(t, { levels: ['initiative', 'feature'] });
  for (const [kind, article, id] of [['initiative', 'an', 'I-1'], ['feature', 'a', 'F-2']]) {
    await f.create(`Planning ${kind}`, kind!);
    const result = await f.claim(id!);
    assert.equal(result.worktree, null);
    assert.equal(result.reason, `${id} is ${article} ${kind}: only a task gets a branch and a worktree`);
  }
  assert.equal(existsSync(join(f.root, '.cland/worktrees')), false);
  assert.deepEqual(f.calls, []);
});

test('worktree policy keeps ineligible claims without creating a branch', async t => {
  const f = await fixture(t);
  for (const kind of ['epic', 'spec', 'question', 'map']) await f.create(`A ${kind}`, kind);
  await f.create('Done already');
  await f.tracker.close(human, 'T-5');
  await f.create('A release', 'release');
  const reasons: string[] = [];
  for (const id of ['T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6']) {
    const r = await f.claim(id);
    assert.equal(r.claim?.session, 'human', id);
    assert.equal(r.worktree, null, id);
    reasons.push(r.reason ?? '');
  }
  assert.deepEqual(reasons, [
    'E-1 is an epic: only a task gets a branch and a worktree',
    'S-2 is a spec: only a task gets a branch and a worktree',
    'Q-3 is a question: only a task gets a branch and a worktree',
    'M-4 is a map: only a task gets a branch and a worktree',
    'T-5 is closed: no worktree',
    'R-6 is a release: only a task gets a branch and a worktree',
  ]);
  assert.equal(existsSync(join(f.root, '.cland/worktrees')), false);
  assert.deepEqual(f.calls, []);
  const bare = await fixture(t, { territory: false });
  await bare.create('No territory');
  const result = await bare.claim('T-1');
  assert.equal(result.claim?.session, 'human');
  assert.equal(result.worktree, null);
  assert.equal(result.reason, 'the project has no territory (cland init makes one): no branch or worktree');
  assert.deepEqual(bare.calls, []);
});

test('worktree policy propagates the territory base or missing-ref refusal without releasing ownership', async t => {
  const f = await fixture(t);
  f.base = 'main';
  await f.create('From main');
  const result = await f.claim('T-1');
  assert.equal(result.worktree?.base, 'main');
  f.refusal = new Error("the territory's cland.taskBase names gone, which has no local branch");
  await f.create('Bad base');
  const bad = await f.claim('T-2');
  assert.equal(bad.claim?.session, 'human');
  assert.equal(bad.reason, "no worktree: the territory's cland.taskBase names gone, which has no local branch");
});

test('item launch policy uses its injected worktree and refuses cwd or conflicting ownership', async t => {
  const f = await fixture(t);
  f.hub.core.assignRole('coord', 'coordinator');
  const coord = await inProcessSpoke(t, { hub: f.hub, name: 'coord', role: 'coordinator', cwd: f.root });
  await coord.waitForPresence(['coord']);
  await f.create('Spoke item');
  await f.create('An epic', 'epic');
  const tool = (await coord.client.listTools()).tools.find(x => x.name === 'session.launch');
  assert.ok(tool?.inputSchema.properties?.item);
  const launch = (name: string, item: string, extra: Record<string, unknown> = {}) => f.worktrees.launch(f.project.sessions, { name, item, role: 'implementer', harness: 'claude-code', ...extra });
  await assert.rejects(launch('impl-1', 'T-1', { cwd: '.' }), /give `item` or `cwd`, not both/);
  assert.equal(existsSync(join(f.root, '.cland/worktrees/T-1')), false);
  assert.deepEqual(f.project.sessions.list(), []);
  const launched = await launch('impl-1', 'T-1');
  const path = join(f.root, '.cland/worktrees/T-1');
  assert.equal(launched.process.cwd, path);
  assert.equal(launched.worktree?.createdWorktree, true);
  assert.equal(launched.claim?.session, 'impl-1');
  assert.equal(f.calls[0]!.item.slug, 'spoke-item');
  await assert.rejects(launch('impl-2', 'T-1'), /T-1 is claimed by impl-1 \(implementer\): release it before launching another session for it/);
  assert.equal(f.project.sessions.list().some(s => s.name === 'impl-2'), false);
  const epic = await launch('impl-3', 'T-2');
  assert.equal(epic.process.cwd, f.root);
  assert.equal(epic.process.item, 'E-2');
  assert.equal(epic.worktree, null);
  assert.equal(epic.reason, 'E-2 is an epic: only a task gets a branch and a worktree');
  assert.equal(epic.claim?.session, 'impl-3');
});

test('item launch policy measures the post-Git branch-link subscriber as resumed work', async t => {
  const f = await fixture(t);
  await f.create('Guarded');
  let measured = false;
  f.tracker.onChange(change => {
    if (!measured && change.id === 'T-1' && change.item?.branch) { measured = true; f.clock.block(400); }
  });
  f.records.length = 0;
  await f.worktrees.launch(f.project.sessions, { name: 'impl-1', role: 'implementer', item: 'T-1', harness: 'claude-code' }, f.guard.resumer('session.launch', 'launcher-ui'));
  const slow = f.records.filter(entry => entry.event === 'slow-request' && entry.tool === 'session.launch');
  assert.deepEqual(slow.map(entry => [entry.phase, entry.client]), [['resumed', 'launcher-ui']], JSON.stringify(slow));
  assert.equal(measured, true, 'the branch-link event reached its synchronous subscriber');
  assert.equal(slow[0]?.ms, 400);
});

test('worktree list policy measures its post-Git projection once across interleaved inbox reads', async t => {
  let slowSessions = false;
  let snapshots = 0;
  let inListContinuation = false;
  const f = await fixture(t, { sessionsList: () => {
    if (!inListContinuation) return [];
    snapshots++;
    if (slowSessions) { slowSessions = false; f.clock.block(400); }
    return [];
  } });
  await f.create('Listed');
  assert.equal((await f.claim('T-1')).worktree?.item, 'T-1');
  f.listed = [{ item: 'T-1', path: join(f.root, '.cland/worktrees/T-1'), branch: 't/T-1-listed', head: 'fixture-tip', prunable: false }];
  const resumed: Resumed = work => {
    const previous = inListContinuation;
    inListContinuation = true;
    try { return f.guard.measure('worktree.list', 'list-ui', work, 'resumed'); }
    finally { inListContinuation = previous; }
  };
  const viewAsync = f.tracker.viewAsync.bind(f.tracker);
  t.mock.method(f.tracker, 'viewAsync', async (...args: Parameters<typeof viewAsync>) => {
    const value = await viewAsync(...args);
    f.hub.core.inbox.list();
    return value;
  });
  f.records.length = 0;
  slowSessions = true;
  const listed = await f.worktrees.list(resumed);
  assert.deepEqual(listed.map(w => w.item), ['T-1']);
  assert.equal(snapshots, 2, 'both the initial snapshot and the post-I/O snapshot must run');
  const slow = f.records.filter(entry => entry.event === 'slow-request' && entry.tool === 'worktree.list');
  assert.deepEqual(slow.map(entry => [entry.phase, entry.client]), [['resumed', 'list-ui']], JSON.stringify(slow));
  assert.ok((slow[0]?.ms as number) >= 400, `${String(slow[0]?.ms)} ms`);
});

// The CLI is the subject here: injected hub facts keep this formatting proof at T2.
test('claim CLI displays the injected container worktree refusal', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'task.create', kind: 'epic', title: 'A container' })).ok, true);
  const result = await cland(root, 'task', 'claim', 'T-1');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /worktree {2}none: E-1 is an epic/);
});
