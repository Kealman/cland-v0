// T1: project-local resolver and file writes; no hub, child, network or real time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveSecrets, setSecret, SECRET_NAMES } from '../src/remote/secrets.ts';

const overrides = {
  CLAND_TELEGRAM_TOKEN: `123456:${'fake_override_'.repeat(3)}`,
  CLAND_DISCORD_TOKEN: 'fake-discord-override',
  ELEVENLABS_API_KEY: 'fake-elevenlabs-override',
  XAI_API_KEY: 'fake-xai-override',
};

test('all four environment overrides win over file values and work without a file', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-secret-resolution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.cland'));
  const expected = Object.values(overrides);
  for (const [index, name] of SECRET_NAMES.entries()) {
    assert.ok(resolveSecrets(root, overrides)[name] === expected[index], `environment-only resolution: ${name}`);
  }
  for (const name of SECRET_NAMES) setSecret(root, name, `123456:${'fake_file_'.repeat(4)}`);
  const resolved = resolveSecrets(root, overrides);
  for (const [index, name] of SECRET_NAMES.entries()) {
    assert.ok(resolved[name] === expected[index], `override wins: ${name}`);
    assert.ok(resolveSecrets(root, {})[name] === `123456:${'fake_file_'.repeat(4)}`, `file fallback: ${name}`);
  }
  assert.ok(resolveSecrets(root, { CLAND_DISCORD_TOKEN: overrides.CLAND_DISCORD_TOKEN })['speech.xai_key'] === `123456:${'fake_file_'.repeat(4)}`, 'partial overrides retain other file values');
});

test('secret file edits and reads remain file-only while environment overrides are present', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-secret-edits-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.cland'));
  const { readSecretsFile, unsetSecret } = await import('../src/remote/secrets.ts');
  const previous = Object.fromEntries(Object.keys(overrides).map(name => [name, process.env[name]]));
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  Object.assign(process.env, overrides);
  const value = 'fake-stored-discord';
  setSecret(root, 'discord.token', value);
  const stored = readSecretsFile(root);
  assert.deepEqual(Object.keys(stored), ['discord.token'], 'set never copies other environment keys');
  assert.ok(stored['discord.token'] === value, 'set writes its input rather than its environment override');
  assert.ok(resolveSecrets(root)['discord.token'] === overrides.CLAND_DISCORD_TOKEN, 'default resolver reads the hub environment');
  unsetSecret(root, 'discord.token');
  assert.equal(Object.keys(readSecretsFile(root)).length, 0, 'unset removes only the file value without copying overrides');
  assert.ok(resolveSecrets(root)['discord.token'] === overrides.CLAND_DISCORD_TOKEN, 'unset leaves the environment override active');
});

test('Telegram validation applies after environment overrides without blocking repair of a stored value', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-secret-validation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.cland'));
  setSecret(root, 'telegram.token', `123456:${'fake_file_'.repeat(4)}`);
  assert.throws(() => resolveSecrets(root, { CLAND_TELEGRAM_TOKEN: 'malformed-fake-env' }), error => {
    assert.ok((error as Error).message === 'telegram.token: invalid token format (at most 80 characters)', 'environment refusal is value-free');
    return true;
  });
  setSecret(root, 'telegram.token', 'malformed-fake-file');
  assert.ok(resolveSecrets(root, overrides)['telegram.token'] === overrides.CLAND_TELEGRAM_TOKEN, 'a valid environment override wins before provider validation');
});
