// T3-only support: a real headless Neovim consumes a production hub's socket responses.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer, createConnection, type Socket } from 'node:net';
import { once } from 'node:events';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { serializeItem, parseItem } from '../../hub/src/tracker/item.ts';
import { projectHub, inProcessSpoke, connectUi, until, type Discovery } from '../../hub/test/harness.ts';
import { onCleanup } from '../../hub/test/process-cleanup.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { startClient } from './harness.ts';

import { STARTUP_MS, STARTUP_REQUESTS, assertStartupItems, type StartupItem, type StartupMeasurement } from '../../test-support/startup-budget.ts';
export { STARTUP_MS, FIRST_PAYLOAD_BYTES, STARTUP_REPLY_BYTES, STARTUP_TOTAL_BYTES, STARTUP_REQUESTS, enforceStartupBudget, type StartupMeasurement } from '../../test-support/startup-budget.ts';
const SETUP_MS = 10_000;
export type TrackerFixture = { bodies: Map<string, string>; open: string[]; items: StartupItem[]; total: number; row: { id: string; title: string } };

/** Generate realistic Markdown only in the disposable tracker, never in the repository. */
export async function generateStartupTracker(root: string): Promise<TrackerFixture> {
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  const bodies = new Map<string, string>(), open: string[] = [], items: StartupItem[] = [];
  const at = '2026-10-01T12:00:00.000Z';
  for (let n = 1; n <= 1000; n++) {
    // Keep open-item density independent from the closed-container history.
    const kind = n === 1 || n > 200 && (n-201)%4 === 0 ? 'release'
      : n === 2 || n > 200 && (n-201)%4 === 1 ? 'epic' : 'task';
    const id = `${kind === 'release' ? 'R' : kind === 'epic' ? 'E' : 'T'}-${n}`;
    const parent = n <= 200 ? n === 1 ? null : n === 2 ? 'R-1' : 'E-2'
      : kind === 'release' ? null : kind === 'epic' ? `R-${n-1}` : `E-${n - (n-202)%4}`;
    const body = `## Summary\n\nItem ${id} keeps the workbench responsive as the tracker grows.\n\n## Implementation\n\n`
      + 'Read summaries first, preserve item identity during events, and fetch the detailed body when the human opens the card. Record a bounded receipt before asserting the rendered result.\n\n'.repeat(8)
      + '## Acceptance criteria\n\n- [ ] C1. Open items render from the first summary payload.\n- [ ] C2. Sessions remain visible while tracker data arrives.\n';
    bodies.set(id, body);
    if (n <= 200) open.push(id);
    const membership = { id, kind, parent, state: n <= 200 ? 'open' : 'closed' } as const;
    items.push(membership);
    await writeFile(join(dir, `${id}-startup.md`), serializeItem({
      fm: { ...membership,
        title: n === 1 ? 'Startup tracker' : n === 2 ? 'Summary performance' : `Keep item ${n} responsive`,
        ...(kind === 'task' ? { status: n <= 200 ? 'planned' : 'done', size: 'S' } as const : {}),
        labels: ['workbench'], assignee: null, parent,
        blocked_by: [], topic: null, branch: null, created: at, updated: at },
      body, comments: [{ author: 'implementer', at, text: 'Source review checks the rendered receipt and the response size before verification.' }],
    }));
  }
  return { bodies, open, items, total: 1000, row: { id: 'E-2', title: 'Summary performance' } };
}

/** C4 copies item files only. No live config, database, discovery, account or run state is used. */
export async function copyStartupTracker(source: string, root: string): Promise<TrackerFixture> {
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  const bodies = new Map<string, string>(), open: string[] = [], items: StartupItem[] = [];
  let row: TrackerFixture['row'] | undefined;
  for (const name of await readdir(source)) {
    if (!/^[A-Z]-\d+.*\.md$/i.test(name)) continue;
    const text = await readFile(join(source, name), 'utf8');
    const item = parseItem(text);
    bodies.set(item.fm.id, item.body);
    items.push({ id: item.fm.id, kind: item.fm.kind, state: item.fm.state, parent:item.fm.parent });
    if (item.fm.state === 'open') {
      open.push(item.fm.id);
      if (item.fm.kind === 'release' && !row) row = { id: item.fm.id, title: item.fm.title };
    }
    await writeFile(join(dir, name), text);
  }
  assert.ok(row, 'copied tracker has an open release to observe on screen');
  return { bodies, open, items, total: bodies.size, row };
}

