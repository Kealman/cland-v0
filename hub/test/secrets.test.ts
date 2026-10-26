// T2: startup receipts through projectHub; stdin and argv belong to the real CLI boundary.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { projectHub } from './harness.ts';
import { secretCli as cli, secretProject } from './secrets-fixture.ts';

function storedToml(text: string) {
  try { return parse(text); }
  catch { throw new Error('stored secret file must parse as TOML'); }
}

test('hub start tightens secrets to 600 before serving', { timeout: 10_000 }, async t => {
  const { root } = await secretProject(t);
  const path = join(root, '.cland/secrets.toml');
  await mkdir(join(root, '.cland'));
  await writeFile(path, '[telegram]\n');
  await chmod(path, 0o644);
  const hub = await projectHub(t, root);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await hub.stop();
});

test('hub start refuses symlinked secrets without changing their target or leaving a lock', { timeout: 10_000 }, async t => {
  const { root } = await secretProject(t);
  await mkdir(join(root, '.cland'));
  const target = join(root, 'target.toml');
  await writeFile(target, '[discord]\n');
  await chmod(target, 0o644);
  await symlink(target, join(root, '.cland/secrets.toml'));
  await assert.rejects(projectHub(t, root), /secrets\.toml.*symlink/);
  assert.equal(await readFile(target, 'utf8'), '[discord]\n');
  assert.equal((await stat(target)).mode & 0o777, 0o644);
  await assert.rejects(stat(join(root, '.cland/hub.lock')), { code: 'ENOENT' });
});

test('secret set accepts stdin only, list prints names and fingerprints, and unset removes one value without leaking it', { timeout: 10_000 }, async t => {
  const { root } = await secretProject(t);
  await mkdir(join(root, '.cland'));
  const value = `123456:${'made_up_'.repeat(4)}`;
  const results = [];
  results.push(await cli(t, root, ['set', 'telegram.token'], `${value}\n`));
  assert.equal(results[0]!.code, 0, results[0]!.stderr);
  const path = join(root, '.cland/secrets.toml');
  const stored = storedToml(await readFile(path, 'utf8'));
  assert.ok((stored.telegram as Record<string, unknown>).token === value, 'stdin value is persisted exactly');
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  const hub = await projectHub(t, root);
  results.push(await cli(t, root, ['list']));
  assert.equal(results[1]!.code, 0, results[1]!.stderr);
  const fingerprint = createHash('sha256').update(value).digest('hex').slice(0, 12);
  assert.ok(results[1]!.stdout === `telegram.token ${fingerprint}\n`, 'list contains only name and SHA-256 prefix');
  results.push(await cli(t, root, ['unset', 'telegram.token']));
  assert.equal(results[2]!.code, 0, results[2]!.stderr);
  assert.ok(Object.keys(storedToml(await readFile(path, 'utf8'))).length === 0, 'unset removes the stored value');
  results.push(await cli(t, root, ['list']));
  assert.equal(results[3]!.stdout, '');
  await hub.stop();
  for (const result of results) {
    assert.equal(result.leaked, false, 'captured output contained a secret before redaction');
    assert.ok(!result.stdout.includes(value) && !result.stderr.includes(value), 'CLI output contains no secret');
    assert.ok(!result.argv.some(arg => arg.includes(value)), 'native CLI argv contains no secret');
  }
  for (const file of ['log/hub.log', 'journal.jsonl']) {
    assert.ok(!(await readFile(join(root, '.cland', file), 'utf8')).includes(value), 'hub log and journal contain no secret');
  }
});

test('secret commands refuse value arguments, unknown names, empty input and malformed TOML without echoing input', { timeout: 10_000 }, async t => {
  const { root } = await secretProject(t);
  await mkdir(join(root, '.cland'));
  // An argv value is forbidden; use a harmless flag as the extra argument, never a secret.
  const extra = await cli(t, root, ['set', 'telegram.token', '--value']);
  assert.equal(extra.code, 1);
  assert.match(extra.stderr, /never a value argument/);
  const unknown = await cli(t, root, ['set', 'unknown.key']);
  assert.equal(unknown.code, 1);
  assert.match(unknown.stderr, /names: telegram.token/);
  const empty = await cli(t, root, ['set', 'telegram.token']);
  assert.equal(empty.code, 1);
  assert.match(empty.stderr, /nonempty single line/);
  const path = join(root, '.cland/secrets.toml');
  // The fake value enters via stdin; corrupt only the TOML syntax afterwards.
  const value = 'made-up-secret-for-error-check';
  assert.equal((await cli(t, root, ['set', 'discord.token'], `${value}\n`)).code, 0);
  await writeFile(path, `${await readFile(path, 'utf8')}\ninvalid = [`);
  const broken = await cli(t, root, ['list']);
  assert.equal(broken.code, 1);
  assert.match(broken.stderr, /invalid TOML/);
  assert.ok(!broken.stdout.includes(value) && !broken.stderr.includes(value), 'TOML diagnostic contains no value');
});

test('secret commands preserve other names through rotation and refuse symlinks on reads and writes', { timeout: 10_000 }, async t => {
  const { root } = await secretProject(t);
  await mkdir(join(root, '.cland'));
  for (const name of ['telegram.token', 'discord.token', 'speech.elevenlabs_key', 'speech.xai_key']) {
    const result = await cli(t, root, ['set', name], `123456:${'made_up_'.repeat(4)}\n`);
    assert.equal(result.code, 0, result.stderr);
  }
  const rotatedValue = 'made-up "quoted" \\opaque-value';
  const rotated = await cli(t, root, ['set', 'discord.token'], `${rotatedValue}\n`);
  assert.equal(rotated.code, 0, rotated.stderr);
  const persisted = storedToml(await readFile(join(root, '.cland/secrets.toml'), 'utf8'));
  assert.ok((persisted.discord as Record<string, unknown>).token === rotatedValue, 'rotation persists opaque punctuation');
  const list = await cli(t, root, ['list']);
  assert.equal(list.code, 0, list.stderr);
  assert.deepEqual(list.stdout.trim().split('\n').map(line => line.split(' ')[0]), [
    'telegram.token', 'discord.token', 'speech.elevenlabs_key', 'speech.xai_key',
  ]);
  const target = join(root, '.cland/secrets.toml');
  const original = await readFile(target, 'utf8');
  const nested = join(root, 'linked');
  await mkdir(join(nested, '.cland'), { recursive: true });
  await symlink(target, join(nested, '.cland/secrets.toml'));
  for (const args of [['list'], ['unset', 'discord.token'], ['set', 'discord.token']]) {
    const result = await cli(t, nested, [...args], 'made-up-blocked\n');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /secrets\.toml.*symlink/);
  }
  assert.ok(await readFile(target, 'utf8') === original, 'symlink target stays unchanged');
});
