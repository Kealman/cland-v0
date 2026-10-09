// T-77 extends T-70/T-75 at the native boundary: tracker reads/mutations, serving-time scans,
// and the shared Sessions launch layer. Territory read-only checks remain T-78, native adapters T-79.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { Tracker } from '../src/tracker/tracker.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { HarnessAdapter } from '../src/adapters/contract.ts';
import { connectWsUi, startHub, tempProject } from './harness.ts';

async function guarded(work: () => Promise<void>): Promise<void> {
  const savedFs = Object.fromEntries(Object.entries(fs).filter(([key, value]) => key.endsWith('Sync') && typeof value === 'function'));
  const savedCp = { spawnSync: cp.spawnSync, execFileSync: cp.execFileSync, execSync: cp.execSync };
  const calls: string[] = [];
  try {
    for (const [native, saved] of [[fs, savedFs], [cp, savedCp]] as const) {
      for (const key of Object.keys(saved)) Object.assign(native, { [key]: () => { calls.push(key); throw new Error(`synchronous ${key} on guarded path`); } });
    }
    syncBuiltinESMExports();
    await work();
    assert.deepEqual(calls, [], 'no synchronous native call, even when its error was caught');
  } finally { Object.assign(fs, savedFs); Object.assign(cp, savedCp); syncBuiltinESMExports(); }
}

test('hub tracker mutations, reads, scans, and shared launches use no synchronous filesystem or process call', async t => {
  const root = await tempProject(t);
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  const previousWatch = process.env.CLAND_TEST_WATCH_REFUSED;
  process.env.CLAND_TEST_WATCH_REFUSED = '1';
  try { tracker.start(); } finally {
    if (previousWatch === undefined) delete process.env.CLAND_TEST_WATCH_REFUSED;
    else process.env.CLAND_TEST_WATCH_REFUSED = previousWatch;
  }
  t.after(() => tracker.stop());
  const hub = await startHub({ tracker });
  t.after(() => hub.close());
  const table = new ProcessTable();
  const sessions = new Sessions({ root, core: hub.core, table });
  t.after(() => { sessions.close(); table.close(); });
  const adapter: HarnessAdapter = {
    harness: 'test',
    capabilities: { history: 'none', usage: 'none', setModel: 'none', approvalRelay: 'none', states: { busy: 'none', idle: 'none', 'waiting for human': 'none', 'waiting for approval': 'none' } },
    spawn: async r => ({ name: r.name, harness: 'test', role: r.role, model: r.model, cwd: r.cwd, pid: null, pidStarted: null, harnessId: null, sessionId: r.name, harnessSessionId: null, startedAt: new Date().toISOString(), status: 'running' }),
    attachCommand: () => 'test', watch: () => {}, inject: async () => {}, confirm: () => {}, interpret: () => ({}), stop: async () => {}, resume: async p => ({ found: true, process: p, state: 'idle' }), close: () => {},
  };
  sessions.register(adapter);
  hub.dispatcher.useSessions(sessions);
  const ui = await connectWsUi(t, hub);
  await guarded(async () => {
    for (const frame of [
      { type: 'task.create', title: 'First', kind: 'spec' },
      { type: 'task.create', title: 'Second', kind: 'spec' },
      { type: 'task.view', item: 'T-1' },
      { type: 'task.edit', item: 'T-1', body: 'edited' },
      { type: 'task.link', item: 'T-1', parent: 'T-2' },
      { type: 'task.comment', item: 'T-1', text: 'plain' },
      { type: 'task.comment', item: 'T-1', text: 'checked', verdict: { verdict: 'review', result: 'clear', run: 'native-run' } },
      { type: 'task.claim', item: 'T-1' },
      { type: 'topic.create', title: 'Bound', item: 'T-1' },
      { type: 'session.launch', name: 'plain', harness: 'test' },
      { type: 'session.launch', name: 'impl', harness: 'test', role: 'implementer', item: 'T-1' },
      { type: 'task.close', item: 'T-1', comment: 'done' },
      { type: 'task.import', repo: 'test/project', issues: [{ number: 1, url: 'https://example.com/1', title: 'Imported', body: '', labels: [], state: 'open', assignee: null, parent: null, blocked_by: [], comments: [], created: '2026-01-01T00:00:00.000Z' }] },
    ]) {
      const result = await ui.request(frame);
      assert.equal(result.ok, true, `${frame.type}: ${String(result.error)}`);
    }
    const refused = await ui.request({ type: 'session.launch', name: 'missing', harness: 'test', cwd: join(root, 'absent') });
    assert.equal(refused.ok, false);
    await tracker.rescanAsync();
    await new Promise(done => setTimeout(done, 550)); // fallback polling also runs inside the native guard
  });
});

test('the guard rejects a planted native statSync even if a request swallows its error', async () => {
  await assert.rejects(guarded(async () => {
    try { fs.statSync('.'); } catch { /* catches cannot hide native calls */ }
  }), /no synchronous native call/);
});
