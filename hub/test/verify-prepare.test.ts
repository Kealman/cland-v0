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
  await writeFile(join(root, 'nvim/bin/nvim-path.ts'), "require('fs').appendFileSync('calls', 'seed\\n');\n");
  await writeFile(join(root, 'bin/npm'), '#!/bin/sh\nprintf "npm %s\\n" "$*" >> calls\n', { mode: 0o700 });
  const key = { lock: createHash('sha256').update('lock').digest('hex'), nvim: { tag: 'v0.12.5' } };
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
  await writeFile(join(env.HOME!, '.cland-image.json'), JSON.stringify(key));
  assert.equal((await run()).stdout, 'dependencies match snapshot\nNeovim pin matches snapshot\n');
  assert.equal(await readFile(join(root, 'calls'), 'utf8'), '');
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
