// T1: the web policy's pure decision boundary, independent of live transports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEB_AUTHORITY, webAuthorityRefusal } from '../src/hub/web-authority.ts';

test('the web allows human workbench reads, writes, queued verification and merge', () => {
  for (const type of ['topic.send', 'task.create', 'task.edit', 'session.resume', 'session.stop', 'session.bridge', 'suite.start', 'suite.slot', 'suite.cancel', 'suite.classify', 'merge', 'executor.status', 'artifact.promote', 'artifact.move']) {
    assert.equal(webAuthorityRefusal({ type, id: 'request' }), null, type);
  }
  assert.equal(webAuthorityRefusal({ type: 'artifact.create', id: 'inline', content: 'web bytes' }), null);
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
