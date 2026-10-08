// The launcher's resolver run as a script prints the binary's path, also from a checkout whose path holds
// characters a file URL escapes (a space, `#`, `%`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NVIM_DIR } from '../bin/nvim-path.ts';

test('nvim-path.ts prints the binary from a path with a space, # and %', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'cland-path-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const nvimDir = join(base, 'a b#c%20d', 'nvim');
  await mkdir(join(nvimDir, 'bin'), { recursive: true });
  for (const f of ['NVIM_VERSION', 'NVIM_SHA256SUMS']) await copyFile(join(NVIM_DIR, f), join(nvimDir, f));
  await copyFile(join(NVIM_DIR, 'bin', 'nvim-path.ts'), join(nvimDir, 'bin', 'nvim-path.ts'));
  // CLAND_NVIM names the binary: any existing file will do, nothing is downloaded
  const fake = join(nvimDir, 'NVIM_VERSION');
  const out = spawnSync(process.execPath, [join(nvimDir, 'bin', 'nvim-path.ts')], { env: { ...process.env, CLAND_NVIM: fake }, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout, `${fake}\n`);
});
