// T3: prepare CLI propagates dependency child exit status; native PATH resolution and seed processes prove the install contract.
import { fixtureEnvironment } from './fixture-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tempProject } from './harness.ts';

const exec = promisify(execFile);
test('prepare uses installed snapshot inputs and rebuilds changed or missing installs', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, 'nvim/bin'), { recursive: true });
  await mkdir(join(root, 'node_modules'));
  await mkdir(join(root, 'bin'));
  await writeFile(join(root, 'package-lock.json'), 'lock');
  await writeFile(join(root, 'nvim/NVIM_VERSION'), 'v0.12.5\n');
  await writeFile(join(root, 'nvim/NVIM_SHA256SUMS'), `${'a'.repeat(64)}  nvim-linux-x86_64.tar.gz\n`);
  await writeFile(join(root, 'nvim/bin/nvim-path.ts'), "require('fs').appendFileSync('calls', 'seed\\n');\n");
  await writeFile(join(root, 'bin/npm'), '#!/bin/sh\nprintf "npm %s\\n" "$*" >> calls\n', { mode: 0o700 });
  const key = { lock: createHash('sha256').update('lock').digest('hex'), provision: 'a'.repeat(64) };
  const env = fixtureEnvironment(root, process.env, { PATH: `${root}/bin:${process.env.PATH}` });
  await mkdir(env.HOME!, { recursive: true });
  const run = (keyValue = JSON.stringify(key)) => exec(process.execPath, [resolve('hub/bin/verify-prepare.ts')], { cwd: root, env: fixtureEnvironment(root, process.env, { PATH: `${root}/bin:${process.env.PATH}`, CLAND_PREPARE_KEY: keyValue }) });
  // A matching checkout on a fresh builder is not yet an installed snapshot.
  assert.match((await run()).stdout, /dependencies changed: npm ci[\s\S]*Neovim pin changed: seed/);
  assert.equal(await readFile(join(root, 'calls'), 'utf8'), 'npm ci\nseed\n');
  await writeFile(join(root, 'calls'), '');
  assert.equal((await run()).stdout, 'dependencies match snapshot\nNeovim pin matches snapshot\n');
  assert.equal(await readFile(join(root, 'calls'), 'utf8'), '');
  await rm(join(root, 'node_modules/.cland-prepare-key'));
  await writeFile(join(env.HOME!, '.cland-image.json'), JSON.stringify({ ...key, nvim: { tag: 'v0.12.5', digest: 'a'.repeat(64) } }));
  assert.equal((await run()).stdout, 'dependencies match snapshot\nNeovim pin matches snapshot\n');
  assert.equal(await readFile(join(root, 'calls'), 'utf8'), '');
  // The hook receipt is independent of the executor key and npm's install receipt.
  await rm(join(root, 'node_modules/.cland-prepare-key'), { force: true });
  await writeFile(join(env.HOME!, '.cland-image.json'), JSON.stringify(key));
  await mkdir(join(root, '.cache/nvim'), { recursive: true });
  const hookReceipt = join(root, '.cache/nvim/.cland-installed.json');
  await writeFile(hookReceipt, JSON.stringify({ tag: 'v0.12.5', digest: 'a'.repeat(64) }));
  assert.match((await run()).stdout, /Neovim pin matches snapshot/);
  await rm(join(root, 'node_modules/.cland-prepare-key'));
  await writeFile(hookReceipt, JSON.stringify({ tag: 'v0.12.4', digest: 'b'.repeat(64) }));
  assert.match((await run()).stdout, /Neovim pin changed: seed/);
  await rm(join(root, 'node_modules/.cland-prepare-key'));
  await writeFile(hookReceipt, JSON.stringify({ tag: 'v0.12.5', digest: 'b'.repeat(64) }));
  // Use the real resolver fast path against a planted old executable, not a seed logger.
  const { assetName } = await import('../../nvim/bin/nvim-path.ts');
  const asset = assetName(); assert.ok(asset);
  const cache = join(root, '.cache/nvim/v0.12.5', asset.replace(/\.tar\.gz$/, ''), 'bin');
  await mkdir(cache, { recursive: true });
  const cached = join(cache, 'nvim');
  await writeFile(cached, '#!/bin/sh\necho old-cache\n', { mode: 0o700 });
  const seed = await readFile(join(root, 'nvim/bin/nvim-path.ts'), 'utf8');
  await writeFile(join(root, 'nvim/bin/nvim-path.ts'), await readFile(resolve('nvim/bin/nvim-path.ts')));
  await writeFile(join(root, 'calls'), '');
  await assert.rejects(run(), (error: { code?: number; stderr?: string }) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr ?? '', /Neovim same-tag digest mismatch/);
    return true;
  });
  assert.equal(await readFile(cached, 'utf8'), '#!/bin/sh\necho old-cache\n');
  await assert.rejects(readFile(join(root, 'node_modules/.cland-prepare-key')), { code: 'ENOENT' });
  assert.equal(await readFile(join(root, 'calls'), 'utf8'), '');
  // A marker for another tag must not hide the hook's conflict at the requested tag.
  const priorMarker = JSON.stringify({ lock: key.lock, nvim: { tag: 'v0.12.4', digest: 'b'.repeat(64) } });
  await writeFile(join(root, 'node_modules/.cland-prepare-key'), priorMarker);
  await assert.rejects(run(), /Neovim same-tag digest mismatch/);
  assert.equal(await readFile(join(root, 'node_modules/.cland-prepare-key'), 'utf8'), priorMarker);
  assert.equal(await readFile(cached, 'utf8'), '#!/bin/sh\necho old-cache\n');
  await rm(join(root, 'node_modules/.cland-prepare-key'));
  await writeFile(join(root, 'nvim/bin/nvim-path.ts'), seed);
  await writeFile(hookReceipt, JSON.stringify({ tag: 'v0.12.5', digest: 'a'.repeat(64) }));
  await run();
  // Older project markers recorded only tag; the legacy image still proves its digest.
  await writeFile(join(root, 'node_modules/.cland-prepare-key'), JSON.stringify({ lock: key.lock, nvim: { tag: 'v0.12.5' } }));
  await rm(hookReceipt);
  await writeFile(join(env.HOME!, '.cland-image.json'), JSON.stringify({ ...key, nvim: { tag: 'v0.12.5', digest: 'a'.repeat(64) } }));
  assert.match((await run()).stdout, /Neovim pin matches snapshot/);
  await writeFile(join(root, 'calls'), '');
  await writeFile(join(root, 'package-lock.json'), 'moved lock');
  assert.match((await run()).stdout, /dependencies changed: npm ci\nNeovim pin matches snapshot/);
  assert.equal(await readFile(join(root, 'calls'), 'utf8'), 'npm ci\n');
  await writeFile(join(root, 'calls'), '');
  await writeFile(join(root, 'nvim/NVIM_VERSION'), 'v0.12.6\n');
  assert.match((await run()).stdout, /Neovim pin changed: seed/);
  assert.equal(await readFile(join(root, 'calls'), 'utf8'), 'npm ci\nseed\n');
  await writeFile(join(root, 'calls'), '');
  await run('');
  assert.equal(await readFile(join(root, 'calls'), 'utf8'), 'npm ci\nseed\n');
  await rm(join(root, 'node_modules/.cland-prepare-key'));
  await writeFile(join(root, 'bin/npm'), '#!/bin/sh\necho npm-failed >&2\nexit 19\n', { mode: 0o700 });
  await assert.rejects(run(''), (error: { code?: number; stderr?: string }) => {
    assert.equal(error.code, 19);
    assert.match(error.stderr ?? '', /npm-failed/);
    return true;
  });
  await assert.rejects(readFile(join(root, 'node_modules/.cland-prepare-key')), { code: 'ENOENT' });
});
