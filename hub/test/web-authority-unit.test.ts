// T1: the web policy's pure decision boundary, independent of live transports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEB_AUTHORITY, webAuthorityRefusal } from '../src/hub/web-authority.ts';

test('the web allows human workbench reads, writes, queued verification and merge', () => {
  for (const type of ['session.history', 'web.session', 'resume', 'topic.send', 'task.create', 'task.edit', 'session.resume', 'session.stop', 'session.bridge', 'suite.start', 'suite.slot', 'suite.cancel', 'suite.classify', 'merge', 'executor.status', 'artifact.promote', 'artifact.move', 'artifact.url', 'approval.answer']) {
    assert.equal(webAuthorityRefusal({ type, id: 'request' }), null, type);
  }
  assert.equal(webAuthorityRefusal({ type: 'artifact.create', id: 'inline', content: 'web bytes' }), null);
  assert.equal(webAuthorityRefusal({ type: 'session.list', id: 'archived', archived: true }), null);
});

test('the web refuses any as field on every classified request, even a malformed value', () => {
  for (const type of Object.keys(WEB_AUTHORITY)) {
    for (const as of [undefined, null, false, '', {}, { name: 'human' }, { name: 'other', shell: true }]) {
      const refusal = webAuthorityRefusal({ type, id: 'request', as });
      assert.equal(refusal?.code, 'cli-neovim-only', type);
      assert.match(refusal?.error ?? '', /acts as another identity/);
    }
  }
});

test('the web refuses any artifact path even alongside content or with an invalid value', () => {
  for (const path of [undefined, null, false, '', '/fixture/file']) {
    const refusal = webAuthorityRefusal({ type: 'artifact.create', id: 'path', path, content: 'inline' });
    assert.equal(refusal?.code, 'cli-neovim-only');
    assert.match(refusal?.error ?? '', /reads a local artifact path/);
  }
});

test('the web denies absent rows and prototype names, including malformed request ids', () => {
  for (const type of ['future.frame', 'hub.restart', 'constructor', 'toString', '__proto__', null]) {
    assert.deepEqual(webAuthorityRefusal({ type }), {
      type: 'result', id: '?', ok: false, code: 'cli-neovim-only',
      error: `${String(type)} lives in the CLI and Neovim: has no web authority classification`,
    });
  }
});

test('web launch directories are refused before dispatch, including malformed fields', () => {
  assert.equal(webAuthorityRefusal({ type: 'session.launch', id: 'root', name: 'worker' }), null);
  for (const cwd of [undefined, null, false, '', '/fixture']) {
    const refusal = webAuthorityRefusal({ type: 'session.launch', id: 'directory', name: 'worker', cwd });
    assert.equal(refusal?.code, 'cli-neovim-only');
    assert.match(refusal?.error ?? '', /directory/);
  }
});


test('user authority reads stored roles per call and supports an omitted test-role request', async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const { Users } = await import('../src/hub/users.ts');
  const policy = await import('../src/hub/web-authority.ts');
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const users = new Users(db);
  const user = users.firstAdmin('Jane', [], 1);
  users.setMode('users', 2);
  assert.deepEqual(users.roles(), ['admin']);
  for (const type of Object.keys(WEB_AUTHORITY)) {
    assert.equal(policy.userAuthorityRefusal(users, user.id, { type }), null, type);
  }
  const table = Object.fromEntries(Object.entries(WEB_AUTHORITY).map(([type, web]) =>
    [type, { web, roles: type === 'topic.send' ? ['admin'] : ['admin', 'test-reader'] }]));
  db.exec("insert into roles values ('test-reader')");
  db.prepare('update users set role=? where id=?').run('test-reader', user.id);
  assert.equal(policy.userAuthorityRefusal(users, user.id, { type: 'topic.list' }, table), null);
  const refused = policy.userAuthorityRefusal(users, user.id, { type: 'topic.send', id: 'denied' }, table);
  assert.equal(refused?.ok, false);
  assert.equal(refused?.id, 'denied');
  assert.match(refused?.error ?? '', /test-reader.*topic.send/);
  assert.equal(policy.userAuthorityRefusal(users, user.id, { type: 'topic.send' })?.ok, false);
  db.prepare('update users set role=? where id=?').run('admin', user.id);
  assert.equal(policy.userAuthorityRefusal(users, user.id, { type: 'topic.send' }), null);
  for (const type of ['constructor', '__proto__', 'future.frame'])
    assert.equal(policy.userAuthorityRefusal(users, user.id, { type })?.ok, false);
  assert.equal(policy.userAuthorityRefusal(users, 'missing', { type: 'topic.send' })?.ok, false);
  users.setMode('single', 3);
  assert.equal(policy.userAuthorityRefusal(users, 'missing', { type: 'topic.send' }), null);
});
