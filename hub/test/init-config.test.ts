// T1: tracker level parsing and ladder validation are pure configuration rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuredLevels, Ladder } from '../src/tracker/kinds.ts';
import { parseConfig } from '../src/init/config.ts';

test('tracker config accepts peer levels and rejects malformed, duplicate and colliding kind names', () => {
  for (const levels of [['release', 'epic'], [['release', 'category'], 'epic']]) {
    assert.deepEqual(parseConfig(`[tracker]\nlevels = ${JSON.stringify(levels)}`, 'scratch').tracker.levels, levels);
    const ladder = new Ladder(levels);
    assert.equal(ladder.top, 'release');
    assert.deepEqual(ladder.flat, ['release', 'epic']);
  }
  for (const levels of [['release', ['category', 'release']], [['release', 'task']], [['release', 'question']], [['release', 'spec']], [['release', 'map']], [[]], [1], [[['release']]], ['Release']]) {
    assert.throws(() => configuredLevels(levels), /levels/);
  }
  assert.throws(() => configuredLevels([['release', 'roadmap'], 'epic']), /release and roadmap both use R/);
  assert.throws(() => configuredLevels(['release', ['epic', 'effort']]), /epic and effort both use E/);
});
