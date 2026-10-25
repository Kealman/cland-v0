// T2: deferred role-file reads and fake adapter boundaries prove caller revocation; native launch flow remains in scenarios/crew-launch.
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { ProcessTable } from '../src/adapters/processes.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import type { LaunchPolicy } from '../src/adapters/contract.ts';
import { createHubBase } from '../src/hub/server.ts';
import { RolesFile } from '../src/roles/config.ts';
import { ProjectConfiguration } from '../src/hub/configuration.ts';
import { layout } from '../src/project.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fakeHarness } from './fakes/harness.ts';
import { eventually, tempProject } from './harness.ts';
import { beforeDirectories, onCleanup } from './process-cleanup.ts';

function ownRoleFixture(t: TestContext) {
  const state: {
    release?: () => void;
    roles?: RolesFile | ProjectConfiguration;
    sessions?: Sessions;
    hub?: ReturnType<typeof createHubBase>;
    table?: ProcessTable;
    restore?: () => void | Promise<void>;
  } = {};
  const pending = new Set<Promise<void>>();
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    state.release?.();
    await Promise.all([...pending]);
    const errors: unknown[] = [];
    for (const dispose of [() => state.sessions?.close(), () => state.roles?.stop(), () => state.hub?.close(), () => state.table?.close(), () => state.restore?.()]) {
      try { await dispose(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'role fixture cleanup failed');
  })();
  // Register the aggregate before allocating a root, including partial setup failures.
  beforeDirectories(t, close);
  const track = <T>(operation: Promise<T>): Promise<T> => {
    const settled = operation.then(() => {}, () => {});
    pending.add(settled);
    void settled.then(() => pending.delete(settled));
    return operation;
  };
  return { state, track };
}

for (const reader of ['RolesFile', 'ProjectConfiguration'] as const) {
  test(`${reader} early failure drains held launch and closes owners before removing its root`, async t => {
    // Capture the framework's after boundary to exercise early exit without failing the outer test.
    const hooks: Array<() => Promise<void>> = [];
    const context = { after: (hook: () => Promise<void>) => { hooks.push(hook); } } as unknown as TestContext;
    onCleanup(t, async () => { for (const hook of hooks) await hook(); });
    const owner = ownRoleFixture(context);
    const root = await tempProject(context);
    const files = layout(root);
    await mkdir(files.dir, { recursive: true });
    const text = (value: string) => `[implementer.launch]\nharness = "claude-code"\npermissions = "${value}"\n`;
    await writeFile(files.roles, text('skip'));
    const env = fixtureEnvironment(root, process.env);
    const roles = owner.state.roles = reader === 'RolesFile'
      ? new RolesFile(files.roles, undefined, undefined, work => work(), env)
      : new ProjectConfiguration(files, null, () => {}, env, work => work(), () => {}, async () => null);
    t.mock.timers.enable({ apis: ['setInterval'] });
    await roles.start();
    const hub = owner.state.hub = createHubBase({ secret: 'test', roles });
    const table = owner.state.table = new ProcessTable();
    const sessions = owner.state.sessions = new Sessions({ core: hub.core, table, root, env });
    const fake = fakeHarness('claude-code');
    sessions.register(fake);
    let entered = false;
    let settled = false;
    let closed = false;
    let observedRootBeforeRemoval = false;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    owner.state.release = release;
    const spawn = fake.spawn.bind(fake);
    fake.spawn = async (request, resumed, authorize) => {
      entered = true;
      await gate;
      authorize?.();
      return spawn(request, resumed, authorize);
    };
    const close = fake.close.bind(fake);
    fake.close = () => { assert.equal(settled, true, 'pending launch settles before Sessions closes'); close(); closed = true; };
    owner.state.restore = async () => {
      assert.equal(settled && closed, true);
      await access(root);
      observedRootBeforeRemoval = true;
    };
    const result = owner.track(sessions.launch({ name: 'held', role: 'implementer' }));
    let terminal: unknown;
    void result.then(() => { settled = true; terminal = 'unexpected launch'; }, error => { settled = true; terminal = error; });
    await eventually('launch entered native preparation', () => entered ? true : undefined, 1000);
    await writeFile(files.roles, text('unguarded'));
    await roles.fresh();
    // An assertion/setup failure skips the normal release and result join; framework teardown owns both.
    await assert.rejects(async () => { throw new Error('synthetic early fixture failure'); }, /synthetic early fixture failure/);
    for (const hook of hooks) await hook();
    assert.match(String(terminal), /roles\.toml.*in error.*implementer\.launch\.permissions/);
    assert.deepEqual(fake.spawns, [], 'teardown did not admit the held native launch');
    assert.equal(observedRootBeforeRemoval, true);
    await assert.rejects(access(root), { code: 'ENOENT' });
  });
}

