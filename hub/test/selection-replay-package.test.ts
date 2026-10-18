// T1: package replay uses recorded Git responses, with no processes or real time.
import assert from 'node:assert/strict';
import test from 'node:test';
import { replayPackage } from './selection-replay-package.ts';

// git log lists the newest landing first.
const landings = [
  '55555555\tFifth landing (T-5)',
  '44444444\tFourth landing (T-4)',
  '33333333\tThird landing (T-3)',
  '22222222\tSecond landing (T-2)',
  '11111111\tFirst landing (T-1)',
];

test('package replay --count 3 selects exactly the latest three of five landings', () => {
  const output: string[] = [];
  const diffs: string[] = [];
  replayPackage(['--count', '3'], landings, {
    range: 'base..head', imports: [], log: line => output.push(line),
    git: (...args) => { diffs.push(args.at(-1)!); return 'hub/src/example.ts\0'; },
  });
  assert.deepEqual(output.filter(line => /^\| \d/.test(line)), [
    '| 55555555 | T-5 | hub-only | all paths outside nvim/ |',
    '| 44444444 | T-4 | hub-only | all paths outside nvim/ |',
    '| 33333333 | T-3 | hub-only | all paths outside nvim/ |',
  ]);
  assert.deepEqual(diffs, ['55555555', '44444444', '33333333']);
  assert.match(output[0]!, /3 task landings/);
  assert.equal(output.at(-1), 'Split: full 0 / hub-only 3 / nvim-only 0');
});

test('package replay refuses an incomplete landing window before reading diffs', () => {
  for (const commits of [[], landings.slice(0, 2)]) {
    const output: string[] = [];
    assert.throws(() => replayPackage(['--count', '3'], commits, {
      range: 'base..head', imports: [], log: line => output.push(line),
      git: () => assert.fail('incomplete replay must not read diffs'),
    }), new RegExp(`need 3 task landings, found ${commits.length}`));
    assert.deepEqual(output, []);
  }
});
