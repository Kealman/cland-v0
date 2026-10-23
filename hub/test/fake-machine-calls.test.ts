// T1: the fake-machine log writer records environment names after its durable append.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordMachineCall } from './fakes/digitalocean/machine-calls.ts';

test('fake machine calls persist sorted environment names without credential values', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-machine-calls-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sentinel = 'cland-test-log-credential-sentinel';
  const env = { Z_LAST: 'private path', DIGITALOCEAN_TOKEN: sentinel, A_FIRST: 'private account' };
  await recordMachineCall(root, 'ssh', ['runner@fixture', 'true'], { install: false }, env);
  const text = await readFile(join(root, 'machine-calls.jsonl'), 'utf8');
  assert.ok(!text.includes(sentinel), 'credential sentinel absent from durable log');
  assert.ok(!text.includes('private path') && !text.includes('private account'), 'all environment values absent');
  const record = JSON.parse(text);
  assert.deepEqual(record, { mode: 'ssh', args: ['runner@fixture', 'true'], faults: { install: false }, env: ['A_FIRST', 'DIGITALOCEAN_TOKEN', 'Z_LAST'] });
  assert.ok(env.DIGITALOCEAN_TOKEN === sentinel, 'logger leaves the caller environment unchanged');
});