type Fault = 'slow-list' | 'bodies' | 'oversized-reply';

/** Transparent JSON-lines relay: only the named negative fixtures change a task.list response.
 * Hold welcome until the screen observer is armed. This excludes process/RPC setup, not startup work:
 * the client cannot request any startup snapshot until it consumes that welcome.
 */
async function observeWire(t: TestContext, root: string, discovery: Discovery, fixture: TrackerFixture, fault?: Fault) {
  const sockets = new Set<Socket>(), timers = new Set<NodeJS.Timeout>();
  const ready = Promise.withResolvers<() => void>();
  let connectedAt = 0, payloadBytes = 0, payloadIds: string[] = [], lists = 0;
  const requests: Array<Record<string, unknown>> = [];
  const replies: Record<string, number> = {};
  const server = createServer(down => {
    const up = createConnection(discovery.socket);
    for (const socket of [up, down]) {
      sockets.add(socket);
      socket.setEncoding('utf8');
      socket.on('error', () => { up.destroy(); down.destroy(); });
      socket.on('close', () => { sockets.delete(socket); up.destroy(); down.destroy(); });
    }
    const taskIds = new Set<string>();
    const types = new Map<string, string>();
    let welcomed = false;
    const pending: string[] = [];
    const deliver = (line: string) => {
      if (welcomed) down.write(line + '\n');
      else pending.push(line);
    };
    const lines = (socket: Socket, consume: (line: string) => void) => {
      let buffer = '';
      socket.on('data', (chunk: string) => {
        buffer += chunk;
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
          if (line.trim()) consume(line);
        }
      });
    };
    lines(down, line => {
      const frame = JSON.parse(line);
      if (typeof frame.id === 'string') types.set(frame.id, frame.type);
      if (frame.type === 'task.list') { taskIds.add(frame.id); requests.push(frame); lists++; }
      up.write(line + '\n');
    });
    lines(up, line => {
      const frame = JSON.parse(line);
      if (frame.type === 'welcome') {
        ready.resolve(() => {
          connectedAt = performance.now();
          welcomed = true;
          down.write(line + '\n');
          for (const queued of pending.splice(0)) deliver(queued);
        });
        return;
      }
      if (frame.type === 'result') {
        const type = types.get(frame.id);
        if (type && replies[type] === undefined) {
          if (fault === 'oversized-reply' && type === 'rule.list') {
            frame.value.padding = '🐈'.repeat(70_000);
            line = JSON.stringify(frame);
          }
          replies[type] = Buffer.byteLength(line + '\n');
        }
      }
      if (frame.type === 'result' && taskIds.delete(frame.id)) {
        assert.equal(frame.ok, true, frame.error);
        if (fault === 'bodies') {
          for (const item of frame.value.items) item.body = fixture.bodies.get(item.id);
          line = JSON.stringify(frame);
          replies['task.list'] = Buffer.byteLength(line + '\n');
        }
        if (!payloadBytes) {
          // Count UTF-8 bytes of the exact first response frame, including its JSON envelope and newline.
          payloadBytes = Buffer.byteLength(line + '\n');
          payloadIds = frame.value.items.map((item: { id: string }) => item.id);
        }
        if (fault === 'slow-list') {
          // Deliberate latency fault, not a readiness wait. Keep the actual rendered completion receipt.
          const timer = setTimeout(() => { timers.delete(timer); deliver(line); }, STARTUP_MS + 100);
          timers.add(timer);
          return;
        }
      }
      deliver(line);
    });
  });
  onCleanup(t, async () => {
    for (const timer of timers) clearTimeout(timer);
    const closed = once(server, 'close');
    for (const socket of sockets) socket.destroy();
    server.close();
    await closed;
  });
  const path = join(root, 'startup.sock');
  server.listen(path);
  await once(server, 'listening');
  await writeFile(join(root, '.cland/hub.json'), JSON.stringify({ ...discovery, socket: path }));
  return { ready: ready.promise, stats: () => ({ connectedAt, payloadBytes, payloadIds, lists, requests, replies }) };
}

