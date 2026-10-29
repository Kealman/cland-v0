// T2: setup's CLI boundary and actual command dispatch; probes are injected, no harness runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { runSetup } from '../src/cli/setup.ts';
import { VERSION } from '../src/version.ts';
import { cland, clandWithEnv, tempProject } from './harness.ts';
import { scriptedPrompter } from './setup-prompter.ts';
import type { SetupMachine } from '../src/setup/types.ts';

test('setup JSON is one report on stdout with nonterminal narration on stderr', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/roles.toml'), '[aide.launch]\nharness = "claude-code"\n');
  const prompter = scriptedPrompter([]);
  const machine: SetupMachine = {
    requiredHarnesses: async () => ['claude-code', 'codex', 'opencode'],
    read: async () => null,
    write: async () => { throw new Error('unexpected write'); },
    run: async () => { throw new Error('unexpected installer'); },
    projectExists: async () => true,
    onPath: async () => true,
    harness: async id => ({ id, bin: '/tools/harness', version: [2, 0, 24], checks: [
      { name: id, verdict: 'ok', detail: '2.0.24' },
      { name: `${id} auth`, verdict: 'ok', detail: 'logged in' },
    ] }),
  };
  let stdout = '', stderr = '';
  const code = await runSetup(['--json', '--no-accounts'], root, { HOME: root }, { machine, prompter, stdinTTY: true, stdoutTTY: true, write: s => { stdout += s; }, narrate: s => { stderr += s; } });
  assert.equal(code, 1);
  const report = JSON.parse(stdout);
  assert.deepEqual(Object.keys(report), ['root', 'version', 'interactive', 'steps', 'summary', 'next']);
  assert.equal(report.root, realpathSync(root));
  assert.equal(report.version, VERSION);
  assert.equal(report.interactive, false);
  assert.equal(report.next, 'cland setup');
  assert.equal(report.steps.length, 15);
  assert.equal(report.steps.find((s: { name: string }) => s.name === 'accounts').verdict, 'skip');
  assert.equal(report.steps.at(-1).verdict, 'open');
  assert.deepEqual(prompter.asked, []);
  assert.match(stderr, /without a terminal/);
  assert.match(stderr, /cland setup.*in a terminal/);
  assert.equal(stdout.trim().split('\n').length, 1);
});

test('setup --install codex runs without a terminal or question', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/roles.toml'), '[aide.launch]\nharness = "claude-code"\n');
  let runs = 0;
  const code = await runSetup(['--install', 'codex'], root, { HOME: root }, {
    stdinTTY: false, stdoutTTY: false, write: () => {}, prompter: scriptedPrompter([]),
    machine: {
      requiredHarnesses: async () => [],
      projectExists: async () => true, onPath: async () => true, read: async () => null,
      write: async () => { throw new Error('unexpected write'); },
      run: async command => { assert.match(command, /chatgpt.com\/codex\/install.sh/); runs++; return 0; },
      harness: async id => ({ id, bin: null, version: null, checks: [] }),
    },
  });
  assert.equal(code, 1); // the installer ran, but the injected re-check still reports missing
  assert.equal(runs, 1);
  await assert.rejects(runSetup(['--install', 'unknown'], root), /harness/);
  await assert.rejects(runSetup(['--install'], root), /harness/);
});

test('setup JSON explicit installer reserves stdout for its report', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/roles.toml'), '[aide.launch]\nharness = "claude-code"\n');
  let stdout = '', stderr = '', runs = 0;
  await runSetup(['--json', '--install', 'codex'], root, { HOME: root }, {
    write: text => { stdout += text; }, narrate: text => { stderr += text; }, prompter: scriptedPrompter([]),
    machine: {
      requiredHarnesses: async () => [],
      projectExists: async () => true, onPath: async () => true, read: async () => null,
      write: async () => { throw new Error('unexpected write'); },
      run: async (_command, options) => {
        assert.equal(options?.stdout, 'stderr');
        stderr += 'installer output\n';
        runs++;
        return 0;
      },
      harness: async id => ({ id, bin: null, version: null, checks: [] }),
    },
  });
  assert.equal(runs, 1);
  assert.equal(JSON.parse(stdout).interactive, false);
  assert.equal(stdout.trim().split('\n').length, 1);
  assert.match(stderr, /installer output/);
});

