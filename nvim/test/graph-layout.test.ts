// Pure Lua unit cases, run in the pinned LuaJIT host without a UI or hub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip } from './harness.ts';

const nvim = await nvimOrSkip();
const cases = ['cycles', 'reduction', 'layers', 'ordering', 'positions', 'tracks', 'tray', 'canvas', 'controls', 'orientations', 'dense', 't19', 'sizing'];
for (const name of cases) {
  test(`graph layout: ${name}`, { skip: 'skip' in nvim ? nvim.skip : false }, () => {
    if (!('bin' in nvim)) return;
    const run = spawnSync(nvim.bin, ['--clean', '--headless', '-l', fileURLToPath(new URL('./graph-layout.lua', import.meta.url)), name], {
      encoding: 'utf8', timeout: 20_000,
    });
    assert.equal(run.error, undefined);
    assert.equal(run.status, 0, run.stderr + run.stdout);
    assert.match(run.stdout, new RegExp(`passed: ${name}`));
  });
}
