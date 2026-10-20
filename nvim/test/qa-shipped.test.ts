// T4: the complete shipped headless QA walk, with real CLI, Neovim and fixture hubs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip } from './harness.ts';
import { qa } from './qa-runner.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const SHIPPED = fileURLToPath(new URL('../../qa/cases/', import.meta.url));

for (const name of ['GRAPH-001', 'ITEMS-002', 'PANELS-005', 'PANELS-006', 'PANELS-007', 'PANELS-008', 'PANELS-009', 'PANELS-010', 'PANELS-011', 'PANELS-012', 'PANELS-013', 'PANELS-014', 'PANELS-015', 'PANELS-016', 'PANELS-017', 'PANELS-018', 'THREAD-001', 'THREAD-002', 'THREAD-003', 'THREAD-004', 'THREAD-005', 'THREAD-006', 'THREAD-007', 'THREAD-008', 'THREAD-009', 'THREAD-010']) {
  test(`${name} passes through the headless QA runner`, { skip }, async (t) => {
    const run = await qa(t, [`${SHIPPED}${name}.lua`]);
    assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
    assert.equal(run.code, 0);
  });
}

test('EXPLORER-002 passes through the headless QA runner', { skip }, async t => {
  const run = await qa(t, [`${SHIPPED}EXPLORER-002.lua`]);
  assert.equal(run.line.result, 'PASS', JSON.stringify(run.line));
  assert.equal(run.code, 0);
});
