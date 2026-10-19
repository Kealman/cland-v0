// T1: socket placement is a pure path decision; no hub, sockets or processes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { layout } from '../src/project.ts';

test('socket placement stays within the macOS byte limit under nested temporary roots', () => {
  const original = process.env.TMPDIR;
  try {
    const project = '/project/' + 'nested/'.repeat(20);
    for (const [temporary, expected] of [
      ['/tmp', '/tmp'],
      ['/private/tmp/cland-suite-short', '/private/tmp/cland-suite-short'],
      ['/private/tmp/cland-suite-effa9041-1234-4567-8901-123456789012/cland-proj-8uANdt', '/tmp'],
      ['/tmp/' + 'é'.repeat(40), '/tmp'],
    ]) {
      process.env.TMPDIR = temporary;
      assert.equal(layout('/short').socket, '/short/.cland/hub.sock');
      const socket = layout(project).socket;
      assert.ok(Buffer.byteLength(socket) <= 100, socket);
      assert.equal(dirname(socket), expected);
      assert.equal(layout(project).socket, socket, 'placement is stable for discovery');
      assert.notEqual(layout(project + '/other').socket, socket, 'projects have distinct sockets');
    }
  } finally {
    if (original === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = original;
  }
});
