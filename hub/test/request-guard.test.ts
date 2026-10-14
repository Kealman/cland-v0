// The hub's request path under a flood (T-67), from the incident's shape: a UI client sending `task.list` over and
// over on a project of twenty items with verdicts. Another client is not held up beyond a matching baseline, the repeats are
// answered from the previous answer and logged once, and a handler over the budget is logged as `slow-request`.
import { onCleanup } from './process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectSocket, connectUi, connectWsUi, startDaemon, startHub, tempProject, TEST_SECRET } from './harness.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { HarnessAdapter } from '../src/adapters/contract.ts';
import { BUDGET_MS } from '../src/hub/budget.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import type { Git } from '../src/tracker/verdict-git.ts';
import type { HubStatus } from '../src/protocol.ts';

const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hubLog = async (root: string) => (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8')).split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as Record<string, unknown>);

/** Twenty items, each on its own branch, each with a review verdict on a commit that is not its tip. */
async function project(root: string, n: number): Promise<void> {
  git(root, 'init', '-b', 'dev');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  await writeFile(join(root, 'base'), 'base\n');
  git(root, 'add', 'base');
  git(root, 'commit', '-m', 'base');
  const base = git(root, 'rev-parse', 'HEAD');
  const tasks = join(root, '.cland', 'tasks');
  await mkdir(tasks, { recursive: true });
  for (let k = 1; k <= n; k++) {
    const reviewed = git(root, 'commit-tree', `${base}^{tree}`, '-p', base, '-m', `reviewed ${k}`);
    git(root, 'update-ref', `refs/heads/t/${k}`, git(root, 'commit-tree', `${base}^{tree}`, '-p', reviewed, '-m', `tip ${k}`));
    await writeFile(
      join(tasks, `T-${k}-item-${k}.md`),
      `---\nid: T-${k}\ntitle: Item ${k}\nbranch: t/${k}\n---\n\nBody.\n\n## Comments\n\n### rev-1 · 2026-10-09T08:00:00.000Z\n\nverdict: review\nresult: clear\nby: rev-1 [reviewer]\nrun: r-${k}\ncommit: ${reviewed}\n\nChecked.\n`,
    );
  }
}

test('a client flooding task.list does not hold up another client; its repeats are answered again and logged once', async (t) => {
  const root = await tempProject(t);
  await project(root, 20);
  const { discovery } = await startDaemon(t, root);
  const flood = await connectUi(t, discovery, 'flood');
  const other = await connectUi(t, discovery, 'other');
  assert.equal(((await flood.request({ type: 'task.list' })).value as { items: unknown[] }).items.length, 20);

  // Calibrate the cost of this same burst with no competing client. This includes scheduling,
  // transport and serializing 500 twenty-item answers, which the handler's CPU budget does not.
  const baseline = async (item: string) => {
    const started = performance.now();
    const burst = Array.from({ length: 500 }, () => flood.request({ type: 'task.list' }, 30_000));
    const view = await flood.request({ type: 'task.view', item }, 30_000);
    assert.equal(view.ok, true);
    assert.ok((await Promise.all(burst)).every(a => a.ok));
    return performance.now() - started;
  };
  // Distinct, equally sized fixtures make both calibrations actual reads, even
  // when faster projections put the whole experiment inside the replay window.
  const before = await baseline('T-6');
  // the incident's burst: hundreds of identical reads in flight at once, while the other client asks its own
  const burst = Array.from({ length: 500 }, () => flood.request({ type: 'task.list' }, 30_000));
  const started = performance.now();
  const view = await other.request({ type: 'task.view', item: 'T-7' }, 30_000);
  const waited = performance.now() - started;
  assert.equal(view.ok, true);
  const answers = await Promise.all(burst);
  assert.ok(answers.every((a) => a.ok && (a.value as { items: unknown[] }).items.length === 20), 'every flooded read is answered');
  const after = await baseline('T-8');
  const calibrated = Math.max(before, after);
  t.diagnostic(`other client ${Math.round(waited)} ms; same-client burst baseline ${Math.round(before)}/${Math.round(after)} ms`);
  assert.ok(waited < Math.max(BUDGET_MS * 2, calibrated * 2), `the other client waited ${Math.round(waited)} ms behind the flood; baseline ${Math.round(calibrated)} ms`);
  assert.equal((await other.request({ type: 'hub.status', flushLogs: true })).ok, true);


  const log = await hubLog(root);
  const tooFast = log.filter((r) => r.event === 'too-fast');
  assert.deepEqual(tooFast.map((r) => [r.tool, r.client]), [['task.list', 'flood']], 'logged once per connection and tool');
  assert.deepEqual(log.filter((r) => r.event === 'slow-request' && r.tool === 'task.list'), [], 'no task.list over the budget');
  const status = (await other.request({ type: 'hub.status' })).value as HubStatus;
  assert.ok((status.requests?.replayed ?? 0) > 0, 'hub status counts the reads answered again');

  // a write ends the replay: the flooding client's next read sees it
  const created = await flood.request({ size: 'M', type: 'task.create', title: 'After the flood' });
  assert.equal(created.ok, true, created.error);
  assert.equal(((await flood.request({ type: 'task.list' })).value as { items: unknown[] }).items.length, 21);
});

test('a cold task.list burst in one socket write shares its pending answer', async (t) => {
  const root = await tempProject(t);
  await project(root, 0);
  // No verdict refreshes: every read in this experiment has the same generation.
  for (let i = 1; i <= 20; i++) {
    await writeFile(join(root, '.cland', 'tasks', `T-${i}-item.md`), `---\nid: T-${i}\ntitle: Item ${i}\n---\n\nBody.\n`);
  }
  const { discovery } = await startDaemon(t, root);
  const flood = await connectSocket(discovery.socket);
  t.after(() => flood.close());
  flood.send({ type: 'hello', protocol: 2, secret: discovery.secret, client: 'cold-flood' });
  assert.equal((await flood.next()).type, 'welcome');

  // No answer has been cached. A single write reproduces Linux's batching of the
  // flood before the promise delivering the first task.list answer can resume.
  flood.write(Array.from({ length: 500 }, (_, i) => JSON.stringify({ type: 'task.list', id: `cold-${i}` }) + '\n').join(''));
  const ids = new Set<unknown>();
  for (let i = 0; i < 500; i++) {
    const answer = await flood.next(30_000);
    assert.equal(answer.ok, true);
    assert.equal((answer.value as { items: unknown[] }).items.length, 20);
    ids.add(answer.id);
  }
  assert.deepEqual(ids, new Set(Array.from({ length: 500 }, (_, i) => `cold-${i}`)), 'every request receives its own correlated answer');
  flood.send({ type: 'hub.status', id: 'status' });
  const status = (await flood.next()).value as HubStatus;
  assert.equal(status.requests?.replayed, 499, 'only the first cold read needs handling');

  // A write between two pending pairs starts a new read generation. The tracker
  // serializes task.view and task.edit, so the pairs must see different titles.
  flood.write([
    { type: 'task.view', item: 'T-1', id: 'before-1' },
    { type: 'task.view', item: 'T-1', id: 'before-2' },
    { type: 'task.edit', item: 'T-1', title: 'Renamed', id: 'write' },
    { type: 'task.view', item: 'T-1', id: 'after-1' },
    { type: 'task.view', item: 'T-1', id: 'after-2' },
  ].map(frame => JSON.stringify(frame) + '\n').join(''));
  const titles = new Map<unknown, string>();
  for (let i = 0; i < 5; i++) {
    const answer = await flood.next(30_000);
    assert.equal(answer.ok, true);
    titles.set(answer.id, (answer.value as { item: { title: string } }).item.title);
  }
  assert.deepEqual([...titles].sort(), [
    ['after-1', 'Renamed'], ['after-2', 'Renamed'],
    ['before-1', 'Item 1'], ['before-2', 'Item 1'],
    ['write', 'Renamed'],
  ]);
});

test('a handler over the budget is logged as slow-request with its tool, client and duration, and counted', async (t) => {
  const records: Array<Record<string, unknown>> = [];
  // every reading of the clock is a second later: each handler takes 1000 ms by the guard's watch
  let clock = 0;
  const hub = await startHub({ log: (r) => records.push(r), guard: { now: () => (clock += 1000) } });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub, 'slow-ui');
  assert.equal((await ui.request({ type: 'topic.list' })).ok, true);
  const slow = records.filter((r) => r.event === 'slow-request');
  assert.ok(slow.some((r) => r.tool === 'topic.list' && r.client === 'slow-ui' && (r.ms as number) >= 1000), JSON.stringify(slow));
});

