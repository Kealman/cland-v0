// T2: production runSpoke on owned byte streams, with no child or hub required.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { runSpoke } from '../src/spoke/spoke.ts';
import { MAX_FRAME_BYTES } from '../src/protocol.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { tempProject, until } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';

test('spoke refuses oversized stdio before schema validation and serves the next request', async t => {
  const root = await tempProject(t);
  const input = new PassThrough();
  const output = new PassThrough();
  let runtime: Awaited<ReturnType<typeof runSpoke>> | undefined;
  onCleanup(t, async () => {
    try { await runtime?.server.close(); }
    finally { input.destroy(); output.destroy(); }
  });
  const replies: Array<{ id: number | null; error?: { code: number; message: string }; result?: unknown }> = [];
  let buffered = '';
  output.on('data', chunk => {
    buffered += String(chunk);
    let newline: number;
    while ((newline = buffered.indexOf('\n')) >= 0) {
      replies.push(JSON.parse(buffered.slice(0, newline)));
      buffered = buffered.slice(newline + 1);
    }
  });
  const exits: number[] = [];
  const env = fixtureEnvironment(root, process.env);
  runtime = await runSpoke(env, { cwd: root, stdio: { input, output }, exit: code => exits.push(code), log: () => {} });

  // An invalid tools/call envelope would yield the SDK's schema error if parsed.
  input.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'who', arguments: 42, pad: 'x'.repeat(MAX_FRAME_BYTES) } }) + '\n');
  await until(() => replies.length === 1, { what: 'oversized MCP refusal' });
  assert.deepEqual(replies[0], { jsonrpc: '2.0', id: null, error: { code: -32700, message: `MCP stdio message exceeds the ${MAX_FRAME_BYTES} byte (1 MiB) cap` } });
  assert.deepEqual(exits, []);
  input.write('{"jsonrpc":"2.0","id":2,"method":"ping"}\n');
  await until(() => replies.some(reply => reply.id === 2), { what: 'ping response after oversized line' });
  assert.deepEqual(replies.find(reply => reply.id === 2), { jsonrpc: '2.0', id: 2, result: {} });
  assert.deepEqual(exits, [], 'oversized input does not close the session');

  // Incomplete, malformed UTF-8 JSON: refuse by bytes before newline/JSON parsing.
  // Split inside a multibyte character, then exceed the cap with a short string.
  const multibyte = Buffer.from('é'.repeat(MAX_FRAME_BYTES / 2));
  input.write(multibyte.subarray(0, 1));
  input.write(multibyte.subarray(1));
  assert.equal(replies.length, 2, 'exactly the byte cap is allowed to remain unfinished');
  input.write('x');
  await until(() => replies.length === 3, { what: 'unfinished multibyte line size refusal' });
  assert.deepEqual(replies[2], replies[0]);
  input.write('discard this tail\n{"jsonrpc":"2.0","id":3,"method":"ping"}\n');
  await until(() => replies.some(reply => reply.id === 3), { what: 'ping after discarded oversized remainder' });
  assert.deepEqual(replies.find(reply => reply.id === 3), { jsonrpc: '2.0', id: 3, result: {} });

  // Count each message, not a whole read; keep the old JSON-RPC request shape.
  const atCap = (id: number) => {
    const base = JSON.stringify({ jsonrpc: '2.0', id, method: 'ping', params: { pad: '' } });
    const line = base.replace('"pad":""', `"pad":"${'x'.repeat(MAX_FRAME_BYTES - Buffer.byteLength(base))}"`);
    assert.equal(Buffer.byteLength(line), MAX_FRAME_BYTES);
    return line;
  };
  input.write(`${atCap(4)}\n${atCap(5)}\n`);
  await until(() => replies.some(reply => reply.id === 4) && replies.some(reply => reply.id === 5), { what: 'two cap-sized messages in one read' });
  assert.deepEqual(replies.slice(4), [{ jsonrpc: '2.0', id: 4, result: {} }, { jsonrpc: '2.0', id: 5, result: {} }]);
  input.write('{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"who","arguments":42}}\r\n');
  await until(() => replies.some(reply => reply.id === 6), { what: 'legacy under-cap schema rejection' });
  assert.equal(replies.find(reply => reply.id === 6)?.error?.code, -32603);
  assert.match(replies.find(reply => reply.id === 6)!.error!.message, /arguments/);
  assert.deepEqual(exits, []);
  input.end();
  await until(() => exits.length === 1, { what: 'session stdin EOF exit' });
  assert.deepEqual(exits, [0], 'the session still exits once on stdin EOF');
});
