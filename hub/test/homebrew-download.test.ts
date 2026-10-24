// T1: checksum and HTTP-response faults with fully in-memory fetch responses.
import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveSha256 } from '../src/homebrew.ts';

test('archive checksum hashes the completed response and rejects failed or empty downloads', async t => {
  let reply = new Response('abc');
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, 'https://example.test/cland.tar.gz');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    return reply;
  });
  assert.equal(await archiveSha256('https://example.test/cland.tar.gz'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  reply = new Response('not found', { status: 404 });
  await assert.rejects(archiveSha256('https://example.test/cland.tar.gz'), /HTTP 404/);
  reply = new Response('');
  await assert.rejects(archiveSha256('https://example.test/cland.tar.gz'), /empty/);
  reply = new Response(new ReadableStream({ start(controller) { controller.error(new Error('interrupted body')); } }));
  await assert.rejects(archiveSha256('https://example.test/cland.tar.gz'), /interrupted body/);
});
