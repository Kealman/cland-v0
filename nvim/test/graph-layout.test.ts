// Pure Lua unit cases, run in the pinned LuaJIT host without a UI or hub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip } from './harness.ts';

const nvim = await nvimOrSkip();
const cases = ['cycles', 'reduction', 'layers', 'ordering', 'positions', 'tracks', 'tray', 'canvas', 'controls', 'orientations', 'dense', 't19', 'sizing'];
for (const name of cases) {
  test(`graph layout: ${name}`, { skip: 'skip' in nvim ? nvim.skip : false }, async t => {
    if (!('bin' in nvim)) return;
    const root = await tempProject(t);
    await mkdir(join(root, 'nvim/lua/cland'), { recursive: true });
    await mkdir(join(root, 'nvim/test/fixtures'), { recursive: true });
    await copyFile(fileURLToPath(new URL('../lua/cland/graph_layout.lua', import.meta.url)), join(root, 'nvim/lua/cland/graph_layout.lua'));
    await copyFile(fileURLToPath(new URL('./fixtures/graph-t19.json', import.meta.url)), join(root, 'nvim/test/fixtures/graph-t19.json'));
    const run = spawnSync(nvim.bin, ['--clean', '--headless', '-l', fileURLToPath(new URL('./graph-layout.lua', import.meta.url)), name], {
      cwd: root, env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 20_000,
    });
    assert.equal(run.error, undefined);
    assert.equal(run.status, 0, run.stderr + run.stdout);
    assert.match(run.stdout, new RegExp(`passed: ${name}`));
  });
}
