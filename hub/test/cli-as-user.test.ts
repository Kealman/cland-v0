// T2: human --as over real CLI and project frames; disposable root and sealed fake adapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { sessionClandWithEnv } from './session-credential-fixture.ts';
import type { Inbox } from '../src/protocol.ts';

for (const users of [true, false]) test(`CLI ask --as retains ${users ? 'user' : 'stand-in'} identity and journal`, async t => {
  const root = await tempProject(t);
  const records: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { log: row => records.push(row) });
  const ui = await connectUi(t, hub.discovery);
  if (users) {
    const db = new DatabaseSync(join(root, '.cland/hub.db'));
    try {
      db.prepare('insert into users values (?,?,?,?,?,?)').run('jane-id', 'jane', 'Alex', 'admin', 'active', 1);
      db.prepare('insert into users values (?,?,?,?,?,?)').run('alex-id', 'alex', 'Jane', 'admin', 'active', 2);
      db.prepare("insert into auth_state values (1,'users',?)").run(Date.now());
    } finally { db.close(); }
  }
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  for (const name of ['alex', undefined]) {
    const asked = await coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Proceed?', options: ['Yes'] });
    const result = await cland(root, 'topic', 'answer', asked.ask, '1', ...(name ? ['--as', name] : []));
    assert.equal(result.code, 0, result.stderr);
    const inbox = (await ui.request({ type: 'inbox.list', archive: true })).value as Inbox;
    const outcome = inbox.archive!.find(row => row.id === asked.ask)!.outcome!;
    assert.equal(outcome.by, name ?? (users ? 'jane' : 'human'));
    assert.equal((outcome as { userId?: string }).userId, users ? (name ? 'alex-id' : 'jane-id') : undefined);
    const journal = records.find(row => row.event === 'ask-answered' && row.id === asked.ask)!;
    assert.equal(journal.userId, users ? (name ? 'alex-id' : 'jane-id') : undefined);
    assert.equal(journal.answered_as, users || !name ? 'human' : 'stand-in');
    assert.equal(journal.answered_by, users ? undefined : name);
  }
});

