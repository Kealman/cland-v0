// T1: the setup report on an in-memory machine; no tools, terminal or files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from '../src/setup/runner.ts';
import type { SetupMachine } from '../src/setup/types.ts';
import { scriptedPrompter } from './setup-prompter.ts';

const machine: SetupMachine = {
  projectExists: async () => true,
  onPath: async () => true,
  harness: async id => ({ id, bin: id === 'codex' ? null : `/tools/${id}`, version: id === 'codex' ? null : [2, 0, 24], checks: [
    { name: id, verdict: 'ok', detail: '2.0.24' },
    { name: `${id} auth`, verdict: id === 'claude-code' ? 'fail' : 'warn', detail: id === 'claude-code' ? 'not logged in' : 'no stored credentials', fix: id === 'claude-code' ? 'claude auth login' : 'opencode auth login --standalone' },
  ] }),
};

test('setup reports project, harnesses and installed logins in order without asking', async () => {
  const prompter = scriptedPrompter([]);
  const { report, code } = await setup({ root: '/project', env: {}, interactive: false, yes: true, prompter, machine });
  assert.equal(code, 1);
  assert.deepEqual(report.steps.map(s => [s.name, s.verdict]), [
    ['project', 'ok'], ['claude-code', 'ok'], ['codex', 'skip'], ['opencode', 'ok'],
    ['claude-code auth', 'open'], ['opencode auth', 'skip'],
  ]);
  assert.equal(report.steps[4]?.fix, 'run: claude auth login');
  assert.equal(report.next, 'cland setup');
  assert.equal(report.interactive, false);
  assert.deepEqual(prompter.asked, []);
});

test('no installed harness makes every installer open; one installed makes missing ones skip', async () => {
  for (const installed of [false, true]) {
    const { report, code } = await setup({ root: '/project', env: {}, interactive: false, yes: false, prompter: scriptedPrompter([]), machine: {
      ...machine,
      harness: async id => installed && id === 'claude-code' ? machine.harness(id) : { id, bin: null, version: null, checks: [] },
    } });
    assert.equal(code, 1);
    const missing = report.steps.filter(s => s.detail === 'not installed');
    assert.deepEqual(missing.map(s => [s.name, s.verdict, s.fix]), installed ? [
      ['codex', 'skip', 'run: npm install -g @openai/codex'],
      ['opencode', 'skip', 'run: curl -fsSL https://opencode.ai/v2/install | bash'],
    ] : [
      ['claude-code', 'open', 'run: curl -fsSL https://claude.ai/install.sh | bash'],
      ['codex', 'open', 'run: npm install -g @openai/codex'],
      ['opencode', 'open', 'run: curl -fsSL https://opencode.ai/v2/install | bash'],
    ]);
  }
});

test('a missing project stops setup before probing harnesses', async () => {
  const { report, code } = await setup({ root: '/empty', env: {}, interactive: false, yes: true, prompter: scriptedPrompter([]), machine: {
    ...machine, projectExists: async () => false,
    harness: async () => { throw new Error('must stop before probing'); },
  } });
  assert.equal(code, 1);
  assert.deepEqual(report.steps, [{ name: 'project', verdict: 'fail', detail: 'no .cland/ directory', fix: 'run cland init first' }]);
});

test('all steps ok exits zero and points to cland; installer folders explain PATH', async () => {
  const { report, code } = await setup({ root: '/project', env: {}, interactive: false, yes: false, prompter: scriptedPrompter([]), machine: {
    ...machine, onPath: async () => false,
    harness: async id => ({ id, bin: `/installer/${id}`, version: [2, 0, 24], checks: [
      { name: id, verdict: 'ok', detail: '2.0.24' },
      { name: `${id} auth`, verdict: 'ok', detail: 'logged in' },
    ] }),
  } });
  assert.equal(code, 0);
  assert.equal(report.next, 'cland');
  assert.deepEqual(report.summary, { ok: 7, done: 0, skip: 0, open: 0, fail: 0 });
  assert.ok(report.steps.every(s => s.verdict === 'ok'));
  assert.match(report.steps[1]!.detail, /not on your PATH yet: open a new shell/);
});

test('login probe-error hints preserve their instruction prose', async () => {
  const { report, code } = await setup({ root: '/project', env: {}, interactive: false, yes: false, prompter: scriptedPrompter([]), machine: {
    ...machine,
    harness: async id => ({ id, bin: '/tools/harness', version: [2, 0, 24], checks: [
      { name: id, verdict: 'ok', detail: '2.0.24' },
      { name: `${id} auth`, verdict: 'warn', detail: 'cannot check: no answer', fix: `run ${id} auth status by hand` },
    ] }),
  } });
  assert.equal(code, 1);
  assert.equal(report.steps[4]?.fix, 'run claude-code auth status by hand');
});
