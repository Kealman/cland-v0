// T1: missing session directories through adapter spawn and transport-free resume.
// The removed cwd refuses before any native process boundary; no harness is started.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { HubCore } from '../src/hub/core.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { fakeHarness } from './fakes/harness.ts';
import { FakeClock } from './fake-clock.ts';

test('Codex diagnoses a missing cwd before probing its binary', async t => {
  const root = await mkdtemp(join(tmpdir(), 'session-cwd-'));
  const cwd = join(root, 'removed-worktree');
  const adapter = new CodexAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} }, { bin: join(root, 'absent-codex'), clock: new FakeClock() });
  t.after(async () => { adapter.close(); await rm(root, { recursive: true, force: true }); });
  const request = { name: 'impl', cwd, role: null, model: null };
  await assert.rejects(adapter.spawn(request), { message: `session cwd ${cwd} no longer exists` });
});

test('relaunch refuses a removed cwd with a fresh launch suggestion only for an open item', async t => {
  const root = await mkdtemp(join(tmpdir(), 'session-cwd-'));
  const cwd = join(root, 'removed-worktree');
  const clock = new FakeClock();
  const core = new HubCore({ clock });
  const table = new ProcessTable(':memory:', clock);
  const tracker = new Tracker({ root, db: ':memory:', git: async () => null });
  const sessions = new Sessions({ core, table, root, tracker });
  t.after(async () => { sessions.close(); tracker.stop(); table.close(); core.close(); core.store.close(); await rm(root, { recursive: true, force: true }); });
  const fake = fakeHarness('codex', { clock });
  sessions.register(fake);
  const actor = { id: 'human', name: 'human', role: null };
  const item = await tracker.create(actor, { title: 'Remaining work', size: 'XS' });
  const process = await fake.spawn({ name: 'impl', cwd, role: 'implementer', model: null, item: item.id });
  for (const state of ['open', 'closed', 'absent'] as const) {
    if (state === 'closed') await tracker.close(actor, item.id);
    const recorded = { ...process, status: 'stopped' as const, item: state === 'absent' ? null : item.id };
    table.put(recorded);
    const result = await sessions.resume(process.name, true);
    assert.equal(result.found, false);
    assert.equal(result.reason, `session cwd ${cwd} no longer exists`);
    assert.equal(result.fresh, undefined, '--fresh would reuse the same missing cwd');
    const guidance = result.notes.find(note => note.includes('cland session launch'));
    if (state === 'open') assert.equal(guidance, `launch a fresh session for ${item.id}: cland session launch <new-name> --role implementer --item ${item.id}`);
    else assert.equal(guidance, undefined);
    assert.equal(table.get(process.name)?.status, 'stopped');
  }
  assert.deepEqual(fake.resumes, [], 'refuse before the adapter resumes or starts a harness');
  assert.deepEqual(fake.stops, []);
});
