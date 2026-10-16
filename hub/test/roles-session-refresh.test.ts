import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RolesFile } from '../src/roles/config.ts';
import { createHubBase } from '../src/hub/server.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { fakeHarness } from './fakes/harness.ts';
import { eventually, tempProject } from './harness.ts';

for (const operation of ['session.launch', 'session.resume'] as const) {
  test(`${operation} rechecks its caller after a deferred fresh read revokes permission`, async t => {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'), { recursive: true });
    const path = join(root, '.cland', 'roles.toml');
    const text = (tools: string[]) => `[coordinator.launch]\nharness = "claude-code"\n[coordinator.permissions]\ntools = ${JSON.stringify(tools)}\n[reviewer]\nexclusive = true\n[reviewer.launch]\nharness = "claude-code"\n`;
    await writeFile(path, text([operation]));
    let armed = false;
    let entered!: () => void;
    let release!: () => void;
    const reading = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const roles = new RolesFile(path, undefined, async path => {
      if (armed) { entered(); await gate; }
      return readFile(path, 'utf8');
    });
    t.after(() => roles.stop());
    t.after(() => release());
    t.mock.timers.enable({ apis: ['setInterval'] });
    await roles.start();
    const hub = createHubBase({ secret: 'test', roles });
    t.after(() => hub.close());
    hub.core.assignRole('coord', 'coordinator');
    const table = new ProcessTable();
    const sessions = new Sessions({ core: hub.core, table, root });
    t.after(() => { sessions.close(); table.close(); });
    let starts = 0;
    let stops = 0;
    const fake = fakeHarness('claude-code');
    fake.spawn = async () => { starts++; throw new Error('spawn must not happen'); };
    fake.resume = async () => { starts++; throw new Error('relaunch must not happen'); };
    fake.stop = async () => { stops++; };
    sessions.register(fake);
    if (operation === 'session.resume') table.put({ name: 'target', harness: 'claude-code', role: null, model: null, cwd: root, pid: null, harnessId: null, sessionId: 'target-id', harnessSessionId: null, startedAt: '', status: 'running' });
    hub.dispatcher.useSessions(sessions);
    const answers: Array<Record<string, unknown>> = [];
    const conversation = hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
    t.after(() => conversation.closed());
    conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'cli' }));
    armed = true;
    conversation.receive(JSON.stringify({ type: operation, id: 'operation', as: { name: 'coord' }, ...(operation === 'session.launch' ? { name: 'target', role: 'reviewer', harness: 'claude-code' } : { session: 'target', relaunch: true }) }));
    await reading;
    if (operation === 'session.launch') {
      assert.equal(hub.core.store.roleOf('target'), null, 'admission reserves the role without publishing it before the fresh read');
      assert.throws(() => hub.core.assignRole('next', 'reviewer'), /held by target/);
    }
    await writeFile(path, text([]));
    release();
    const result = await eventually('revoked session action refused', () => answers.find(frame => frame.id === 'operation'));
    assert.equal(result.code, 'forbidden', JSON.stringify(result));
    assert.deepEqual([starts, stops], [0, 0], 'no spawn or stop happens under a revoked grant');
    assert.equal(table.get('target')?.status, operation === 'session.resume' ? 'running' : undefined);
    if (operation === 'session.launch') {
      assert.equal(hub.core.store.roleOf('target'), null);
      assert.deepEqual(hub.core.store.reservations(), []);
      assert.equal(sessions.lifecyclePending(), false);
      assert.equal(hub.core.assignRole('next', 'reviewer').role, 'reviewer', 'the revoked caller releases its reservation');
    }
  });
}