export async function measureStartup(t: TestContext, bin: string, root: string, fixture: TrackerFixture, fault?: Fault): Promise<StartupMeasurement> {
  const env = fixtureEnvironment(root, process.env);
  for (const key of ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME']) await mkdir(env[key]!, { recursive: true });
  const { discovery } = await projectHub(t, root, env);
  // Session rule semantics are covered in T2. No harness children are needed for this UI boundary.
  await inProcessSpoke(t, { discover: true, cwd: root, name: 'budget-coord', role: 'coordinator', sessionId: 'startup-coord' });
  const worker = await inProcessSpoke(t, { discover: true, cwd: root, name: 'budget-worker', role: 'implementer', sessionId: 'startup-worker' });
  await worker.waitForPresence(['budget-coord', 'budget-worker']);
  const ui = await connectUi(t, discovery);
  for (const target of ['budget-coord', 'budget-worker']) {
    assert.equal((await ui.request({ type: 'visibility.set', surface: 'sessions', target, mode: 'pin' })).ok, true);
  }
  const wire = await observeWire(t, root, discovery, fixture, fault);
  const c = await startClient(t, bin, root, env, { centre: 'explorer', screenPollMs: 10 });
  await c.lua("require('cland.layout').place_panel('sessions', 'left')");
  const release = await Promise.race([wire.ready, new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error('startup setup: no hub welcome')), SETUP_MS);
    timer.unref();
    t.after(() => clearTimeout(timer));
  })]);
  // Anchor each observation to its physical screen row/column: header and left sessions panel,
  // plus the explorer row. A title, presence event or installed state alone cannot finish the timer.
  const rendered = (s: string) => {
    const rows = s.split('\n');
    return /budget-coord.*Coordinator/.test(rows[0] ?? '') && /sessions\s+2\b/.test(rows[0] ?? '')
      && rows.slice(1).some(row => {
        const explorer = row.split('│')[1] ?? '';
        return /^\s*[▾▸]/.test(explorer) && explorer.includes(fixture.row.id + ' ') && explorer.includes(fixture.row.title);
      })
      && ['budget-coord', 'budget-worker'].every(name => rows.slice(1).some(row => row.split('│')[0]?.includes(name)));
  };
  const observed = c.waitScreen(rendered, 'open explorer row, Coordinator header and both session rows', SETUP_MS);
  release();
  const screen = await observed;
  const startupMs = performance.now() - wire.stats().connectedAt;
  assert.ok(rendered(screen), 'all startup rows remain rendered');
  await until(() => STARTUP_REQUESTS.every(type => wire.stats().replies[type] !== undefined), { what: 'all eight startup reply receipts' });
  const stats = wire.stats();
  assert.equal(stats.lists, 1, 'one initial item payload');
  assert.deepEqual(stats.requests.map(({ type, projection, state, include_containers }) => ({ type, projection, state, include_containers })), [{ type: 'task.list', projection: 'summary', state: 'open', include_containers: true }]);
  const installedIds = await c.lua<string[]>("local ids={};for _,it in ipairs(require('cland.state').S.items) do ids[#ids+1]=it.id end;return ids");
  assertStartupItems(fixture.items, stats.payloadIds, installedIds);
  assert.ok(stats.payloadBytes > 0, 'first task.list response was observed');
  const result = { startupMs, payloadBytes: stats.payloadBytes, total: fixture.total, open: fixture.open.length, replies: stats.replies };
  t.diagnostic(`startup measurement ${JSON.stringify(result)}; ${process.platform}/${process.arch}; real headless Neovim; elapsed connection-to-render (suite attribution from runner)`);
  return result;
}
