// T3: the managed ignore contract with native Git, not a simulated ignore parser.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GITIGNORE } from '../src/project.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { launchSecretCli, secretCli, secretGit, secretProject } from './secrets-fixture.ts';

test('managed gitignore keeps secrets out of native git status with an unignored positive control', { timeout: 15_000 }, async t => {
  const { root } = await secretProject(t);
  mkdirSync(join(root, '.cland'));
  writeFileSync(join(root, '.cland/.gitignore'), GITIGNORE);
  writeFileSync(join(root, '.cland/secrets.toml'), '[telegram]\n', { mode: 0o600 });
  const git = (args: string[]) => secretGit(t, root, args);
  await git(['init']);
  const status = await git(['status', '--porcelain', '--untracked-files=all']);
  assert.match(status, /\.cland\/\.gitignore/);
  assert.doesNotMatch(status, /secrets\.toml/);
  assert.match(await git(['check-ignore', '.cland/secrets.toml']), /\.cland\/secrets\.toml/);
});

test('secret writes refuse unprotected custom ignores before reading stdin and preserve protected custom bytes', { timeout: 15_000 }, async t => {
  const { root } = await secretProject(t);
  mkdirSync(join(root, '.cland'));
  const ignore = join(root, '.cland/.gitignore');
  const path = join(root, '.cland/secrets.toml');
  const custom = '# owned by the project\nrun/\n';
  writeFileSync(ignore, custom);
  writeFileSync(path, '[telegram]\n', { mode: 0o600 });
  await secretGit(t, root, ['init']);
  assert.match(await secretGit(t, root, ['status', '--porcelain', '--untracked-files=all']), /\.cland\/secrets\.toml/);
  // Deliberately leave stdin open: refusal must complete before requesting the value.
  const refused = await launchSecretCli(t, root, ['set', 'discord.token']).result;
  assert.equal(refused.code, 1, 'unprotected custom ignore refuses before reading stdin');
  assert.equal(refused.incomplete, null);
  assert.match(refused.stderr, /secrets\.toml.*final.*ignore rule/);
  assert.equal(readFileSync(ignore, 'utf8'), custom);
  assert.equal(readFileSync(path, 'utf8'), '[telegram]\n');
  const negated = `${custom}/secrets.toml\n!secrets.toml\n`;
  writeFileSync(ignore, negated);
  assert.match(await secretGit(t, root, ['status', '--porcelain', '--untracked-files=all']), /\.cland\/secrets\.toml/);
  const negationRefused = await launchSecretCli(t, root, ['set', 'discord.token']).result;
  assert.equal(negationRefused.code, 1);
  assert.equal(negationRefused.incomplete, null);
  assert.equal(readFileSync(ignore, 'utf8'), negated);
  const protectedCustom = `${custom}/secrets.toml\n# a retained comment\n`;
  writeFileSync(ignore, protectedCustom);
  const saved = await secretCli(t, root, ['set', 'discord.token'], 'made-up-custom-secret\n');
  assert.equal(saved.code, 0, saved.stderr);
  assert.equal(readFileSync(ignore, 'utf8'), protectedCustom);
  const status = await secretGit(t, root, ['status', '--porcelain', '--untracked-files=all']);
  assert.match(status, /\.cland\/\.gitignore/);
  assert.doesNotMatch(status, /secrets\.toml/);
  assert.match(await secretGit(t, root, ['check-ignore', '.cland/secrets.toml']), /\.cland\/secrets\.toml/);
});

test('cancelled secret CLI joins native close and incomplete output before owned root removal', { timeout: 15_000 }, async t => {
  const { root, remove } = await secretProject(t);
  const dir = join(root, '.cland');
  mkdirSync(dir);
  const ready = Promise.withResolvers<void>();
  const timer = setTimeout(() => ready.reject(new Error('secret CLI did not persist its ignore protection before cancellation')), 5000); // lint-allow-wall-clock: bound the exact persisted-ignore receipt before cancelling the native CLI
  const watcher = watch(dir, () => {
    try { if (readFileSync(join(dir, '.gitignore'), 'utf8') === GITIGNORE) ready.resolve(); }
    catch { /* wait for the completed write receipt */ }
  });
  beforeDirectories(t, () => { watcher.close(); clearTimeout(timer); });
  const controller = new AbortController();
  // Observer is armed before launch; this CLI then waits for its still-open stdin.
  const command = launchSecretCli(t, root, ['set', 'discord.token'], { signal: controller.signal });
  let closed = false;
  let settled = false;
  void command.closed.then(() => { closed = true; });
  void command.result.then(() => { settled = true; });
  await ready.promise;
  clearTimeout(timer);
  watcher.close();
  controller.abort(new Error('intentional secret CLI cancellation'));
  await command.stopAndDrain();
  assert.equal(closed, true, 'native close was observed before the stop barrier returned');
  assert.equal(settled, true, 'output result was drained before the stop barrier returned');
  const result = await command.result;
  assert.equal(result.code, null);
  assert.equal(result.signal, 'SIGTERM');
  assert.equal(result.incomplete, 'ABORT_ERR');
  assert.equal(existsSync(root), true, 'root remains until all command receipts settle');
  await remove();
  assert.equal(existsSync(root), false);
});
