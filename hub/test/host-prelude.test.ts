import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPrelude } from '../src/host/prelude.ts';

const keys = { hostKey: 'fixture-private-key\n', hostPublicKey: 'ssh-ed25519 fixture-public-key' };
test('C1: prelude installs pinned keys and hardened sshd settings', () => {
  const script = renderPrelude({ ...keys, providerSteps: '' });
  assert.ok(script.startsWith('#!/bin/bash\nset -eu\n'));
  for (const value of [keys.hostKey.trim(), keys.hostPublicKey, 'ssh_host_ed25519_key', 'chmod 600', 'chmod 644', 'StreamLocalBindUnlink yes', 'ClientAliveInterval 15', 'ClientAliveCountMax 4', 'MaxSessions 32', 'PasswordAuthentication no']) assert.ok(script.includes(value), value);
});

test('C2: DigitalOcean steps, helper, sudoers and file credential store are installed', () => {
  const script = renderPrelude({ ...keys, providerSteps: 'rm -f /etc/udev/rules.d/99-digitalocean-automount.rules\nudevadm control --reload' });
  for (const value of ['rm -f /etc/udev/rules.d/99-digitalocean-automount.rules', '/usr/local/sbin/cland-auth', 'runner ALL=(root) NOPASSWD: /usr/local/sbin/cland-auth', 'chmod 440 /etc/sudoers.d/cland-auth', 'chmod 755 /usr/local/sbin/cland-auth', 'cli_auth_credentials_store = "file"', '/home/runner/.codex/config.toml']) assert.ok(script.includes(value), value);
});

const secretNames = ['DIGITALOCEAN_TOKEN', 'CLAND_SECRET', 'CLAND_HUB_SECRET', 'CLAND_HOST_SECRET', 'CLAND_PROJECT_SECRET', 'CLAND_TELEGRAM_TOKEN', 'CLAND_DISCORD_TOKEN', 'TELEGRAM_BOT_TOKEN', 'DISCORD_BOT_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN'];
function scan(script: string, sentinels: string[]) {
  for (const value of sentinels) assert.ok(!script.includes(value), 'credential value leaked');
  for (const name of secretNames) assert.doesNotMatch(script, new RegExp(`(?:^|[\\s;])(?:export\\s+)?${name}\\s*=`, 'm'));
}
test('C3: sentinel scan detects planted values and assignments, and rendered data excludes environment secrets', () => {
  const saved = secretNames.map(name => process.env[name]);
  const sentinels = secretNames.map((_, i) => `cland-test-secret-sentinel-${i}`);
  try {
    secretNames.forEach((name, i) => { process.env[name] = sentinels[i]; });
    const script = renderPrelude({ ...keys, providerSteps: '' });
    for (const value of sentinels) assert.throws(() => scan(`${script}\n${value}`, sentinels), /credential value leaked/);
    for (const name of secretNames) assert.throws(() => scan(`${script}\nexport ${name}=planted`, sentinels));
    scan(script, sentinels);
  } finally {
    secretNames.forEach((name, i) => { if (saved[i] === undefined) delete process.env[name]; else process.env[name] = saved[i]; });
  }
});
