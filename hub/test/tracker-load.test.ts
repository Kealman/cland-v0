// T4 load check: measures real request latency with 20 publishing sessions and
// up to 200,000 retained journal events; the 5 s latency assertion requires a quiet machine.
// Live-like adapter publications and tracker requests through the real WebSocket edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Journal } from '../src/hub/journal.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { connectWsUi, startHub, tempProject } from './harness.ts';

for (const retained of [0, 200_000]) {
  test(`tracker requests stay within 5 s with 20 sessions and ${retained} retained events`, async t => {
    const root = await tempProject(t, 'cland-tracker-load-', process.platform === 'darwin' ? '/private/tmp' : tmpdir());
    await mkdir(join(root, '.cland'), { recursive: true });
    const path = join(root, '.cland/journal.jsonl');
    const history = Array.from({ length: retained }, (_, i) => JSON.stringify({
      ts: new Date(1700000000000 + i * 50).toISOString(), event: ['session-usage', 'session-state', 'account-limits', 'audit'][i % 4],
      session: `impl-${i % 20}`, sessionId: `fixture-${i % 20}`, item: 'T-1', harness: 'codex',
      total: { inputTokens: i * 100, outputTokens: i * 10, totalTokens: i * 110 },
      rateLimits: { primary: { usedPercent: i % 100, resetsAt: 1800000000 } },
    })).join('\n');
    await writeFile(path, history ? `${history}\n` : '');
    const journal = new Journal(path);
    const log = journal.tap(() => {});
    const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), log });
    const hub = await startHub({ tracker, journal, log });
    t.after(async () => { await hub.close(); await tracker.stop(); await journal.close(); });
    const ui = await connectWsUi(t, hub);
    const ids: string[] = [];
    for (let i = 0; i < 30; i++) {
      const made = await ui.request({ type: 'task.create', title: `Load ${i}`, size: 'S', body: '## Acceptance criteria\n- [ ] C1. Observable criterion' });
      assert.equal(made.ok, true, made.error);
      ids.push((made.value as { item: { id: string } }).item.id);
    }
    for (let i = 0; i < 20; i++) hub.core.seedProcess({
      name: `impl-${i}`, sessionId: `fixture-${i}`, harness: 'codex', role: 'implementer', model: 'fake',
      cwd: root, item: ids[i]!, pid: null, harnessId: null, harnessSessionId: null,
      startedAt: new Date().toISOString(), status: 'running', state: 'busy', attach: null,
    });
    let tick = 0;
    const publish = () => {
      const i = tick++ % 20;
      hub.core.publishUsage(`impl-${i}`, `fixture-${i}`, { total: { totalTokens: tick, inputTokens: tick, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } });
      if (tick % 2 === 0) hub.core.setSessionState(`fixture-${i}`, `impl-${i}`, tick % 4 ? 'idle' : 'busy', 'fixture');
      if (tick % 3 === 0) void hub.core.publishAccountLimits({ account: 'fixture', harness: 'codex', windows: [{ id: 'primary', label: '5h', usedPercent: tick % 100, resetsAt: '2027-01-01T00:00:00Z' }], source: { kind: 'session', session: `impl-${i}` }, at: new Date().toISOString() });
    };
    // 170 usage / 87 state / 65 account events in six minutes, as in T-548.
    const timer = setInterval(publish, 360_000 / 170);
    t.after(() => clearInterval(timer));
    publish();
    const timings: Record<string, number[]> = { 'task.view': [], 'task.criterion': [] };
    const request = async (type: 'task.view' | 'task.criterion', item: string) => {
      const start = performance.now();
      const result = await ui.request({ type, item, ...(type === 'task.criterion' ? { op: 'done', criterion: 'C1' } : {}) }, 120_000);
      timings[type]!.push(performance.now() - start);
      assert.equal(result.ok, true, result.error);
    };
    await Promise.all([
      ...ids.map(item => request('task.criterion', item)),
      ...ids.slice(0, 20).map(item => request('task.view', item)),
    ]);
    t.diagnostic(JSON.stringify({ retained, bytes: Buffer.byteLength(history), maxMs: Object.fromEntries(Object.entries(timings).map(([type, values]) => [type, Math.max(...values)])) }));
    for (const [type, values] of Object.entries(timings)) assert.ok(Math.max(...values) < 5000, `${type} exceeded 5 s: ${Math.max(...values)} ms`);
  });
}