test('setup refuses HOME through the CLI and its usage appears in help', async () => {
  const home = await cland(process.cwd(), 'setup', homedir());
  assert.equal(home.code, 1);
  assert.match(home.stderr, /cland setup refuses HOME/);
  const help = await cland(process.cwd(), '--help');
  assert.equal(help.code, 0);
  assert.match(help.stdout, /setup \[dir\]/);
});

test('setup keeps the explicit root and rejects discovered parents or extra flags', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/roles.toml'), '[aide.launch]\nharness = "claude-code"\n');
  const sub = join(root, 'sub');
  await mkdir(sub);
  await assert.rejects(runSetup([], sub), /refuses target.*discovered project root/);
  await assert.rejects(runSetup(['--unknown'], root), /usage: cland setup/);
  await assert.rejects(runSetup(['.', '.'], root), /usage: cland setup/);
  for (const args of [['--harness'], ['--harness', 'other'], ['--harness', '--yes'], ['--harness', 'codex', '--harness', 'opencode']]) {
    await assert.rejects(runSetup(args, root), /usage: cland setup/);
  }
  let output = '';
  const code = await runSetup(['sub'], root, { HOME: root }, { write: s => { output += s; } }).catch(e => { assert.match(e.message, /discovered project root/); return 1; });
  assert.equal(code, 1);
  assert.equal(output, '');
});

test('setup executable JSON reports open installers without running any harness', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/roles.toml'), '[aide.launch]\nharness = "claude-code"\n');
  const result = await clandWithEnv(root, { CLAND_CLAUDE_BIN: '/missing/claude', CLAND_CODEX_BIN: '/missing/codex', CLAND_OPENCODE_BIN: '/missing/opencode' }, 'setup', root, '--json', '--yes', '--no-aide');
  assert.equal(result.code, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.root, root);
  assert.equal(report.interactive, false);
  assert.equal(report.next, 'cland setup');
  assert.deepEqual(report.steps.map((s: { name: string; verdict: string }) => [s.name, s.verdict]), [
    ['project', 'ok'], ['claude-code', 'open'], ['codex', 'open'], ['opencode', 'open'], ['accounts', 'ok'], ['favourite', 'open'], ['trust', 'skip'], ['hub', 'skip'], ['remote telegram', 'skip'], ['remote discord', 'skip'], ['speech', 'open'], ['aide', 'skip'],
  ]);
  assert.match(result.stderr, /without a terminal/);
});

test('setup retains the CLI root spelling for Codex trust', async t => {
  const root = await tempProject(t);
  const alias = join(root, 'alias');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/secrets.toml'), '[speech]\nelevenlabs_key="made_up_existing_speech_key"\n', { mode: 0o600 });
  await writeFile(join(root, '.cland/roles.toml'), `[aide.launch]\nharness = "codex" # the human's favourite, chosen in cland setup\n`);
  await mkdir(join(root, '.codex'));
  await symlink(root, alias);
  const file = join(root, '.codex/config.toml');
  const canonical = `[projects.${JSON.stringify(root)}]\ntrust_level = "trusted"\n`;
  await writeFile(file, canonical);
  const machine: SetupMachine = {
    requiredHarnesses: async () => ['codex'],
    read: async () => null, write: async () => { throw new Error('unexpected write'); }, run: async () => { throw new Error('unexpected installer'); },
    projectExists: async () => true, onPath: async () => true,
    harness: async id => ({ id, bin: id === 'codex' ? '/tools/codex' : null, version: [1, 0, 0], checks: [
      { name: id, verdict: 'ok', detail: '1.0.0' }, { name: `${id} auth`, verdict: 'ok', detail: 'logged in' },
    ] }),
  };
  let output = '';
  const io = { machine, prompter: scriptedPrompter([]), write: (s: string) => { output += s; }, narrate: () => {} };
  assert.equal(await runSetup([alias, '--json', '--no-aide'], root, { HOME: root }, io), 1);
  assert.equal(JSON.parse(output).steps.find((row: { name: string }) => row.name === 'trust').verdict, 'open');
  await writeFile(file, canonical + `[projects.${JSON.stringify(alias)}]\ntrust_level = "trusted"\n`);
  output = '';
  assert.equal(await runSetup([alias, '--json', '--no-aide'], root, { HOME: root }, io), 0);
  assert.equal(JSON.parse(output).steps.find((row: { name: string }) => row.name === 'trust').verdict, 'ok');
});
