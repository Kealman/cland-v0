// T2: launch admission and Lead claims need no native harness process.
import { FakeClock } from './fake-clock.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import type { HarnessProcessView, Message } from '../src/protocol.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

test('a Lead claims a configured container kind at the project root', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["initiative", "feature"]\n');
  const { discovery } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Configured feature', kind: 'feature' });
  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView; claim: { role: string }; worktree: unknown }>('session.launch', {
    name: 'feature-lead', role: 'lead', harness: 'claude-code', item: item.id,
  });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(launched.process.cwd, root);
  assert.equal(launched.process.item, item.id);
  assert.equal(launched.claim.role, 'lead');
  assert.equal(launched.worktree, null);
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: `@lead ${item.id} plan this feature` });
  assert.equal(sent.ok, true, sent.error);
  assert.deepEqual((sent.value as { message: Message }).message.to, ['feature-lead']);
});

test('the Coordinator launches explicit and preassigned Leads whose claims receive @lead traffic', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  for (const preassigned of [false, true]) {
    const name = preassigned ? 'lead-preassigned' : 'lead-explicit';
    const duplicateName = `${name}-duplicate`;
    const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'v0.1 epic', kind: 'epic' });
    if (preassigned) assert.equal((await ui.request({ type: 'role.set', session: name, role: 'lead' })).ok, true);
    const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView; claim: { session: string; role: string }; worktree: unknown }>('session.launch', {
      name, ...(preassigned ? {} : { role: 'lead' }), harness: 'claude-code', item: item.id,
    });
    assert.equal(launched.ok, true, launched.error);
    assert.equal(launched.process.cwd, root);
    assert.equal(launched.process.item, item.id);
    assert.equal(launched.process.label, `${name} [Lead]`);
    assert.equal(launched.worktree, null);
    assert.equal(launched.claim.session, name);
    assert.equal(launched.claim.role, 'lead');
    const listed = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    assert.equal(listed.processes.find(p => p.name === name)?.item, item.id);
    const viewed = await coord.call<{ item: { branch: string | null; claim: { session: string } } }>('task.view', { id: item.id });
    assert.equal(viewed.item.branch, null);
    assert.equal(viewed.item.claim.session, name);
    const sent = await ui.request({ type: 'topic.send', topic: 'general', text: `@lead ${item.id} plan this epic` });
    assert.equal(sent.ok, true, sent.error);
    assert.deepEqual((sent.value as { message: Message }).message.to, [name]);
    const lead = await inProcessSpoke(t, { cwd: root, discover: true, name, assignRole: false, sessionId: launched.process.sessionId });
    const clause = await lead.waitForEvent(e => e.params.meta?.kind === 'role');
    assert.match(clause.params.content, /you hold the role Lead/);
    assert.match(fake.spawns.find(s => s.name === name)!.clause!, /you hold the role Lead/);
    await lead.waitForEvent(e => e.params.content.includes('plan this epic'));
    await coord.waitForPresence(['coord', name]);
    const broadcast = await coord.call<{ ok: boolean; outcomes: Array<{ to: string; outcome: string }> }>('send', { to: ['lead'], text: 'Lead role broadcast' });
    assert.equal(broadcast.ok, true);
    assert.deepEqual(broadcast.outcomes.map(o => [o.to, o.outcome]), [['lead', 'delivered']]);
    await lead.waitForEvent(e => e.params.content.includes('Lead role broadcast'));
    const duplicate = await coord.call<{ ok: boolean; error: string }>('session.launch', {
      name: duplicateName, role: 'lead', harness: 'claude-code', item: item.id,
    });
    assert.equal(duplicate.ok, false);
    assert.match(duplicate.error, new RegExp(`claimed by ${name}`));
    assert.equal(fake.spawns.some(s => s.name === duplicateName), false);
    assert.equal((await ui.request({ type: 'session.stop', session: name, as: { name: 'coord' } })).ok, true);
    await lead.close();
  }
});

test('Lead launch requires an open epic or release; concurrent launches take only one node claim', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const fake = fakes['claude-code']!;
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const launch = (name: string, item?: string, cwd?: string) => coord.call<{ ok: boolean; error?: string; claim?: { session: string }; process?: HarnessProcessView }>('session.launch', {
    name, role: 'lead', harness: 'claude-code', ...(item ? { item } : {}), ...(cwd ? { cwd } : {}),
  });
  assert.match((await launch('no-node')).error!, /needs `item`/);
  for (const kind of ['task', 'question', 'spec', 'map', 'epic']) {
    const { item } = await coord.call<{ item: { id: string } }>('task.create', { ...(['task'].includes(kind) ? { size: 'M' } : {}), title: `Invalid ${kind}`, kind });
    if (kind === 'epic') {
      const closed = await ui.request({ type: 'task.close', item: item.id, override: 'Lead fixture: no epic demo' });
      assert.equal(closed.ok, true, closed.error);
    }
    const refused = await launch(`invalid-${kind}`, item.id);
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /open configured container/);
  }
  assert.deepEqual(fake.spawns, []);
  const { item: epic } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Race epic', kind: 'epic' });
  assert.match((await launch('wrong-cwd', epic.id, '.')).error!, /item.*cwd/);
  const results = await Promise.all([launch('lead-a', epic.id), launch('lead-b', epic.id)]);
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.match(results.find(r => !r.ok)!.error!, /being launched|claimed by/);
  assert.equal(fake.spawns.length, 1);
  const { item: release } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Release', kind: 'release' });
  const another = await launch('release-lead', release.id);
  assert.equal(another.ok, true, another.error);
  assert.equal(another.process?.cwd, root);
  assert.equal(another.claim?.session, 'release-lead');
});

test('an Implementer cannot launch Leads even with a session.launch grant', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  const impl = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', role: 'implementer' });
  t.after(async () => { await coord.close(); await impl.close(); });
  await coord.waitForPresence(['coord', 'impl']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Protected epic', kind: 'epic' });
  const path = join(root, '.cland/roles.toml');
  await writeFile(path, (await readFile(path, 'utf8')).replace('[implementer.permissions]\ntools = [', '[implementer.permissions]\ntools = ["session.launch", '));
  // A launch refreshes the file; ordinary launches prove that the added grant is active.
  await eventually('the edited launch grant is active', async () => {
    const result = await impl.call<{ ok: boolean; error?: string }>('session.launch', { name: 'ordinary', role: 'reviewer', harness: 'claude-code' });
    return result.ok ? result : undefined;
  });
  for (const preassigned of [false, true]) {
    if (preassigned) assert.equal((await ui.request({ type: 'role.set', session: 'lead-denied', role: 'lead' })).ok, true);
    const refused = await impl.call<{ ok: boolean; code: string; reason: string }>('session.launch', {
      name: 'lead-denied', ...(preassigned ? {} : { role: 'lead' }), harness: 'claude-code', item: item.id,
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'forbidden');
    assert.match(refused.reason, /only the Coordinator or an Aide.*launches Leads/);
  }
  assert.equal(fake.spawns.some(s => s.name === 'lead-denied'), false);
});