test('a verdict write with a slow post-commit logger is timed as resumed work after async Git and disk', async (t) => {
  const root = await tempProject(t);
  const records: Array<Record<string, unknown>> = [];
  const log = (r: Record<string, unknown>) => {
    records.push(r);
    if (r.event === 'task-written' && r.op === 'verdict') {
      const until = performance.now() + 400;
      while (performance.now() < until) { /* deliberately slow post-commit consumer */ }
    }
  };
  // Git and disk are awaited; the logger blocks only after the commit completes.
  const git: Git = (args) => new Promise((resolve) => setTimeout(() => resolve(args[0] === 'rev-parse' ? 'a'.repeat(40) : ''), 20));
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), log, git });
  tracker.start();
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ log, tracker });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub, 'reviewer-ui');
  assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Reviewed', branch: 't/x' })).ok, true);
  records.length = 0;
  const r = await ui.request({ type: 'task.comment', item: 'T-1', text: 'checked', verdict: { verdict: 'review', scope: 'full', result: 'clear', run: 'r-1' } });
  assert.equal(r.ok, true, r.error);
  const slow = records.filter((x) => x.event === 'slow-request' && x.tool === 'task.comment');
  assert.deepEqual(slow.map((x) => [x.phase, x.client]), [['resumed', 'reviewer-ui']], JSON.stringify(slow));
  assert.ok((slow[0]?.ms as number) >= 400, `${String(slow[0]?.ms)} ms`);
});


