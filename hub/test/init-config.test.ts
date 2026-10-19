// T1: tracker level parsing and ladder validation are pure configuration rules.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuredLevels, Ladder } from '../src/tracker/kinds.ts';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';

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

test('merge queue defaults off and round-trips an explicitly enabled boolean', () => {
  assert.deepEqual(defaultConfig('scratch').merge, { queue: false, batch: 3, batchWaitMs: 600_000 });
  assert.deepEqual(parseConfig('', 'scratch').merge, { queue: false, batch: 3, batchWaitMs: 600_000 });
  const configured = parseConfig('[merge]\nqueue = true\n', 'scratch');
  assert.deepEqual(configured.merge, { queue: true, batch: 3, batchWaitMs: 600_000 });
  assert.deepEqual(parseConfig(renderConfig(configured), 'scratch').merge, { queue: true, batch: 3, batchWaitMs: 600_000 });
  for (const invalid of ['"true"', '1', '[]']) {
    assert.throws(() => parseConfig(`[merge]\nqueue = ${invalid}`, 'scratch', {}, { strict: true }), /merge.queue must be a boolean/);
  }
});


test('this repository enables the merge batch queue while new projects keep it off', () => {
  const source = readFileSync(new URL('../../.cland/config.toml', import.meta.url), 'utf8');
  assert.equal(parseConfig(source, 'repository', {}).merge.queue, true);
  assert.equal(defaultConfig('new-project').merge.queue, false);
});
