// `cland open`: the hub first, then the Neovim launcher on the project's root, from anywhere inside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, killDaemon, readDiscovery, tempProject } from './harness.ts';

test('cland open from a subdirectory starts the project hub, then the launcher on the project root', async (t) => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'));
  const sub = join(root, 'src', 'deep');
  await mkdir(sub, { recursive: true });
  const record = join(root, 'launched.txt');
  const launcher = join(root, 'fake-launcher');
  await writeFile(launcher, `#!/bin/sh\nprintf '%s\\n' "$PWD" "$@" > ${JSON.stringify(record)}\nexit 3\n`);
  await chmod(launcher, 0o755);

  const r = await clandWithEnv(sub, { CLAND_LAUNCHER: launcher }, 'open', '.', '+Cland');
  const d = await readDiscovery(root).catch(() => null);
  if (d) t.after(() => killDaemon(d.pid));
  assert.equal(r.code, 3, `the launcher's exit code is cland's: ${r.stderr}`);
  assert.ok(d, 'the hub runs');
  assert.deepEqual((await readFile(record, 'utf8')).trim().split('\n'), [root, root, '+Cland']);

  // a second open finds the hub running and starts no other
  const again = await clandWithEnv(root, { CLAND_LAUNCHER: launcher }, 'open');
  assert.equal(again.code, 3);
  assert.equal((await readDiscovery(root)).pid, d?.pid);
});
