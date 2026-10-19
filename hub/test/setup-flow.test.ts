// T1: setup actions and reports on an in-memory machine; no processes, terminal or disk writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from '../src/setup/runner.ts';
import type { SetupMachine } from '../src/setup/types.ts';
import { scriptedPrompter } from './setup-prompter.ts';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { rolesTemplate } from '../src/roles/template.ts';
import { CHOSEN, setRoleKey } from '../src/roles/editor.ts';

const machine: SetupMachine = {
  read: async () => null,
  write: async () => { throw new Error('unexpected write'); },
  run: async () => { throw new Error('unexpected installer'); },
  projectExists: async () => true,
  onPath: async () => true,
  harness: async id => ({ id, bin: id === 'codex' ? null : `/tools/${id}`, version: id === 'codex' ? null : [2, 0, 24], checks: [
    { name: id, verdict: 'ok', detail: '2.0.24' },
    { name: `${id} auth`, verdict: id === 'claude-code' ? 'fail' : 'warn', detail: id === 'claude-code' ? 'not logged in' : 'no stored credentials', fix: id === 'claude-code' ? 'claude auth login' : 'opencode auth login --standalone' },
  ] }),
};

test('installing Codex uses the terminal runner and its re-check decides done or fail', async () => {
  for (const installed of [true, false]) {
    let ran = false;
    const prompter = scriptedPrompter([{ kind: 'confirm', question: 'Install Codex now?', answer: true }]);
    const output: string[] = [];
    const env = { PATH: '/tools' };
    const { report } = await setup({ root: '/project', env, interactive: true, yes: false, prompter: {
      ...prompter,
      confirm: async (question, def) => {
        assert.match(output.join(''), /chatgpt.com\/codex\/install.sh/);
        assert.equal(def, false);
        return prompter.confirm(question, def);
      },
    }, narrate: s => output.push(s), machine: {
      ...machine,
      run: async command => {
        assert.equal(command, 'curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh');
        assert.match(output.join(''), /chatgpt.com\/codex\/install.sh/);
        ran = true;
        return 7;
      },
      harness: async (id, fresh) => id === 'codex' && ran && installed ? {
        id, bin: '/home/.local/bin/codex', version: [1, 2, 3], checks: [
          { name: id, verdict: 'ok', detail: '1.2.3' }, { name: `${id} auth`, verdict: 'ok', detail: 'logged in' },
        ],
      } : machine.harness(id, fresh),
      onPath: async id => id !== 'codex',
    } });
    assert.equal(ran, true);
    const line = report.steps.find(s => s.name === 'codex')!;
    assert.equal(line.verdict, installed ? 'done' : 'fail');
    if (installed) {
      assert.match(line.detail, /1.2.3.*open a new shell/);
      assert.match(env.PATH, /\/home\/\.local\/bin/);
      assert.ok(report.steps.some(s => s.name === 'codex auth'));
    } else {
      assert.match(line.detail, /exit code 7/);
      assert.match(line.fix!, /chatgpt.com\/codex\/install.sh/);
    }
    assert.deepEqual(prompter.left(), []);
  }
});

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

test('a declined installer persists across setup runs until an explicit install', async () => {
  let config = renderConfig(defaultConfig('project'));
  let runs = 0;
  const m: SetupMachine = {
    ...machine,
    read: async path => path === 'config.toml' ? config : null,
    write: async (path, text, expected) => {
      assert.equal(path, 'config.toml');
      assert.equal(expected, config);
      config = text;
    },
    run: async () => { runs++; return 0; },
  };
  const first = scriptedPrompter([{ kind: 'confirm', question: 'Install Codex now?', answer: false }]);
  await setup({ root: '/project', env: {}, interactive: true, yes: false, prompter: first, machine: m });
  assert.deepEqual(parseConfig(config, 'project').setup.declinedInstalls, ['codex']);
  const second = scriptedPrompter([]);
  const { report } = await setup({ root: '/project', env: {}, interactive: true, yes: false, prompter: second, machine: m });
  const line = report.steps.find(s => s.name === 'codex')!;
  assert.equal(line.verdict, 'skip');
  assert.match(line.detail, /declined earlier; cland setup --install codex/);
  assert.equal(runs, 0);
  // An explicit install clears the decline even if its re-check still fails.
  await setup({ root: '/project', env: {}, interactive: false, yes: false, install: 'codex', prompter: second, machine: m });
  assert.equal(runs, 1);
  assert.deepEqual(parseConfig(config, 'project').setup.declinedInstalls, []);
});

