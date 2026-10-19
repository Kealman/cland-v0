// T1: shared doctor/setup detection with in-memory installation facts and command replies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { probeHarness } from '../src/doctor/toolchain.ts';
import type { HarnessId } from '../src/doctor/ranges.ts';
import type { run } from '../src/doctor/report.ts';

const env = { HOME: '/scratch' };
const installed = async (id: HarnessId) => ({ bin: `/tools/${id}` });

function replies(version: string, auth: string): typeof run {
  return async (_bin, args) => ({ code: 0, stdout: args[0] === '--version' ? version : auth, stderr: '' });
}

test('each shared harness probe reports its found version as information', async () => {
  for (const [id, version, auth, detail] of [
    ['claude-code', '2.3.0', '{"loggedIn":true}', '2.3.0 at /tools/claude-code (tested with 2.1.294)'],
    ['codex', '0.163.0', 'Logged in using ChatGPT', '0.163.0 at /tools/codex (tested with 0.160.0)'],
    ['opencode', '2.0.40', '[{"name":"OpenAI","connections":[{"type":"credential"}]}]', "2.0.40 at /tools/opencode (tested with 2.0.24; cland speaks OpenCode's v2 API)"],
  ] as const) {
    const result = await probeHarness(id, env, replies(version, auth), installed);
    assert.equal(result.id, id);
    assert.equal(result.bin, `/tools/${id}`);
    assert.equal(result.version?.join('.'), version);
    assert.deepEqual(result.checks, [
      { name: id, verdict: 'ok', detail },
      { name: `${id} auth`, verdict: 'ok', detail: id === 'claude-code' ? 'logged in' : id === 'codex' ? 'Logged in using ChatGPT' : 'credentials for OpenAI' },
    ]);
  }
});

test('OpenCode majors leave compatibility to the adapter behaviour check', async () => {
  for (const version of ['1.4.0', '3.0.0']) {
    const result = await probeHarness('opencode', env, replies(version, '[{"name":"OpenAI","connections":[{"type":"credential"}]}]'), installed);
    assert.deepEqual(result.checks[0], {
      name: 'opencode', verdict: 'ok', detail: `${version} at /tools/opencode (tested with 2.0.24; cland speaks OpenCode's v2 API)`,
    });
    assert.equal(result.checks[1]?.verdict, 'ok', 'login is still checked for another major');
  }
});

test('a harness with no readable version fails detection', async () => {
  for (const result of [
    { code: 1, stdout: '', stderr: 'broken installation' },
    { code: null, stdout: '', stderr: '', error: 'cannot execute' },
    { code: 0, stdout: 'no version here', stderr: '' },
  ]) {
    const probe: typeof run = async (_bin, args) => args[0] === '--version' ? result : { code: 0, stdout: '[]', stderr: '' };
    const found = await probeHarness('opencode', env, probe, installed);
    assert.equal(found.version, null);
    assert.equal(found.checks[0]?.verdict, 'fail');
    assert.ok(found.checks[0]?.fix);
  }
});

test('OpenCode login counts stored credentials and excludes environment connections', async () => {
  const none = await probeHarness('opencode', env, replies('2.0.24', '[]'), installed);
  assert.match(none.checks[1]?.detail ?? '', /no stored credentials.*free OpenCode models/);
  assert.equal(none.checks[1]?.verdict, 'warn');
  for (const connections of [
    [{ name: 'Environment OpenAI', connections: [{ type: 'env', name: 'OPENAI_API_KEY' }] }],
    [{ name: 'Untyped provider' }],
  ]) {
    const result = await probeHarness('opencode', env, replies('2.0.24', JSON.stringify(connections)), installed);
    assert.deepEqual(result.checks[1], none.checks[1]);
  }
  const mixed = await probeHarness('opencode', env, replies('2.0.24', JSON.stringify([
    { name: 'Environment OpenAI', connections: [{ type: 'env', name: 'OPENAI_API_KEY' }] }, { name: 'Stored Anthropic', connections: [{ type: 'credential', label: 'Anthropic' }] },
  ])), installed);
  assert.deepEqual(mixed.checks[1], { name: 'opencode auth', verdict: 'ok', detail: 'credentials for Stored Anthropic' });
});
