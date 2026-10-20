// T1: installed-bundle diagnosis with source files and deterministic mtimes; no hub or native probes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { webSources } from '../src/web-bundle.ts';
import { checkWebBundle } from '../src/doctor/web.ts';

test('doctor compares the installed web stamp and diagnoses missing, changed and newer sources', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-web-stamp-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['package.json', 'package-lock.json', 'hub/src/web-bundle.ts', 'web/package.json', 'web/index.html', 'web/tsconfig.json', 'web/vite.config.ts', 'web/build.ts', 'web/check-assets.ts', 'web/src/Shell.tsx', 'web/public/fonts/font.woff2', 'web/dist/index.html']) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), path);
    await utimes(join(root, path), 1, 1);
  }
  const stampPath = join(root, 'web/dist/build-stamp.json');
  const stamp = { version: 1, sources: (await webSources(root)).digest, builtAt: 2000 };
  assert.match((await checkWebBundle(root)).detail, /missing/);
  await writeFile(stampPath, JSON.stringify(stamp));
  assert.equal((await checkWebBundle(root)).verdict, 'ok');
  const source = join(root, 'web/src/Shell.tsx');
  await utimes(source, 3, 3);
  const newer = await checkWebBundle(root);
  assert.equal(newer.verdict, 'warn');
  assert.match(newer.detail, /stale.*newer/);
  assert.match(newer.fix ?? '', /npm run build/);
  await writeFile(source, 'changed');
  await utimes(source, 1, 1);
  assert.match((await checkWebBundle(root)).detail, /stale.*changed/);
  await writeFile(source, 'web/src/Shell.tsx');
  await utimes(source, 1, 1);
  assert.equal((await checkWebBundle(root)).verdict, 'ok');
  await writeFile(join(root, 'web/src/New.tsx'), 'new');
  assert.match((await checkWebBundle(root)).detail, /stale/);
  await rm(join(root, 'web/src/New.tsx'));
  await rm(join(root, 'web/public/fonts/font.woff2'));
  assert.match((await checkWebBundle(root)).detail, /stale/);
  await writeFile(stampPath, '{broken');
  assert.equal((await checkWebBundle(root)).verdict, 'warn');
  await writeFile(stampPath, JSON.stringify({ ...stamp, builtAt: 1e100 }));
  assert.equal((await checkWebBundle(root)).verdict, 'warn');
});