test('nonterminal detection and --yes never install or record a decline', async () => {
  for (const interactive of [false, true]) {
    let runs = 0, writes = 0;
    const config = renderConfig(defaultConfig('project'));
    await setup({ root: '/project', env: {}, interactive, yes: interactive, prompter: scriptedPrompter([]), machine: {
      ...machine,
      read: async () => config,
      run: async () => { runs++; return 0; },
      write: async () => { writes++; },
    } });
    assert.equal(runs, 0);
    assert.equal(writes, 0);
  }
});

test('install rebuilds only the exact roles template for the installed set', async () => {
  for (const kind of ['template', 'edited', 'favourite']) {
    const template = rolesTemplate(['claude-code']);
    const original = kind === 'favourite' ? setRoleKey(template, 'aide', 'launch', 'harness', 'claude-code', CHOSEN)
      : template + (kind === 'edited' ? '\n# human edit\n' : '');
    let roles = original, installed = false;
    const { report } = await setup({ root: '/project', env: {}, interactive: false, yes: false, install: 'codex', prompter: scriptedPrompter([]), machine: {
      ...machine,
      read: async path => path === 'roles.toml' ? roles : null,
      write: async (path, text, expected) => { assert.equal(path, 'roles.toml'); assert.equal(expected, roles); roles = text; },
      run: async () => { installed = true; return 0; },
      harness: async id => id === 'claude-code' || (id === 'codex' && installed) ? {
        id, bin: `/tools/${id}`, version: [1, 2, 3], checks: [
          { name: id, verdict: 'ok', detail: '1.2.3' }, { name: `${id} auth`, verdict: 'ok', detail: 'logged in' },
        ],
      } : { id, bin: null, version: null, checks: [] },
    } });
    assert.equal(roles, kind === 'template' ? rolesTemplate(['claude-code', 'codex']) : original);
    const detail = report.steps.find(s => s.name === 'codex')!.detail;
    if (kind === 'template') assert.match(detail, /roles.toml rebuilt for claude-code, codex/);
    else assert.doesNotMatch(detail, /rebuilt/);
  }
});

test('the first installed harness makes missing alternatives optional in the final report', async () => {
  let installed = false;
  const { report, code } = await setup({ root: '/project', env: {}, interactive: false, yes: false, install: 'codex', prompter: scriptedPrompter([]), machine: {
    ...machine,
    run: async () => { installed = true; return 0; },
    harness: async id => id === 'codex' && installed ? {
      id, bin: '/tools/codex', version: [1, 2, 3], checks: [
        { name: id, verdict: 'ok', detail: '1.2.3' }, { name: `${id} auth`, verdict: 'ok', detail: 'logged in' },
      ],
    } : { id, bin: null, version: null, checks: [] },
  } });
  assert.equal(code, 0);
  assert.deepEqual(report.steps.map(s => [s.name, s.verdict]), [
    ['project', 'ok'], ['claude-code', 'skip'], ['codex', 'done'], ['opencode', 'skip'], ['codex auth', 'ok'],
  ]);
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
      ['codex', 'skip', 'run: curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh'],
      ['opencode', 'skip', 'run: curl -fsSL https://opencode.ai/v2/install | bash'],
    ] : [
      ['claude-code', 'open', 'run: curl -fsSL https://claude.ai/install.sh | bash'],
      ['codex', 'open', 'run: curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh'],
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