test('waiting for async Git is a slow-answer with its own counter, without a slow-request', async (t) => {
  const root = await tempProject(t);
  const records: Array<Record<string, unknown>> = [];
  const log = (r: Record<string, unknown>) => records.push(r);
  const git: Git = (args) => new Promise((resolve) => setTimeout(() => resolve(args[0] === 'rev-parse' ? 'a'.repeat(40) : ''), 150));
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), log, git });
  tracker.start();
  onCleanup(t, () => tracker.stop());
  // A lower answer threshold keeps this test fast; the loop budget stays at its production value.
  const hub = await startHub({ log, tracker, guard: { answerBudgetMs: 100 }, control: { status: () => ({ pid: process.pid, port: 0, socket: '', version: 'test', root, startedAt: new Date().toISOString(), uptimeMs: 0 }), stop: () => {} } });
  onCleanup(t, () => hub.close());
  const socket = join(root, 'hub.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  onCleanup(t, () => edge.close());
  const ui = await connectUi(t, { socket, secret: TEST_SECRET }, 'waiting-ui');
  await ui.request({ size: 'M', type: 'task.create', title: 'Reviewed', branch: 't/x' });
  records.length = 0;
  const result = await ui.request({ type: 'task.comment', item: 'T-1', text: 'checked', verdict: { verdict: 'review', scope: 'full', result: 'clear', run: 'r-1' } });
  assert.equal(result.ok, true, result.error);
  const slow = records.filter((r) => r.event === 'slow-answer' && r.tool === 'task.comment');
  assert.equal(slow.length, 1, JSON.stringify(records));
  assert.equal(slow[0]?.client, 'waiting-ui');
  assert.ok((slow[0]?.ms as number) >= 150);
  assert.equal(records.filter((r) => r.event === 'slow-request').length, 0);
  const status = (await ui.request({ type: 'hub.status' })).value as HubStatus;
  assert.equal(status.requests?.slow, 0);
  assert.equal(status.requests?.slowAnswers, 1);
  assert.equal(status.requests?.lastSlowAnswer?.tool, 'task.comment');
});


