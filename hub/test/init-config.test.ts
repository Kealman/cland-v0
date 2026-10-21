// T1: tracker level parsing and ladder validation are pure configuration rules.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuredLevels, Ladder } from '../src/tracker/kinds.ts';
import { defaultConfig, parseConfig, provisionConfig, renderConfig } from '../src/init/config.ts';
import { setConfigValue } from '../src/init/config-set.ts';
import { Report } from '../src/init/files.ts';

test('update keeps setup declines when refreshing the managed config', t => {
  const root = mkdtempSync(join(tmpdir(), 'cland-setup-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.cland'));
  const path = join(root, '.cland/config.toml');
  writeFileSync(path, '# managed by cland 0.1.0\n[setup]\ndeclined_installs = ["codex"]\ndeclined_accounts = ["claude-work"]\n');
  const report = new Report(root);
  provisionConfig(report, path, root);
  assert.equal(report.changes[0]?.action, 'updated');
  assert.deepEqual(parseConfig(readFileSync(path, 'utf8'), 'scratch').setup, { declinedInstalls: ['codex'], declinedAccounts: ['claude-work'] });
});

test('setup declines round-trip and reject unknown harness ids', () => {
  const config = parseConfig('[setup]\ndeclined_installs = ["codex", "opencode"]', 'scratch');
  assert.deepEqual(config.setup.declinedInstalls, ['codex', 'opencode']);
  config.setup.declinedAccounts = ['claude-work'];
  assert.deepEqual(parseConfig(renderConfig(config), 'scratch').setup, config.setup);
  for (const input of ['["unknown"]', '"codex"', '[1]']) {
    assert.throws(() => parseConfig(`[setup]\ndeclined_installs = ${input}`, 'scratch', {}, { strict: true }), /setup.declined_installs.*harness ids/);
  }
});

test('setup account declines reject malformed names', () => {
  for (const input of ['[1]', '"claude-work"', '["../work"]', '["Work"]']) {
    assert.throws(() => parseConfig(`[setup]\ndeclined_accounts = ${input}`, 'scratch'), /setup.declined_accounts.*account names/);
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
  assert.match(rendered, /# cland verify runs nothing until test or a tier command is set; use cland config set verification.test '<command>'\./);
  assert.match(rendered, /# prepare installs what check and test need; runs on the droplet builder and before every droplet run, never locally\.\n# Commands run under \/bin\/sh -c; prepare must be idempotent and write only ignored files\.\nprepare =/);
  assert.match(rendered, /# check is the fast gate; runs first and on the host before a droplet is made\.\ncheck =/);
  assert.match(rendered, /# test is the suite; its exit code decides the run\.\ntest =[^\n]*\n# test_unit/);
});

// T1: every command key's literal values pass through the public settings writer.
test('verification settings writer preserves command permutations verbatim', t => {
  const root = mkdtempSync(join(tmpdir(), 'cland-command-values-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.cland'));
  const path = join(root, '.cland/config.toml');
  writeFileSync(path, renderConfig(defaultConfig('Command values')));
  for (const [key, value] of [
    ['test', 'python3 -m unittest discover -s tests'],
    ['test_unit', '  python3 -m pytest "unit tests" && echo unit | cat  '],
    ['test_component', 'python3 -m pytest component'],
    ['test_integration', 'python3 -m pytest integration'],
    ['test_soak', 'python3 -m pytest soak'],
    ['check', 'python3 -m compileall . && printf "checked" | cat'],
    ['prepare', '  python3 -m pip install -r "dev requirements.txt"  '],
    ['test', 'true'],
    ['check', '"printf"'],
    ['prepare', "'printf'"],
  ] as const) {
    assert.equal(setConfigValue(root, path, `verification.${key}`, value, {}), value);
    assert.equal(parseConfig(readFileSync(path, 'utf8'), root).verification[key], value);
  }
});

test('verification commands default empty and refuse non-string values', () => {
  const absent = parseConfig('', 'scratch');
  for (const key of ['prepare', 'check', 'test', 'test_unit', 'test_component', 'test_integration', 'test_soak'] as const) {
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

test('marketing allow-list preserves configured exact paths and directory prefixes across updates', () => {
  const config = parseConfig('[publish]\nallow_paths = ["assets/**", "NOTICE"]', 'scratch');
  assert.deepEqual(config.publish.allowPaths, ['assets/**', 'NOTICE']);
  assert.deepEqual(parseConfig(renderConfig(config), 'scratch').publish.allowPaths, ['assets/**', 'NOTICE']);
  for (const path of ['/site/**', '../README.md', 'site/../code.ts', 'site/*', '**', '']) {
    assert.throws(() => parseConfig(`[publish]\nallow_paths = [${JSON.stringify(path)}]`, 'scratch'), /publish.allow_paths/);
  }
});

// T1: web settings validate and round-trip without opening listeners.
test('web port and development bundle settings round-trip and reject invalid values', t => {
  assert.deepEqual(parseConfig('', 'web').web, { port: 0, dist: '', bind: '127.0.0.1', origin: '' });
  const c = parseConfig('[web]\nport = 54321\ndist = "../shell bundle"', 'web');
  assert.deepEqual(c.web, { port: 54321, dist: '../shell bundle', bind: '127.0.0.1', origin: '' });
  assert.deepEqual(parseConfig(renderConfig(c), 'web').web, c.web);
  for (const port of [-1, 65536, 1.5, '1234', null]) {
    assert.throws(() => parseConfig(`[web]\nport = ${JSON.stringify(port)}`, 'web', {}, { strict: true }), /web.port|Invalid TOML/);
  }
  for (const dist of [1, false, ['bundle']]) {
    assert.throws(() => parseConfig(`[web]\ndist = ${JSON.stringify(dist)}`, 'web', {}, { strict: true }), /web.dist/);
  }
  const root = mkdtempSync(join(tmpdir(), 'cland-web-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.cland'));
  const path = join(root, '.cland/config.toml');
  writeFileSync(path, renderConfig(defaultConfig('web')));
  assert.equal(setConfigValue(root, path, 'web.port', 65535, {}), 65535);
  assert.equal(setConfigValue(root, path, 'web.dist', 'prototype/dist', {}), 'prototype/dist');
  assert.equal(setConfigValue(root, path, 'web.port', 0, {}), 0);
});


test('web bind and HTTPS tunnel origin validate and round-trip', () => {
  const c = parseConfig('[web]\nbind = "192.0.2.4"\norigin = "https://phone.example:8443"', 'web');
  assert.equal(c.web.bind, '192.0.2.4');
  assert.equal(c.web.origin, 'https://phone.example:8443');
  assert.deepEqual(parseConfig(renderConfig(c), 'web').web, c.web);
  for (const bind of ['', 'example.org', '127.0.0.1:80', ' 127.0.0.1', 4]) {
    assert.throws(() => parseConfig(`[web]\nbind = ${JSON.stringify(bind)}`, 'web'), /web.bind/);
  }
  for (const origin of ['http://phone.example', 'https://user@phone.example', 'https://phone.example/path', 'https://phone.example?x', 'https://phone.example#x', 4]) {
    assert.throws(() => parseConfig(`[web]\norigin = ${JSON.stringify(origin)}`, 'web'), /web.origin/);
  }
});
