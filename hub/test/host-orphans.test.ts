// T3: real fake-server PID collisions across hosts; await native exit before fixture teardown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { ProcessTable } from '../src/adapters/processes.ts';
import { findOrphans, orphanSessions, sweepOrphans } from '../src/orphans.ts';
import { fakeHarness } from './fakes/harness.ts';
import { tempProject, eventually, pidAlive } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fakeOpenCode, leftoverOpenCode, OPENCODE_FAKE } from './orphan-server-fixture.ts';

test('remote rows neither protect nor authorize sweeping local matching PIDs', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const fake = await fakeOpenCode(t);
  const pid = await leftoverOpenCode(t, root, OPENCODE_FAKE, fixtureEnvironment(root, { ...process.env, ...fake.env }));
  const row = { ...await fakeHarness('opencode').spawn({ name: 'remote', cwd: root, role: null, model: null }), pid, pidStarted: null };
  const table = new ProcessTable(join(root, '.cland/hub.db'));
  let closed = false;
  t.after(() => { if (!closed) table.close(); });
  table.put(row);
  assert.equal((await findOrphans(root)).some(p => p.process.pid === pid), false, 'local running row protects the server');
  table.put({ ...row, host: 't1' });
  assert.deepEqual(orphanSessions(root), [], 'doctor and sweeper share a local-only snapshot');
  const orphan = (await findOrphans(root)).find(p => p.process.pid === pid);
  assert.equal(orphan?.owned, true, 'remote row cannot protect a native leftover independently proved by its log and cwd');
  assert.doesNotMatch(orphan!.reason, /session remote/);
  await sweepOrphans(root, () => {});
  await eventually('native orphan exit', () => !pidAlive(pid) ? true : undefined);
  assert.equal(pidAlive(pid), false);

  // A row alone cannot turn a process belonging to another disposable project into a local candidate.
  const otherRoot = await tempProject(t);
  const otherPid = await leftoverOpenCode(t, otherRoot, OPENCODE_FAKE, fixtureEnvironment(otherRoot, { ...process.env, ...fake.env }));
  table.put({ ...row, pid: otherPid, status: 'stopped' });
  assert.ok((await findOrphans(root)).some(p => p.process.pid === otherPid), 'local row is a positive candidate control');
  table.put({ ...row, pid: otherPid, status: 'stopped', host: 't1' });
  assert.deepEqual(orphanSessions(root), []);
  assert.equal((await findOrphans(root)).some(p => p.process.pid === otherPid), false);
  assert.deepEqual(await sweepOrphans(root, () => {}), []);
  assert.equal(pidAlive(otherPid), true);
  // A pre-column database is also readable by doctor without mutating it.
  table.close();
  closed = true;
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  db.exec('alter table harness_processes drop column host');
  db.close();
  assert.equal(orphanSessions(root)?.[0]?.name, 'remote');
});

test('orphan fixture seals the final native environment and preserves explicit scratch profiles', async t => {
  const { writeFile, readFile, chmod } = await import('node:fs/promises');
  const root = await tempProject(t);
  const bin = join(root, 'inspect-environment');
  const keys = ['DIGITALOCEAN_TOKEN', 'OPENAI_API_KEY', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0'];
  await writeFile(bin, `#!${process.execPath}\nconsole.log(JSON.stringify({present: ${JSON.stringify(keys)}.filter(k => process.env[k] !== undefined), home: process.env.HOME, data: process.env.XDG_DATA_HOME, database: process.env.OPENCODE_DB, config: process.env.OPENCODE_CONFIG, content: process.env.OPENCODE_CONFIG_CONTENT})); console.log('listening on synthetic'); setInterval(() => {}, 1000);\n`);
  await chmod(bin, 0o700);
  const before = new Map(keys.map(key => [key, process.env[key]]));
  const home = join(root, 'owned-home');
  const data = join(root, 'owned-data');
  const config = join(root, 'owned-config.json');
  try {
    for (const key of keys) process.env[key] = 'synthetic-final-environment-sentinel';
    assert.ok(keys.every(key => process.env[key] !== undefined), 'positive inherited-input control');
    await leftoverOpenCode(t, root, bin, { HOME: home, XDG_DATA_HOME: data, OPENCODE_DB: join(data, 'opencode.db'), OPENCODE_CONFIG: config, OPENCODE_CONFIG_CONTENT: '{}' }, root, 'sentinel');
  } finally {
    for (const [key, value] of before) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  const lines = await readFile(join(root, '.cland/opencode/sentinel/serve.log'), 'utf8');
  const observed = JSON.parse(lines.split('\n')[0]!);
  assert.deepEqual(observed, { present: [], home, data, database: join(data, 'opencode.db'), config, content: '{}' });
});