for (const aggregate of [false, true]) for (const operation of ['launch', 'item-launch', 'stop', 'resume', 'relaunch'] as const) {
  test(`session ${operation}: ${aggregate ? '200 ms publication plus 200 ms lifecycle work' : '400 ms publication'} after an adapter await is timed once as resumed`, async (t) => {
    const root = await tempProject(t);
    const records: Array<Record<string, unknown>> = [];
    const tracker = operation === 'item-launch' ? new Tracker({ root, db: join(root, '.cland', 'hub.db') }) : undefined;
    if (tracker) { tracker.start(); onCleanup(t, () => tracker.stop()); }
    const hub = await startHub({ log: (r) => records.push(r), ...(tracker ? { tracker } : {}) });
    onCleanup(t, () => hub.close());
    const table = new ProcessTable();
    const sessions = new Sessions({ core: hub.core, table, root });
    onCleanup(t, () => sessions.close()); onCleanup(t, () => table.close());
    const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 20));
    const block = (ms: number) => {
      const until = performance.now() + ms;
      while (performance.now() < until) { /* deliberately slow synchronous work */ }
    };
    let nextPart = false;
    const adapter: HarnessAdapter = {
      harness: 'test',
      capabilities: { history: 'none', usage: 'none', setModel: 'none', approvalRelay: 'none', states: { busy: 'none', idle: 'none', 'waiting for human': 'none', 'waiting for approval': 'none' } },
      spawn: async (r) => {
        await wait();
        return { name: r.name, harness: 'test', role: r.role, model: r.model, cwd: r.cwd, pid: null, pidStarted: null, harnessId: null, sessionId: 'test-session', harnessSessionId: 'test-conversation', startedAt: new Date().toISOString(), status: 'running' };
      },
      attachCommand: () => 'attach-test',
      watch: () => { if (nextPart) { nextPart = false; block(200); } },
      inject: async () => {},
      confirm: () => {},
      interpret: () => ({}),
      stop: async () => { await wait(); },
      resume: async (p) => {
        // A relaunch reaches this synchronous prefix immediately after publishing its stopped row.
        if (nextPart) { nextPart = false; block(200); }
        await wait();
        return { found: true, process: { ...p, status: 'running' }, state: 'idle' };
      },
      close: () => {},
    };
    sessions.register(adapter);
    hub.dispatcher.useSessions(sessions);
    const ui = await connectWsUi(t, hub, 'lifecycle-ui');
    const launching = operation === 'launch' || operation === 'item-launch';
    if (operation === 'item-launch') assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Launched item' })).ok, true);
    const launch = { type: 'session.launch', name: 'test', harness: 'test', ...(operation === 'item-launch' ? { item: 'T-1', role: 'implementer' } : {}) };
    if (!launching) assert.equal((await ui.request(launch)).ok, true);
    records.length = 0;
    let publications = 0;
    const afterPublication = () => { if (nextPart) { nextPart = false; block(200); } };
    const unsubscribeState = hub.core.subscribe((event) => {
      if (event.type === 'session.state') afterPublication();
    });
    onCleanup(t, unsubscribeState);
    const unsubscribe = hub.core.subscribe((event) => {
      if (event.type !== 'session.process') return;
      publications++;
      if (publications !== 1) return;
      block(aggregate ? 200 : 400);
      nextPart = aggregate;
    });
    onCleanup(t, unsubscribe);
    const type = launching ? 'session.launch' : operation === 'stop' ? 'session.stop' : 'session.resume';
    const result = await ui.request(launching ? launch : { type, session: 'test', relaunch: operation === 'relaunch' });
    assert.equal(result.ok, true, result.error);
    assert.ok(publications >= 1);
    const slow = records.filter((r) => r.event === 'slow-request');
    assert.deepEqual(slow.map((r) => [r.tool, r.client, r.phase]), [[type, 'lifecycle-ui', 'resumed']], JSON.stringify(slow));
    assert.ok((slow[0]?.ms as number) >= 400);
    assert.equal(records.filter((r) => r.event === 'slow-answer').length, 0);
  });
}