for (const users of [true, false]) for (const named of [undefined, 'alex']) test(`human write matrix in ${users ? 'users' : 'single'} mode as ${named ?? 'default'} preserves local and shell authority`, async t => {
  const root = await tempProject(t);
  const records: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { log: row => records.push(row) });
  const ui = await connectUi(t, hub.discovery);
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    db.prepare('insert into users values (?,?,?,?,?,?)').run('jane-id', 'jane', 'Alex', 'admin', 'active', 1);
    db.prepare('insert into users values (?,?,?,?,?,?)').run('alex-id', 'alex', 'Jane', 'admin', 'active', 2);
    db.prepare('insert into users values (?,?,?,?,?,?)').run('invite-id', 'invite', 'Invite', 'admin', 'invited', 3);
    db.prepare("insert into roles values ('viewer')").run();
    db.prepare('insert into users values (?,?,?,?,?,?)').run('viewer-id', 'viewer', 'Viewer', 'viewer', 'active', 4);
    if (users) db.prepare("insert into auth_state values (1,'users',?)").run(Date.now());
  } finally { db.close(); }
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'session.launch', name: 'worker', harness: 'opencode', role: 'implementer' })).ok, true);
  const ready = ui.waitFor(f => f.type === 'approval');
  hub.fakes.opencode!.raiseApproval('worker', { id: 'native', kind: 'command', subject: { command: 'echo test' }, choices: ['once', 'deny'] });
  const approvalId = ((await ready).approval as { id: string }).id;
  const asked = await coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Proceed?', options: ['Yes'] });
  const frames = [
    { type: 'topic.answer', ask: asked.ask, option: 1 },
    { type: 'topic.create', title: 'Created by CLI' },
    { type: 'topic.send', topic: 'general', text: 'Human writes' },
    { type: 'approval.answer', approval: approvalId, choice: 'once' },
    { type: 'artifact.create', kind: 'note', title: 'CLI note', content: 'note', topic: 'general' },
  ];
  if (users) {
    for (const frame of frames) for (const name of ['missing', 'invite', 'Jane', 'viewer']) {
      const result = await ui.request({ ...frame, as: { name } });
      assert.equal(result.ok, false, `${frame.type} accepted ${name}`);
      assert.match(result.error!, name === 'viewer' ? /role viewer/ : new RegExp(name));
    }
    for (const args of [
      ['topic', 'answer', asked.ask, '1'], ['topic', 'create', 'Refused'],
      ['artifact', 'create', '--kind', 'note', '--title', 'Refused', '--content', 'note', '--topic', 'general'],
    ]) for (const name of ['missing', 'invite']) {
      const result = await cland(root, ...args, '--as', name);
      assert.equal(result.code, 1, result.stderr);
      assert.match(result.stderr, new RegExp(name));
    }
  }
  // An unrecognised shell is still a session, even when its label names an active user.
  for (const frame of frames) {
    const result = await ui.request({ ...frame, as: { name: 'alex', shell: true } });
    assert.equal(result.ok, false, `${frame.type} promoted a shell to a person`);
  }
  // The fixture registers a real spoke credential; a named user cannot replace it.
  const shellEnv = { CLAND_SESSION_NAME: 'coord' };
  const shellAnswer = await sessionClandWithEnv(root, shellEnv, 'topic', 'answer', asked.ask, '1', '--as', 'alex');
  assert.equal(shellAnswer.code, 1, shellAnswer.stderr);
  assert.match(shellAnswer.stderr, /ignored.*session coord/);
  const shellArtifact = await sessionClandWithEnv(root, shellEnv, 'artifact', 'create', '--kind', 'note', '--title', 'Session artifact', '--content', 'session', '--topic', 'general', '--as', 'alex', '--json');
  assert.equal(shellArtifact.code, 0, shellArtifact.stderr);
  assert.equal(JSON.parse(shellArtifact.stdout).artifact.creator, 'coord');
  assert.equal(JSON.parse(shellArtifact.stdout).artifact.creatorUserId, undefined);
  const shellTopic = await sessionClandWithEnv(root, shellEnv, 'topic', 'create', 'Session topic', '--as', 'alex', '--json');
  assert.equal(shellTopic.code, 0, shellTopic.stderr);
  const shellReceipt = records.find(row => row.event === 'topic-created' && row.topic === JSON.parse(shellTopic.stdout).topic.id)!;
  assert.equal(shellReceipt.by, 'human');
  assert.equal(shellReceipt.userId, undefined);
  for (const frame of frames) {
    const result = await ui.request({ ...frame, ...(named ? { as: { name: named } } : {}) });
    assert.equal(result.ok, true, `${frame.type}: ${result.error}`);
    const value = result.value as { topic?: { id: string }; message?: { from: string; userId?: string }; approval?: { outcome: { by: string; userId?: string } }; artifact?: { creator: string; creatorUserId?: string } };
    if (value.topic) {
      const created = records.find(row => row.event === 'topic-created' && row.topic === value.topic!.id)!;
      assert.equal(created.by, users ? (named ?? 'jane') : 'human');
      assert.equal(created.userId, users ? (named ? 'alex-id' : 'jane-id') : undefined);
    }
    if (value.message) {
      assert.equal(value.message.userId, users ? (named ? 'alex-id' : 'jane-id') : undefined);
      assert.equal(value.message.from, users ? (named ?? 'jane') : 'human');
    }
    if (value.approval) {
      assert.equal(value.approval.outcome.by, users ? (named ?? 'jane') : 'human');
      assert.equal(value.approval.outcome.userId, users ? (named ? 'alex-id' : 'jane-id') : undefined);
      const departure = records.find(row => row.event === 'inbox-departure' && row.id === approvalId)!;
      assert.equal((departure.outcome as { userId?: string }).userId, users ? (named ? 'alex-id' : 'jane-id') : undefined);
    }
    if (value.artifact) {
      assert.equal(value.artifact.creator, users ? (named ?? 'jane') : 'human');
      assert.equal(value.artifact.creatorUserId, users ? (named ? 'alex-id' : 'jane-id') : undefined);
      assert.ok(records.some(row => row.event === 'event-announced' && row.kind === 'artifact' && row.userId === (users ? (named ? 'alex-id' : 'jane-id') : undefined)));
    }
    assert.ok(records.some(row => row.event === 'audit' && row.tool === frame.type && row.outcome === 'ok' && row.userId === (users ? (named ? 'alex-id' : 'jane-id') : undefined)), `${frame.type} has an exact audit receipt`);
  }
  for (const name of [undefined, 'alex']) {
    const args = name ? ['--as', name] : [];
    const created = await cland(root, 'topic', 'create', 'CLI topic', ...args, '--json');
    assert.equal(created.code, 0, created.stderr);
    const receipt = records.find(row => row.event === 'topic-created' && row.topic === JSON.parse(created.stdout).topic.id)!;
    assert.equal(receipt.by, users ? (name ?? 'jane') : 'human');
    assert.equal(receipt.userId, users ? (name ? 'alex-id' : 'jane-id') : undefined);
    const artifact = await cland(root, 'artifact', 'create', '--kind', 'note', '--title', 'CLI artifact', '--content', 'cli', '--topic', 'general', ...args, '--json');
    assert.equal(artifact.code, 0, artifact.stderr);
    assert.equal(JSON.parse(artifact.stdout).artifact.creatorUserId, users ? (name ? 'alex-id' : 'jane-id') : undefined);
  }
  if (users) {
    const db = new DatabaseSync(join(root, '.cland/hub.db'));
    try { db.prepare("update users set role='viewer' where id='jane-id'").run(); }
    finally { db.close(); }
    const result = await ui.request({ type: 'topic.send', topic: 'general', text: 'Refused caller', as: { name: 'alex' } });
    assert.equal(result.ok, false);
    assert.match(result.error!, /role viewer/);
  }

});
