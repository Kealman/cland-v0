// T3: real asynchronous Git and post-commit logger timing at the native boundary.
// The hub's request path under a flood (T-67), from the incident's shape: a UI client sending `task.list` over and
// over on a project of twenty items with verdicts. Another client is not held up beyond a matching baseline, the repeats are
// answered from the previous answer and logged once, and a handler over the budget is logged as `slow-request`.
import { onCleanup } from './process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { connectUi, connectWsUi, startHub, tempProject, TEST_SECRET } from './harness.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { HarnessAdapter } from '../src/adapters/contract.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import type { Git } from '../src/tracker/verdict-git.ts';
import type { HubStatus } from '../src/protocol.ts';

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
      capabilities: { terminal: 'none', history: 'none', usage: 'none', setModel: 'none', approvalRelay: 'none', states: { busy: 'none', idle: 'none', 'waiting for human': 'none', 'waiting for approval': 'none' } },
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