for (const reader of ['RolesFile', 'ProjectConfiguration'] as const) {
  for (const boundary of ['cwd', 'native-spawn', 'native-relaunch'] as const) {
    test(`${reader} refuses invalid roles published during held ${boundary} preparation`, async t => {
      const owner = ownRoleFixture(t);
      const root = await tempProject(t);
      let entered = false;
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      owner.state.release = release;
      const files = layout(root);
      await mkdir(files.dir, { recursive: true });
      const text = (value: string) => `[implementer.launch]\nharness = "claude-code"\npermissions = "${value}"\n`;
      await writeFile(files.roles, text('skip'));
      const env = fixtureEnvironment(root, process.env);
      const roles = reader === 'RolesFile'
        ? new RolesFile(files.roles, undefined, undefined, work => work(), env)
        : new ProjectConfiguration(files, null, () => {}, env, work => work(), () => {}, async () => null);
      owner.state.roles = roles;
      t.mock.timers.enable({ apis: ['setInterval'] });
      await roles.start();
      const hub = createHubBase({ secret: 'test', roles });
      owner.state.hub = hub;
      const table = new ProcessTable();
      owner.state.table = table;
      const sessions = new Sessions({ core: hub.core, table, root, env });
      owner.state.sessions = sessions;
      const fake = fakeHarness('claude-code');
      sessions.register(fake);
      if (boundary === 'native-relaunch') await owner.track(sessions.launch({ name: 'held', role: 'implementer' }));
      const hold = async () => { entered = true; await gate; };
      if (boundary === 'cwd') {
        const stat = fsp.stat;
        t.mock.method(fsp, 'stat', async (...args: Parameters<typeof fsp.stat>) => {
          if (args[0] === root) await hold();
          return stat(...args);
        });
        syncBuiltinESMExports();
        owner.state.restore = () => { t.mock.restoreAll(); syncBuiltinESMExports(); };
      } else if (boundary === 'native-spawn') {
        const spawn = fake.spawn.bind(fake);
        fake.spawn = async (request, resumed, authorize) => {
          await hold();
          authorize?.();
          return spawn(request, resumed, authorize);
        };
      } else {
        const stop = fake.stop.bind(fake);
        fake.stop = async (process, resumed, authorize) => {
          await hold();
          authorize?.();
          return stop(process, resumed, authorize);
        };
      }
      const operation = boundary === 'native-relaunch'
        ? owner.track(sessions.resume('held', true))
        : owner.track(sessions.launch({ name: 'held', role: 'implementer' }));
      let terminal: { process: unknown } | { error: unknown } | undefined;
      void operation.then(process => { terminal = { process }; }, error => { terminal = { error }; });
      await eventually('actual asynchronous launch preparation entered', () => entered ? true : undefined, 1000);
      await writeFile(files.roles, text('unguarded'));
      await roles.fresh();
      assert.match(roles.launchError() ?? '', /implementer\.launch\.permissions/);
      release();
      const result = await eventually('held launch produced its terminal receipt', () => terminal, 1000);
      assert.ok('error' in result, 'known-invalid roles must refuse after asynchronous preparation');
      assert.match(String(result.error), /roles\.toml.*in error.*implementer\.launch\.permissions.*"unguarded"/);
      assert.deepEqual([fake.spawns.length, fake.stops.length, fake.resumes.length], [boundary === 'native-relaunch' ? 1 : 0, 0, 0]);
      await writeFile(files.roles, text('auto'));
      if (boundary === 'native-relaunch') assert.equal((await owner.track(sessions.resume('held', true))).found, true);
      else assert.equal((await owner.track(sessions.launch({ name: 'held', role: 'implementer' }))).name, 'held');
    });
  }
}

