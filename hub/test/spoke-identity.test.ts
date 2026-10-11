import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DOCUMENTED_TOOLS, sleep, spawnSpoke, startDaemon, tempProject, waitForAbsence } from './harness.ts';

test('a nameless spoke discovering a project hub skips connecting and journals the reason once', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const spoke = await spawnSpoke({ discover: true, cwd: root });
  t.after(() => spoke.close());

  const who = await spoke.call<{ ok: boolean; error?: string }>('who');
  assert.equal(who.ok, false);
  assert.match(who.error ?? '', /connection skipped: no CLAND_SESSION_NAME/);
  assert.match(who.error ?? '', /start the session through cland/);
  const { tools } = await spoke.client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), [...DOCUMENTED_TOOLS]);
  // The test harness retries after 50 ms, then 100 ms. Leave both opportunities open.
  await sleep(200);
  assert.deepEqual(await spoke.call('who'), who);
  assert.equal(spoke.events.length, 0);
  const records = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8'))
    .trim().split('\n').map(line => JSON.parse(line) as { event: string; reason?: string });
  const skipped = records.filter(record => record.event === 'spoke-connection-skipped');
  assert.equal(skipped.length, 1);
  assert.match(skipped[0]?.reason ?? '', /no CLAND_SESSION_NAME/);
  const hubLog = await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
  assert.doesNotMatch(hubLog, /"event":"(?:hello|refused-role|replaced)"/);
});

test('a blank session name and a role request do not bind a spoke to the discovered hub', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: '   ', role: 'implementer', assignRole: false });
  t.after(() => spoke.close());
  const who = await spoke.call<{ ok: boolean; error?: string }>('who');
  assert.equal(who.ok, false);
  assert.match(who.error ?? '', /connection skipped: no CLAND_SESSION_NAME/);
  await sleep(200);
  assert.doesNotMatch(await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8'), /"event":"(?:hello|refused-role|replaced)"/);
});

test('a named spoke with a human-assigned role connects without requesting a role', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  // The harness assigns implementer with role.set, and leaves CLAND_ROLE absent.
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'mapped' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['mapped']);
  const who = await spoke.call<{ ok: boolean; me: string; sessions: Array<{ name: string; role: string }> }>('who');
  assert.equal(who.ok, true);
  assert.equal(who.me, 'mapped');
  assert.equal(who.sessions.find(session => session.name === 'mapped')?.role, 'implementer');
  assert.doesNotMatch(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8'), /"event":"spoke-connection-skipped"/);
});

test('nameless spokes recover a mapped session id while live and after its last spoke leaves', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const first = await spawnSpoke({ discover: true, cwd: root, name: 'mapped', sessionId: 'mapped-id' });
  t.after(() => first.close());
  await first.waitForPresence(['mapped']);
  const witness = await spawnSpoke({ discover: true, cwd: root, name: 'witness', sessionId: 'witness-id' });
  t.after(() => witness.close());
  const joined = await spawnSpoke({ discover: true, cwd: root, sessionId: 'mapped-id' });
  t.after(() => joined.close());
  const live = await joined.call<{ ok: boolean; me?: string; error?: string }>('who');
  assert.equal(live.ok, true, live.error);
  assert.equal(live.me, 'mapped');
  await joined.close();
  await first.close();
  await waitForAbsence(witness, 'mapped');
  const recovered = await spawnSpoke({ discover: true, cwd: root, sessionId: 'mapped-id' });
  t.after(() => recovered.close());
  const offline = await recovered.call<{ ok: boolean; me?: string; error?: string }>('who');
  assert.equal(offline.ok, true, offline.error);
  assert.equal(offline.me, 'mapped');
  assert.doesNotMatch(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8'), /"event":"spoke-connection-skipped"/);
});
