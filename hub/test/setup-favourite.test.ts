// T1: favourite selection and source-preserving roles writes; no processes or real time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSetup } from '../src/cli/setup.ts';
import { favourite } from '../src/setup/steps/favourite.ts';
import { projectSetUp } from '../src/roles/editor.ts';
import { parseRoles } from '../src/roles/config.ts';
import { Cancelled } from '../src/setup/prompter.ts';
import type { SetupOptions } from '../src/setup/types.ts';
import type { HarnessId } from '../src/doctor/ranges.ts';
import { scriptedPrompter } from './setup-prompter.ts';

const before = '# human settings\r\n[aide.launch] # keep table comment\r\nharness = "claude-code"\r\nmodel = "custom" # keep model comment\r\neffort = "low"\r\n\r\n[reviewer.launch]\r\nharness = "codex"\r\nmodel = "review-model"\r\n';

async function fixture(t: test.TestContext, installed: HarnessId[] = ['claude-code', 'codex', 'opencode']) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-favourite-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.cland'));
  const path = join(root, '.cland', 'roles.toml');
  await writeFile(path, before);
  await writeFile(join(root, '.claude.json'), JSON.stringify({ projects: { [root]: { hasTrustDialogAccepted: true } } }));
  await mkdir(join(root, '.codex'));
  await writeFile(join(root, '.codex/config.toml'), `[projects.${JSON.stringify(root)}]\ntrust_level = "trusted"\n`);
  const options: SetupOptions = { root, env: { HOME: root }, interactive: true, yes: false, prompter: scriptedPrompter([]), machine: {
    requiredHarnesses: async () => [],
    read: async () => null,
    write: async () => { throw new Error('unexpected machine write'); },
    run: async () => { throw new Error('unexpected installer'); },
    projectExists: async () => true, onPath: async () => true,
    harness: async id => ({ id, bin: installed.includes(id) ? `/tools/${id}` : null, version: null, checks: [
      { name: id, verdict: 'ok', detail: 'installed' },
      { name: `${id} auth`, verdict: 'ok', detail: 'logged in' },
    ] }),
  } };
  return { options, path };
}

test('choosing Codex changes only the three aide launch lines and marks setup complete', async t => {
  const { options, path } = await fixture(t);
  options.prompter = scriptedPrompter([{ kind: 'choose', question: /harness/, answer: 'codex' }]);
  const lines = await favourite(options);
  assert.equal(lines[0]?.verdict, 'done');
  assert.equal(await readFile(path, 'utf8'), '# human settings\r\n[aide.launch] # keep table comment\r\nharness = "codex" # the human\'s favourite, chosen in cland setup\r\nmodel = "" # keep model comment\r\neffort = "high"\r\n\r\n[reviewer.launch]\r\nharness = "codex"\r\nmodel = "review-model"\r\n');
  assert.equal(await projectSetUp(options.root), true);
});

test('a marked installed favourite reruns ok without asking or changing bytes', async t => {
  const { options, path } = await fixture(t);
  await favourite({ ...options, harness: 'codex' });
  const chosen = await readFile(path, 'utf8');
  assert.deepEqual(await favourite(options), [{ name: 'favourite', verdict: 'ok', detail: 'codex' }]);
  assert.equal(await readFile(path, 'utf8'), chosen);
});

test('a single installed harness is chosen without a question with its own launch defaults', async t => {
  const { options, path } = await fixture(t);
  for (const [id, effort] of [['codex', 'high'], ['claude-code', 'max'], ['opencode', null]] as const) {
    const single = await fixture(t, [id]);
    // Start on another harness to prove the reset on every transition.
    // A valid previous harness may simply be absent from this machine.
    await writeFile(single.path, `[aide.launch]\nharness = "${id === 'codex' ? 'opencode' : 'codex'}"\nmodel = "custom"\neffort = "custom"\n`);
    assert.equal((await favourite(single.options))[0]?.verdict, 'done');
    const launch = parseRoles(await readFile(single.path, 'utf8')).get('aide')!.launch;
    assert.deepEqual([launch.harness, launch.model, launch.effort], [id, null, effort]);
  }
  // Marking the existing harness preserves the human's model and effort.
  assert.equal((await favourite({ ...options, harness: 'claude-code' }))[0]?.verdict, 'done');
  const launch = parseRoles(await readFile(path, 'utf8')).get('aide')!.launch;
  assert.deepEqual([launch.model, launch.effort], ['custom', 'low']);
});

test('nonterminal detection and unavailable explicit choices leave roles untouched', async t => {
  const { options, path } = await fixture(t, ['claude-code', 'codex']);
  const [missing] = await favourite({ ...options, harness: 'opencode' });
  assert.equal(missing?.verdict, 'fail');
  assert.match(missing!.detail, /opencode.*not installed.*claude-code, codex/);
  const [open] = await favourite({ ...options, interactive: false });
  assert.equal(open?.verdict, 'open');
  assert.match(open!.fix!, /--harness.*--yes/);
  assert.equal(await readFile(path, 'utf8'), before);
  const single = await fixture(t, ['codex']);
  assert.equal((await favourite({ ...single.options, interactive: false }))[0]?.verdict, 'open');
  assert.equal(await readFile(single.path, 'utf8'), before);
});