for (const reader of ['RolesFile', 'ProjectConfiguration'] as const) {
  for (const [key, harness, before, after, accepted] of [
    ['permissions', 'claude-code', 'skip', 'auto', ['""', 'auto', 'skip']],
    ['approval', 'codex', 'untrusted', 'never', ['""', 'never', 'on-request', 'untrusted']],
    ['sandbox', 'codex', 'danger-full-access', 'read-only', ['""', 'read-only', 'workspace-write', 'danger-full-access']],
  ] as const) {
    test(`${reader} refuses launch and relaunch with invalid ${key}, retaining the snapshot until correction`, async t => {
      const owner = ownRoleFixture(t);
      const root = await tempProject(t);
      const files = layout(root);
      await mkdir(files.dir, { recursive: true });
      const text = (value: string) => `[implementer.launch]\nharness = "${harness}"\n${key} = "${value}"\n`;
      const policyValue = (policy: LaunchPolicy | undefined) => key === 'sandbox' ? policy?.sandbox?.mode : policy?.[key];
      await writeFile(files.roles, text(before));
      const env = fixtureEnvironment(root, process.env);
      const records: Array<Record<string, unknown>> = [];
      const log = (entry: Record<string, unknown>) => { records.push(entry); };
      let readError = false;
      const roles = reader === 'RolesFile'
        ? new RolesFile(files.roles, log, async path => {
          if (readError) throw Object.assign(new Error('synthetic read denial'), { code: 'EACCES' });
          return readFile(path, 'utf8');
        }, work => work(), env)
        : new ProjectConfiguration(files, null, log, env, work => work(), () => {}, async () => null);
      owner.state.roles = roles;
      t.mock.timers.enable({ apis: ['setInterval'] });
      await roles.start();
      const hub = createHubBase({ secret: 'test', roles });
      owner.state.hub = hub;
      const table = new ProcessTable();
      owner.state.table = table;
      const sessions = new Sessions({ core: hub.core, table, root, env });
      owner.state.sessions = sessions;
      const fake = fakeHarness(harness);
      sessions.register(fake);
      await owner.track(sessions.launch({ name: 'existing', role: 'implementer' }));
      const good = roles.get();
      await writeFile(files.roles, text('unguarded'));
      const refusal = (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /roles\.toml.*in error/);
        assert.ok(error.message.includes(`implementer.launch.${key}`), error.message);
        for (const value of ['"unguarded"', ...accepted]) assert.ok(error.message.includes(value), error.message);
        return true;
      };
      await assert.rejects(owner.track(sessions.launch({ name: 'next', role: 'implementer' })), refusal);
      // Repeated reads of the same invalid file must not erase the refusal.
      await assert.rejects(owner.track(sessions.resume('existing', true)), refusal);
      assert.equal(roles.get(), good, 'running sessions keep the complete last-good snapshot');
      assert.deepEqual([fake.spawns.length, fake.stops.length, fake.resumes.length], [1, 0, 0]);
      assert.equal(table.get('existing')?.status, 'running');
      assert.ok(records.some(entry => entry.event === 'roles-unreadable' && String(entry.error).includes(`implementer.launch.${key}`)));
      await owner.track(sessions.launch({ name: 'roleless', role: null, harness }));
      assert.equal(fake.spawns.at(-1)?.role, null, 'roleless launches do not consume stale role policy');
      assert.equal((await owner.track(sessions.resume('existing'))).found, true, 'reattaching an existing process remains available');
      await writeFile(files.roles, text(after));
      await owner.track(sessions.launch({ name: 'next', role: 'implementer' }));
      assert.equal(policyValue(fake.spawns.at(-1)), after);
      assert.equal((await owner.track(sessions.resume('existing', true))).found, true);
      assert.equal(policyValue(fake.resumes.at(-1)?.options?.policy), after);
      await unlink(files.roles);
      await assert.rejects(owner.track(sessions.launch({ name: 'missing', role: 'implementer' })), /roles\.toml.*in error/);
      await writeFile(files.roles, text(after));
      await owner.track(sessions.launch({ name: 'restored', role: 'implementer' }));
      assert.equal(fake.spawns.at(-1)?.name, 'restored', 'restoring identical valid text clears a read error');
      if (reader === 'RolesFile' && key === 'permissions') {
        readError = true;
        await writeFile(files.roles, text(after));
        await assert.rejects(owner.track(sessions.launch({ name: 'denied', role: 'implementer' })), /synthetic read denial/);
        readError = false;
        await owner.track(sessions.launch({ name: 'readable', role: 'implementer' }));
        assert.equal(fake.spawns.at(-1)?.name, 'readable');
      }
    });
  }
}

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
    t.after(async () => { await sessions.close(); table.close(); });
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
    hub.core.store.rememberSessionCredential('unknown', 'fixture-session-authority');
  const conversation = hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
    t.after(() => conversation.closed());
    conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'cli' }));
    armed = true;
    conversation.receive(JSON.stringify({ type: operation, id: 'operation', as: { name: 'coord', credential: 'fixture-session-authority' }, ...(operation === 'session.launch' ? { name: 'target', role: 'reviewer', harness: 'claude-code' } : { session: 'target', relaunch: true }) }));
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
