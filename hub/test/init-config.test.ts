// T1: tracker level parsing and ladder validation are pure configuration rules.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuredLevels, Ladder } from '../src/tracker/kinds.ts';
import { defaultConfig, parseConfig, provisionConfig, renderConfig } from '../src/init/config.ts';
import { Report } from '../src/init/files.ts';

test('update keeps setup declines when refreshing the managed config', t => {
  const root = mkdtempSync(join(tmpdir(), 'cland-setup-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.cland'));
  const path = join(root, '.cland/config.toml');
  writeFileSync(path, '# managed by cland 0.1.0\n[setup]\ndeclined_installs = ["codex"]\n');
  const report = new Report(root);
  provisionConfig(report, path, root);
  assert.equal(report.changes[0]?.action, 'updated');
  assert.deepEqual(parseConfig(readFileSync(path, 'utf8'), 'scratch').setup.declinedInstalls, ['codex']);
});

test('setup declines round-trip and reject unknown harness ids', () => {
  const config = parseConfig('[setup]\ndeclined_installs = ["codex", "opencode"]', 'scratch');
  assert.deepEqual(config.setup.declinedInstalls, ['codex', 'opencode']);
  assert.deepEqual(parseConfig(renderConfig(config), 'scratch').setup, config.setup);
  for (const input of ['["unknown"]', '"codex"', '[1]']) {
    assert.throws(() => parseConfig(`[setup]\ndeclined_installs = ${input}`, 'scratch', {}, { strict: true }), /setup.declined_installs.*harness ids/);
  }
});

// T1: verification command parsing and rendering need no hub or process.
test('verification commands retain literal shell syntax through the config template', () => {
  const commands = {
    prepare: '  python3 -m pip install -r "dev requirements.txt"  ',
    check: "python3 -m compileall . && printf 'checked' | cat",
    test: 'python3 -m unittest discover -s tests',
  };
  const config = parseConfig(`[verification]\n${Object.entries(commands).map(([key, value]) => `${key} = ${JSON.stringify(value)}`).join('\n')}`, 'scratch');
  for (const [key, value] of Object.entries(commands)) assert.equal(Reflect.get(config.verification, key), value);
  const rendered = renderConfig(config);
  assert.deepEqual(parseConfig(rendered, 'scratch'), config);
  assert.match(rendered, /# cland verify runs nothing until test is set; use cland config set verification.test '<command>'\./);
  assert.match(rendered, /# prepare installs what check and test need; runs on a droplet in the prepared image and before every run, never locally\.\nprepare =/);
  assert.match(rendered, /# check is the fast gate; runs first and on the host before a droplet is made\.\ncheck =/);
  assert.match(rendered, /# test is the suite; its exit code decides the run\.\ntest =[^\n]*\nexecutor =/);
});

test('verification commands default empty and refuse non-string values', () => {
  const absent = parseConfig('', 'scratch');
  for (const key of ['prepare', 'check', 'test'] as const) {
    assert.equal(absent.verification[key], '');
    for (const value of ['3', 'false', '[]', '{}']) {
      assert.throws(() => parseConfig(`[verification]\n${key} = ${value}`, 'scratch'), {
        message: `verification.${key} must be a command string`,
      });
    }
  }
});

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
  assert.deepEqual(defaultConfig('scratch').merge, { queue: false, batch: 3, batchWaitMs: 600_000, batchTiers: ['T1', 'T3'] });
  assert.deepEqual(parseConfig('', 'scratch').merge, { queue: false, batch: 3, batchWaitMs: 600_000, batchTiers: ['T1', 'T3'] });
  const configured = parseConfig('[merge]\nqueue = true\n', 'scratch');
  assert.deepEqual(configured.merge, { queue: true, batch: 3, batchWaitMs: 600_000, batchTiers: ['T1', 'T3'] });
  assert.deepEqual(parseConfig(renderConfig(configured), 'scratch').merge, { queue: true, batch: 3, batchWaitMs: 600_000, batchTiers: ['T1', 'T3'] });
  for (const invalid of ['"true"', '1', '[]']) {
    assert.throws(() => parseConfig(`[merge]\nqueue = ${invalid}`, 'scratch', {}, { strict: true }), /merge.queue must be a boolean/);
  }
});


test('this repository enables the merge batch queue while new projects keep it off', () => {
  const source = readFileSync(new URL('../../.cland/config.toml', import.meta.url), 'utf8');
  assert.equal(parseConfig(source, 'repository', {}).merge.queue, true);
  assert.equal(defaultConfig('new-project').merge.queue, false);
  const config = parseConfig(source, 'repository', {});
  assert.deepEqual(config.merge.batchTiers, ['T1']);
  assert.equal(config.verification.devT3Every, '2h');
});
