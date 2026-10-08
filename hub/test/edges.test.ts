// The JSON-lines edges (spec 4.2): the Unix socket of a real daemon and the stdio of a child hub. Each line
// is a frame and is held to the frame limit on its own, however the bytes arrive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FRAME_BYTES, PROTOCOL_VERSION } from '../src/protocol.ts';
import { connectSocket, startDaemon, tempProject } from './harness.ts';

/** A valid `topic.list` request one byte under the frame limit (its newline not counted). */
export function nearLimitFrame(id: string): string {
  const base = JSON.stringify({ type: 'topic.list', id, pad: '' });
  const frame = JSON.stringify({ type: 'topic.list', id, pad: 'x'.repeat(MAX_FRAME_BYTES - 1 - Buffer.byteLength(base)) });
  assert.equal(Buffer.byteLength(frame), MAX_FRAME_BYTES - 1);
  return frame;
}

test('the Unix socket reads a near-limit frame and the next one from a single write; a line or a remainder over the limit closes', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectSocket(discovery.socket);
  t.after(() => ui.close());
  ui.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'ui' });
  assert.equal((await ui.next()).type, 'welcome');

  // a small frame first, so the near-limit one does not start on a read boundary; all three in one write
  ui.write(`${JSON.stringify({ type: 'topic.list', id: 'first' })}\n${nearLimitFrame('big')}\n${JSON.stringify({ type: 'topic.list', id: 'small' })}\n`);
  assert.equal((await ui.next(10_000)).id, 'first');
  const big = await ui.next(10_000);
  assert.equal(big.id, 'big');
  assert.equal(big.ok, true);
  const small = await ui.next();
  assert.equal(small.id, 'small');
  assert.equal(small.ok, true);

  // one line over the limit, even arriving complete with its newline, ends the connection
  ui.write(`${'x'.repeat(MAX_FRAME_BYTES + 1)}\n`);
  await ui.closed;

  // an unfinished line already over the limit ends it too, before its newline ever comes
  const other = await connectSocket(discovery.socket);
  t.after(() => other.close());
  other.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'ui' });
  assert.equal((await other.next()).type, 'welcome');
  other.write('x'.repeat(MAX_FRAME_BYTES + 1));
  await other.closed;
});
