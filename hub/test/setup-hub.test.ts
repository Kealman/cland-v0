// T1: setup's hub/Aide policy through an injected client; no sockets, processes or real time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hub } from '../src/setup/steps/hub.ts';
import { aide } from '../src/setup/steps/aide.ts';
import type { SetupHub } from '../src/setup/hub.ts';
import type { SetupOptions } from '../src/setup/types.ts';
import { kindOfFiles } from '../src/setup/project-kind.ts';
import { scriptedPrompter } from './setup-prompter.ts';

function fixture(t: test.TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'setup-hub-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.cland'));
  writeFileSync(join(root, '.cland/roles.toml'), '[aide.launch]\nharness = "codex"\n');
  const calls: unknown[] = [];
  const client: SetupHub = {
    running: async () => null,
    start: async () => { calls.push('start'); return { pid: 42 }; },
    session: async () => null,
    launch: async request => { calls.push(request); },
    resume: async name => { calls.push(['resume', name]); },
  };
  const options: SetupOptions = { root, env: {}, interactive: true, yes: false, hub: client, kind: async () => 'empty', prompter: scriptedPrompter([]), machine: {
    requiredHarnesses: async () => ['codex'],
    projectExists: async () => true, read: async () => null, write: async () => {}, run: async () => 0, onPath: async () => true,
    harness: async id => ({ id, bin: id === 'opencode' ? null : `/tools/${id}`, version: null, checks: [] }),
  } };
  return { root, options, client, calls };
}

test('starts the hub then launches the favourite with the exact empty-project onboarding brief', async t => {
  const { options, calls } = fixture(t);
  assert.deepEqual(await hub(options), [{ name: 'hub', verdict: 'done', detail: 'pid 42' }]);
  const [line] = await aide(options);
  assert.equal(line?.verdict, 'done');
  assert.match(line!.detail, /Run the onboarding skill; project: empty; harnesses: claude-code, codex; human's harness: codex/);
  assert.deepEqual(calls, ['start', { name: 'aide-1', role: 'aide', harness: 'codex', brief: "Run the onboarding skill; project: empty; harnesses: claude-code, codex; human's harness: codex" }]);
});

test('a running Aide is reused; a stopped Aide resumes its conversation', async t => {
  const { options, client, calls } = fixture(t);
  client.running = async () => ({ pid: 7 });
  client.session = async () => ({ status: 'running' });
  assert.equal((await hub(options))[0]?.verdict, 'ok');
  assert.equal((await aide(options))[0]?.verdict, 'ok');
  assert.deepEqual(calls, []);
  client.session = async () => ({ status: 'stopped' });
  assert.deepEqual(await aide(options), [{ name: 'aide', verdict: 'done', detail: 'aide-1 resumed' }]);
  assert.deepEqual(calls, [['resume', 'aide-1']]);
});

test('no-aide skips both steps; nonterminal policy permits only a yes hub start', async t => {
  const { options, calls } = fixture(t);
  for (const interactive of [false, true]) {
    const skip = { ...options, interactive, noAide: true };
    assert.deepEqual([...(await hub(skip)), ...(await aide(skip))].map(s => [s.verdict, s.detail]), [
      ['skip', 'cland starts the hub with the workbench'], ['skip', 'cland starts the hub with the workbench'],
    ]);
  }
  assert.deepEqual(calls, []);
  const nonterminal = { ...options, interactive: false };
  assert.equal((await hub(nonterminal))[0]?.verdict, 'open');
  assert.deepEqual(await aide(nonterminal), [{ name: 'aide', verdict: 'open', detail: 'the Aide needs a terminal', fix: 'cland setup in a terminal' }]);
  assert.deepEqual(calls, []);
  assert.equal((await hub({ ...nonterminal, yes: true }))[0]?.verdict, 'done');
  assert.equal((await aide({ ...nonterminal, yes: true }))[0]?.verdict, 'open');
  assert.deepEqual(calls, ['start']);
});

test('failures retain the startup log tail or equivalent session recovery command', async t => {
  const { options, client } = fixture(t);
  client.start = async () => { throw new Error('hub.log: startup failed\nlast log line'); };
  assert.deepEqual(await hub(options), [{ name: 'hub', verdict: 'fail', detail: 'hub.log: startup failed\nlast log line', fix: 'cland hub start' }]);
  client.launch = async () => { throw new Error('forbidden: session.launch'); };
  const [launch] = await aide(options);
  assert.equal(launch?.verdict, 'fail');
  assert.match(launch!.detail, /forbidden/);
  assert.match(launch!.fix!, /^cland session launch aide-1 --role aide --harness codex --brief /);
  client.session = async () => ({ status: 'stopped' });
  client.resume = async () => { throw new Error('conversation unavailable'); };
  const [resume] = await aide(options);
  assert.equal(resume?.verdict, 'fail');
  assert.equal(resume?.fix, 'cland session resume aide-1 --relaunch');
});

test('the ordered setup flow reruns without starting another hub or Aide', async t => {
  const { options, client, calls, root } = fixture(t);
  options.env.HOME = root;
  options.yes = true;
  writeFileSync(join(root, '.claude.json'), JSON.stringify({ projects: { [root]: { hasTrustDialogAccepted: true } } }));
  mkdirSync(join(root, '.codex'));
  writeFileSync(join(root, '.codex/config.toml'), `[projects.${JSON.stringify(root)}]\ntrust_level = "trusted"\n`);
  const { setup } = await import('../src/setup/runner.ts');
  const probe = options.machine.harness;
  options.machine.harness = async id => ({ ...await probe(id), checks: [
    { name: id, verdict: 'ok', detail: 'installed' }, { name: `${id} auth`, verdict: 'ok', detail: 'logged in' },
  ] });
  const first = await setup({ ...options, harness: 'codex' });
  assert.equal(first.code, 0, JSON.stringify(first.report.steps));
  assert.deepEqual(first.report.steps.slice(-2).map(s => [s.name, s.verdict]), [['hub', 'done'], ['aide', 'done']]);
  assert.deepEqual(calls, ['start', { name: 'aide-1', role: 'aide', harness: 'codex', brief: "Run the onboarding skill; project: empty; harnesses: claude-code, codex; human's harness: codex" }]);
  client.running = async () => ({ pid: 42 });
  client.session = async () => ({ status: 'running' });
  calls.length = 0;
  const second = await setup(options);
  assert.equal(second.code, 0);
  assert.deepEqual(second.report.steps.slice(-2).map(s => [s.name, s.verdict]), [['hub', 'ok'], ['aide', 'ok']]);
  assert.deepEqual(calls, []);
});


test('project-kind classification excludes cland paths and macOS metadata', () => {
  const own = ['AGENTS.md', 'CLAUDE.md', '.cland/config.toml', '.agents/skills/onboarding/SKILL.md', '.claude/settings.json', 'docs/agents/tests.md', '.DS_Store'];
  assert.equal(kindOfFiles(own), 'empty');
  for (const file of ['app.ts', 'docs/design.md', 'AGENTS.md.backup', '.cland-other/config', '.gitignore']) {
    assert.equal(kindOfFiles([...own, file]), 'existing', file);
  }
});