test('yes uses the first installed choice and explicit harness overrides a marked favourite', async t => {
  const { options, path } = await fixture(t, ['codex', 'opencode']);
  assert.equal((await favourite({ ...options, interactive: false, yes: true }))[0]?.detail, 'codex');
  assert.equal((await favourite({ ...options, interactive: false, harness: 'opencode' }))[0]?.detail, 'opencode');
  assert.equal(parseRoles(await readFile(path, 'utf8')).get('aide')!.launch.harness, 'opencode');
});

test('the choice lists installed harnesses in order and labels signed-out choices', async t => {
  const { options } = await fixture(t);
  const probe = options.machine.harness;
  options.machine.harness = async id => {
    const found = await probe(id);
    if (id === 'codex') found.checks[1]!.verdict = 'fail';
    return found;
  };
  options.prompter = { ...options.prompter, async choose(_question, choices, def) {
    assert.equal(def, 'claude-code');
    assert.deepEqual(choices, [{ value: 'claude-code', label: 'Claude Code' }, { value: 'codex', label: 'Codex (signed out)' }, { value: 'opencode', label: 'OpenCode' }]);
    return def;
  } };
  assert.equal((await favourite(options))[0]?.verdict, 'done');
});

test('invalid roles fail with repair guidance without changing the file', async t => {
  const { options, path } = await fixture(t);
  for (const invalid of ['[aide.launch]\nharness = [', '[aide.launch]\nharness = "codex"\neffort = 3\n', '[aide.launch]\nharness = "unknown"\n']) {
    await writeFile(path, invalid);
    const [line] = await favourite(options);
    assert.equal(line?.verdict, 'fail');
    assert.match(line!.fix!, /repair it \(cland doctor names the line\)/);
    assert.equal(await readFile(path, 'utf8'), invalid);
  }
});

test('ending input at the favourite question cancels setup without a write', async t => {
  const { options, path } = await fixture(t);
  options.prompter = { ...options.prompter, async choose() { throw new Cancelled('input ended'); } };
  await assert.rejects(favourite(options), Cancelled);
  assert.equal(await readFile(path, 'utf8'), before);
});

test('setup routes the explicit harness flag to the favourite step without a terminal', async t => {
  const { options, path } = await fixture(t, ['claude-code', 'codex']);
  const { root, machine } = options;
  for (const [harness, verdict] of [['codex', 'done'], ['opencode', 'fail']] as const) {
    let stdout = '';
    const code = await runSetup(['--harness', harness, root, '--json'], root, options.env, { machine, prompter: scriptedPrompter([]), stdinTTY: false, write: s => { stdout += s; }, narrate: () => {} });
    assert.equal(code, verdict === 'done' ? 0 : 1);
    assert.equal(JSON.parse(stdout).steps.find((s: { name: string }) => s.name === 'favourite').verdict, verdict);
  }
  assert.match(await readFile(path, 'utf8'), /harness = "codex" # the human's favourite, chosen in cland setup/);
});

test('an explicit install can supply the favourite selected in the same JSON setup run', async t => {
  const installed: HarnessId[] = [];
  const { options, path } = await fixture(t, installed);
  let stdout = '', stderr = '';
  options.machine.run = async (command, output) => {
    assert.match(command, /chatgpt.com\/codex\/install.sh/);
    assert.equal(output?.stdout, 'stderr');
    installed.push('codex');
    return 0;
  };
  const code = await runSetup(['--json', '--harness', 'codex', '--install', 'codex'], options.root, options.env, {
    machine: options.machine, prompter: scriptedPrompter([]), stdinTTY: false,
    write: s => { stdout += s; }, narrate: s => { stderr += s; },
  });
  assert.equal(code, 0);
  const report = JSON.parse(stdout);
  assert.equal(report.steps.find((s: { name: string }) => s.name === 'codex').verdict, 'done');
  assert.deepEqual(report.steps.find((s: { name: string }) => s.name === 'favourite'), { name: 'favourite', verdict: 'done', detail: 'codex' });
  assert.deepEqual(report.steps.slice(-2).map((s: { name: string }) => s.name), ['favourite', 'trust']);
  assert.equal(report.steps.at(-1).verdict, 'ok');
  assert.equal(parseRoles(await readFile(path, 'utf8')).get('aide')!.launch.harness, 'codex');
  assert.equal(await projectSetUp(options.root), true);
  assert.match(stderr, /chatgpt.com\/codex\/install.sh/);
  assert.equal(stdout.trim().split('\n').length, 1);
});

test('an explicit favourite leaves missing trust open without yes', async t => {
  const { options, path } = await fixture(t, ['codex']);
  const config = join(options.root, '.codex/config.toml');
  await rm(config);
  let stdout = '';
  const code = await runSetup(['--json', '--harness', 'codex'], options.root, options.env, {
    machine: options.machine, prompter: scriptedPrompter([]), stdinTTY: false,
    write: s => { stdout += s; }, narrate: () => {},
  });
  assert.equal(code, 1);
  assert.deepEqual(JSON.parse(stdout).steps.slice(-2).map((s: { name: string; verdict: string }) => [s.name, s.verdict]), [['favourite', 'done'], ['trust', 'open']]);
  assert.equal(parseRoles(await readFile(path, 'utf8')).get('aide')!.launch.harness, 'codex');
  await assert.rejects(readFile(config), { code: 'ENOENT' });
});

