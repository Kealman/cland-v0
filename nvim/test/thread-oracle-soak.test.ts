// T4: extended differential oracle through stub-hub.ts; four seeds and 25 renders keep all phases and comparisons.
import test from 'node:test';
import { nvimOrSkip } from './stub-client.ts';
import { runThreadOracle } from './thread-oracle.ts';
import { threadSeedPlan } from './thread-seed-plan.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

test('extended generated thread oracle retains four seeds and 25 differential renders', { skip }, async t => {
  await runThreadOracle(t, bin, threadSeedPlan(true));
});
