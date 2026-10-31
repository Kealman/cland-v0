// T2: native Unix listener allocation and close under a deep, multibyte TMPDIR; no child or hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { tempProject } from './harness.ts';
import { beforeDirectories } from './process-cleanup.ts';

test('fixture socket binds within the macOS byte budget under a deep multibyte TMPDIR', async t => {
  const root = await tempProject(t);
  const deep = join(root, 'é'.repeat(60));
  await mkdir(deep);
  assert.ok(Buffer.byteLength(deep) >= 90);
  const previous = process.env.TMPDIR;
  process.env.TMPDIR = deep;
  const server = createServer();
  beforeDirectories(t, async () => {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    if (server.listening) {
      const closed = once(server, 'close', { signal: AbortSignal.timeout(5000) });
      server.close();
      await closed;
    }
  });
  const path = fixtureSocketPath(deep, '端'.repeat(60) + '.sock');
  assert.ok(Buffer.byteLength(path) + 1 < 104, path);
  assert.equal(fixtureSocketPath(deep, '端'.repeat(60) + '.sock'), path);
  assert.notEqual(fixtureSocketPath(deep, 'other.sock'), path);
  assert.notEqual(fixtureSocketPath(root, '端'.repeat(60) + '.sock'), path);
  const listening = once(server, 'listening', { signal: AbortSignal.timeout(5000) });
  server.listen(path);
  await listening;
  assert.equal((await stat(path)).isSocket(), true);
});

test('fixture sockets have private directory ownership after normal listener close', async t => {
  const root = await tempProject(t);
  const path = fixtureSocketPath(root, 'private.sock');
  const { dirname } = await import('node:path');
  assert.equal((await stat(dirname(path))).mode & 0o777, 0o700);
});
