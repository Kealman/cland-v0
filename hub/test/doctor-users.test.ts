// T2: public doctor text/JSON against isolated in-process project hubs.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { doctor, initialised, toolchain } from './doctor-fixture.ts';
import { projectHub } from './harness.ts';
import type { Check } from '../src/doctor/report.ts';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { askHubFrame } from '../src/cli/socket-client.ts';
import { legacyRemoteHubFixture } from './fakes/legacy-remote-hub.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { checkUsers } from '../src/doctor/users.ts';
import { FakeClock } from './fake-clock.ts';
import { realClock } from '../src/hub/clock.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { testWaitMs } from './until.ts';

test('doctor keeps held live user counts unknown after timeout', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  await writeFile(join(root, '.cland/config.toml'), '[auth]\nmode="users"\n');
  const received = Promise.withResolvers<void>(), clock = new FakeClock(Date.now());
  const old = legacyRemoteHubFixture(t, root, { holdUsers: () => received.resolve() });
  await old.start();
  const work = checkUsers(root, tools.env, clock);
  beforeDirectories(t, async () => { await clock.advance(3000); await work; });
  await within(received.promise, testWaitMs(1000), realClock, () => new Error('held user.list receipt missing'));
  await clock.advance(3000);
  assert.deepEqual(await work, [{ name: 'sign-in mode', verdict: 'warn', detail: 'users; counts unavailable (hub did not answer)', fix: 'cland hub reload' }]);
  assert.equal(old.receipts().closed, false, 'live listener is retained');
});

test('C2 doctor reads users counts from the hub and labels offline counts unknown', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  await writeFile(join(root, '.cland/config.toml'), '[auth]\nmode="users"\n');
  assert.deepEqual(row((await doctor(root, tools.env, '--json')).stdout), { name: 'sign-in mode', verdict: 'warn', detail: 'users; counts: hub not running', fix: 'cland hub start' });
  const config = defaultConfig('Doctor users');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const hub = await projectHub(t, root, {}, { git: async () => 'Jane Doe\n' });
  await askHubFrame(hub.discovery, { type: 'auth.mode', mode: 'users' }, 3000, tools.env);
  await askHubFrame(hub.discovery, { type: 'user.add', name: 'guest' }, 3000, tools.env);
  assert.deepEqual(row((await doctor(root, tools.env, '--json')).stdout), { name: 'sign-in mode', verdict: 'ok', detail: 'users; 1 active, 1 invited; 2 admins (1 active)' });
  assert.match((await doctor(root, tools.env)).stdout, /users; 1 active, 1 invited; 2 admins \(1 active\)/);
});

test('doctor warns when config users disagrees with a running single-mode hub', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  await projectHub(t, root);
  await writeFile(join(root, '.cland/config.toml'), '[auth]\nmode="users"\n');
  assert.deepEqual(row((await doctor(root, tools.env, '--json')).stdout), { name: 'sign-in mode', verdict: 'warn', detail: "users; running hub doesn't report users mode", fix: 'cland hub reload' });
});

test('C3 doctor warns with invite fix when no active admin exists', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  await writeFile(join(root, '.cland/config.toml'), '[auth]\nmode="users"\n');
  await legacyRemoteHubFixture(t, root, { users: () => ({ users: [{ role: 'admin', state: 'invited' }] }) }).start();
  assert.deepEqual(row((await doctor(root, tools.env, '--json')).stdout), { name: 'sign-in mode', verdict: 'warn', detail: 'users; 0 active, 1 invited; 1 admins (0 active)', fix: 'cland user invite <name>' });
  assert.match((await doctor(root, tools.env)).stdout, /cland user invite <name>/);
});

test('doctor reports hub not running for stale discovery with a live PID', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  await writeFile(join(root, '.cland/config.toml'), '[auth]\nmode="users"\n');
  const old = legacyRemoteHubFixture(t, root);
  await old.start();
  await old.dispose();
  assert.deepEqual(row((await doctor(root, tools.env, '--json')).stdout), { name: 'sign-in mode', verdict: 'warn', detail: 'users; counts: hub not running', fix: 'cland hub start' });
});

test('C4 doctor omits planted identity and credential material in text and JSON', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  await writeFile(join(root, '.cland/config.toml'), '[auth]\nmode="users"\n');
  const sentinels = ['synthetic-invite-marker', 'synthetic-passkey-marker', 'synthetic-password-marker'];
  const leaks = (text: string) => sentinels.filter(value => text.includes(value));
  const planted = { users: [{ role: 'admin', state: 'active', name: sentinels[0], displayName: sentinels[1], password: sentinels[2] }], invite: sentinels[0], passkey: sentinels[1], password: sentinels[2] };
  assert.deepEqual(leaks(JSON.stringify(planted)), sentinels, 'positive control catches all planted material before doctor');
  await legacyRemoteHubFixture(t, root, { users: () => planted }).start();
  for (const args of [[], ['--json']]) {
    const output = (await doctor(root, tools.env, ...args)).stdout;
    assert.deepEqual(leaks(output), []);
    assert.match(output, /1 active/);
  }
});

const row = (text: string): Check => {
  const rows = (JSON.parse(text).checks as Check[]).filter(c => c.name === 'sign-in mode');
  assert.equal(rows.length, 1);
  return rows[0]!;
};
test('C1 doctor reports single mode from the running hub', async t => {
  const tools = await toolchain(t), root = await initialised(t, tools.env);
  await projectHub(t, root);
  assert.deepEqual(row((await doctor(root, tools.env, '--json')).stdout), { name: 'sign-in mode', verdict: 'ok', detail: 'single' });
  assert.match((await doctor(root, tools.env)).stdout, /ok\s+sign-in mode\s+single/);
});
