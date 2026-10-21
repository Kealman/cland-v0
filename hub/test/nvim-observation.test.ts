// T1: force an observation to finish at/past its deadline without real time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { eventually } from '../../nvim/test/fixture.ts';

for (const elapsed of [100, 101]) test(`Neovim observation rejects a ready state returned after ${elapsed} ms at a 100 ms deadline`, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  await assert.rejects(eventually('card width', async () => {
    t.mock.timers.tick(elapsed);
    return { width: 72, drawn: 'R-1' };
  }, 100), /card width: not within 100 ms.*72.*R-1/);
});

test('Neovim observation retains the last failed rendered state at its deadline', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  await assert.rejects(eventually('card width', async () => {
    t.mock.timers.tick(100);
    throw new Error('observed width=50 selected=R-1');
  }, 100), /not within 100 ms.*observed width=50 selected=R-1/);
});

test('Neovim observation accepts the ready state before its deadline', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  assert.deepEqual(await eventually('card width', async () => {
    t.mock.timers.tick(99);
    return { width: 72 };
  }, 100), { width: 72 });
});
