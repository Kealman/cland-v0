// T1: native stream/keypress seam, no terminal process or wall-clock wait.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { readSecret } from '../src/cli/secret.ts';

function tty() {
  const stream = Object.assign(new PassThrough(), {
    isTTY: true, isRaw: false,
    setRawMode(value: boolean) { this.isRaw = value; return this; },
  });
  return stream;
}

test('hidden secret input edits without echo and restores terminal mode after confirmation', { timeout: 500 }, async () => {
  const input = tty();
  let output = '';
  const pending = readSecret(input, { write: (chunk: string | Uint8Array) => { output += String(chunk); return true; } });
  assert.equal(input.isRaw, true);
  input.write('made-up-x\x7fkey\r');
  assert.ok(await pending === 'made-up-key', 'keypress receipt returns the edited input');
  assert.equal(output, 'Secret: \n');
  assert.equal(input.isRaw, false);
  assert.equal(input.readableFlowing, false, 'confirmation releases a previously non-flowing input');
  assert.equal(input.listenerCount('keypress'), 0);
  input.destroy();
});

test('hidden secret input cancellation restores raw mode without printing the partial value', { timeout: 500 }, async () => {
  const input = tty();
  let output = '';
  const pending = readSecret(input, { write: (chunk: string | Uint8Array) => { output += String(chunk); return true; } });
  input.write('made-up\x03');
  await assert.rejects(pending, /secret input cancelled/);
  assert.equal(output, 'Secret: \n');
  assert.equal(input.isRaw, false);
  assert.equal(input.readableFlowing, false, 'cancellation releases a previously non-flowing input');
  assert.equal(input.listenerCount('keypress'), 0);
  input.destroy();
});

test('piped secret input preserves spaces and strips only the final CRLF', { timeout: 500 }, async () => {
  const input = new PassThrough();
  const pending = readSecret(input);
  input.end('  made-up  \r\n');
  assert.ok(await pending === '  made-up  ', 'stdin retains significant spaces');
});

test('hidden secret input preserves an already flowing stream', { timeout: 500 }, async () => {
  const input = tty();
  input.resume();
  const pending = readSecret(input, { write: () => true });
  input.write('made-up\r');
  assert.ok(await pending === 'made-up', 'confirmation returns the stream input');
  assert.equal(input.readableFlowing, true);
  assert.equal(input.isRaw, false);
  input.destroy();
});
