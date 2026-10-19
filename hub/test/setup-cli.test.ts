// T2: setup's CLI boundary and actual command dispatch; probes are injected, no harness runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
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
  const prompter = scriptedPrompter([]);
  const machine: SetupMachine = {
    projectExists: async () => true,
    onPath: async () => true,
    harness: async id => ({ id, bin: '/tools/harness', version: [2, 0, 24], checks: [
      { name: id, verdict: 'ok', detail: '2.0.24' },
      { name: `${id} auth`, verdict: 'ok', detail: 'logged in' },
    ] }),
  };
  let stdout = '', stderr = '';
  const code = await runSetup(['--json', '--yes'], root, {}, { machine, prompter, stdinTTY: true, stdoutTTY: true, write: s => { stdout += s; }, narrate: s => { stderr += s; } });
  assert.equal(code, 0);
  const report = JSON.parse(stdout);
  assert.deepEqual(Object.keys(report), ['root', 'version', 'interactive', 'steps', 'summary', 'next']);
  assert.equal(report.root, realpathSync(root));
  assert.equal(report.version, VERSION);
  assert.equal(report.interactive, false);
  assert.equal(report.next, 'cland');
  assert.equal(report.steps.length, 7);
  assert.deepEqual(prompter.asked, []);
  assert.match(stderr, /without a terminal/);
  assert.match(stderr, /cland setup.*in a terminal/);
  assert.equal(stdout.trim().split('\n').length, 1);
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
  const sub = join(root, 'sub');
  await mkdir(sub);
  await assert.rejects(runSetup([], sub), /refuses target.*discovered project root/);
  await assert.rejects(runSetup(['--unknown'], root), /usage: cland setup/);
  await assert.rejects(runSetup(['.', '.'], root), /usage: cland setup/);
  let output = '';
  const code = await runSetup(['sub'], root, {}, { write: s => { output += s; } }).catch(e => { assert.match(e.message, /discovered project root/); return 1; });
  assert.equal(code, 1);
  assert.equal(output, '');
});

test('setup executable JSON reports open installers without running any harness', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  const result = await clandWithEnv(root, { CLAND_CLAUDE_BIN: '/missing/claude', CLAND_CODEX_BIN: '/missing/codex', CLAND_OPENCODE_BIN: '/missing/opencode' }, 'setup', root, '--json', '--yes');
  assert.equal(result.code, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.root, root);
  assert.equal(report.interactive, false);
  assert.equal(report.next, 'cland setup');
  assert.deepEqual(report.steps.map((s: { name: string; verdict: string }) => [s.name, s.verdict]), [
    ['project', 'ok'], ['claude-code', 'open'], ['codex', 'open'], ['opencode', 'open'],
  ]);
  assert.match(result.stderr, /without a terminal/);
});
