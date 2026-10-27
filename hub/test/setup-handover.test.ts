// T1: final setup handover with injected terminal, prompter and hub; no child or socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clandCommand, handOver, type HandoverOptions } from '../src/setup/handover.ts';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scriptedPrompter } from './setup-prompter.ts';
import { Cancelled } from '../src/setup/prompter.ts';
import { runSetup } from '../src/cli/setup.ts';
import type { SetupHub } from '../src/setup/hub.ts';
import type { SetupMachine } from '../src/setup/types.ts';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function fixture() {
  const output: string[] = [];
  const calls: unknown[] = [];
  const options: HandoverOptions = {
    root: '/project', env: { PATH: '/tools', CLAND_LAUNCHER: '/tools/workbench' },
    interactive: true, aideRunning: true, cland: { command: 'cland', note: null },
    prompter: scriptedPrompter([]), say: s => output.push(s),
    run: async (...args) => { calls.push(args); return 0; },
    hub: { attach: async name => { calls.push(['attach', name]); return 'claude attach conversation'; } },
  };
  return { options, output, calls };
}

test('each interactive handover opens the workbench on aide-1 before one closing line', async () => {
  const { options, output, calls } = fixture();
  for (let run = 0; run < 2; run++) {
    output.length = 0;
    calls.length = 0;
    await handOver(options);
    assert.deepEqual(calls, [['/tools/workbench', ['/project'], {
      cwd: '/project', env: { PATH: '/tools', CLAND_LAUNCHER: '/tools/workbench', CLAND_OPEN_SESSION: 'aide-1' },
    }]]);
    assert.equal(options.env.CLAND_OPEN_SESSION, undefined);
    assert.equal(output.filter(s => s.includes('session stop')).length, 1);
    assert.equal(output.at(-1), "aide-1 may still be running: x on its row in the workbench's sessions panel stops it, or cland session stop aide-1\n");
  }
});

test('--attach prints the hub command before pausing and only runs it after Enter', async () => {
  const { options, output, calls } = fixture();
  options.attach = true;
  options.prompter = { ...options.prompter, pause: async message => {
    assert.equal(message, 'Press Enter to attach (Ctrl+D: not now)');
    assert.match(output.join(''), /claude attach conversation/);
    assert.match(output.join(''), /←.*agent view/);
    assert.match(output.join(''), /Ctrl\+Z suspends setup/);
    assert.deepEqual(calls, [['attach', 'aide-1']]);
  } };
  await handOver(options);
  assert.deepEqual(calls, [['attach', 'aide-1'], ['sh', ['-c', 'claude attach conversation'], { cwd: '/project', env: options.env }]]);
  assert.equal(output.filter(s => s.includes('session stop')).length, 1);
  assert.match(output.at(-1)!, /cland session stop aide-1; open the workbench: cland\n$/);
});

test('Ctrl+D at the attach pause leaves the Aide running without a terminal child', async () => {
  const { options, output, calls } = fixture();
  options.attach = true;
  options.prompter = { ...options.prompter, pause: async () => { throw new Cancelled('input ended'); } };
  await handOver(options);
  assert.deepEqual(calls, [['attach', 'aide-1']]);
  assert.match(output.at(-1)!, /cland session stop aide-1; open the workbench: cland\n$/);
});

test('a failed launcher prints the attach alternative before the closing line', async () => {
  for (const throws of [false, true]) {
    const { options, output } = fixture();
    options.run = async () => { if (throws) throw new Error('launcher missing'); return 1; };
    await handOver(options);
    assert.match(output.at(-2)!, /cland setup --attach attaches aide-1 in this terminal instead/);
    assert.match(output.at(-1)!, /cland session stop aide-1\n$/);
  }
});

test('without an override the handover uses the pinned workbench launcher', async () => {
  const { options, calls } = fixture();
  delete options.env.CLAND_LAUNCHER;
  await handOver(options);
  assert.equal((calls[0] as unknown[])[0], fileURLToPath(new URL('../../nvim/bin/cland-nvim', import.meta.url)));
});

test('an attach failure still prints the stop and workbench hints', async () => {
  for (const failure of ['hub', 'spawn', 'exit']) {
    const { options, output } = fixture();
    options.attach = true;
    options.prompter = scriptedPrompter([{ kind: 'pause', question: /Press Enter/ }]);
    options.hub.attach = async () => {
      if (failure === 'hub') throw new Error('hub unavailable');
      return 'claude attach conversation';
    };
    options.run = async () => { if (failure === 'spawn') throw new Error('shell unavailable'); return 1; };
    await handOver(options);
    assert.match(output.at(-2)!, failure === 'exit' ? /attach ended with exit 1/ : /cannot attach aide-1 here:/);
    assert.match(output.at(-1)!, /cland session stop aide-1; open the workbench: cland\n$/);
  }
});

test('no terminal, no-aide or no running Aide ends with the open hint without handover', async () => {
  for (const policy of [{ interactive: false }, { noAide: true }, { aideRunning: false }]) {
    for (const attach of [false, true]) {
      const { options, output, calls } = fixture();
      await handOver({ ...options, ...policy, attach });
      assert.deepEqual(calls, []);
      assert.deepEqual(output, ['open the workbench: cland\n']);
    }
  }
});

test('closing commands use this entry when PATH names another checkout or has no cland', async t => {
  const root = mkdtempSync(join(tmpdir(), 'setup-command-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const entry = join(root, 'this checkout.ts');
  writeFileSync(entry, '', { mode: 0o755 });
  for (const match of [true, false]) {
    const bin = join(root, String(match));
    mkdirSync(bin);
    const other = join(root, 'other.ts');
    writeFileSync(other, '', { mode: 0o755 });
    symlinkSync(match ? entry : other, join(bin, 'cland'));
    const selected = clandCommand({ PATH: bin }, entry);
    if (match) assert.deepEqual(selected, { command: 'cland', note: null });
    else {
      assert.equal(selected.command, `node '${entry}'`);
      assert.match(selected.note!, /cland on your PATH is another checkout/);
      for (const attach of [false, true]) {
        const { options, output } = fixture();
        await handOver({ ...options, attach, cland: selected, prompter: scriptedPrompter([{ kind: 'pause', question: /Press Enter/ }]) });
        assert.ok(output.at(-1)!.includes(`${selected.command} session stop aide-1`));
        assert.ok(output.at(-1)!.includes(selected.note!));
        if (attach) assert.ok(output.at(-1)!.includes(`open the workbench: ${selected.command}`));
      }
    }
  }
  assert.deepEqual(clandCommand({ PATH: '' }, entry), { command: `node '${entry}'`, note: 'cland is not on your PATH' });
});

test('setup CLI hands over after the summary on each run, including --attach', async t => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'setup-handover-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.cland'));
  const roles = '[aide.launch]\nharness = "opencode" # the human\'s favourite, chosen in cland setup\n';
  writeFileSync(join(root, '.cland/roles.toml'), roles);
  writeFileSync(join(root, '.claude.json'), JSON.stringify({ projects: { [root]: { hasTrustDialogAccepted: true } } }));
  mkdirSync(join(root, '.codex'));
  writeFileSync(join(root, '.codex/config.toml'), `[projects.${JSON.stringify(root)}]\ntrust_level = "trusted"\n`);
  mkdirSync(join(root, 'bin'));
  symlinkSync(fileURLToPath(new URL('../bin/cland.ts', import.meta.url)), join(root, 'bin/cland'));
  const machine: SetupMachine = {
    projectExists: async () => true, requiredHarnesses: async () => ['opencode'],
    read: async path => path === 'roles.toml' ? roles : null,
    write: async () => { throw new Error('unexpected write'); }, onPath: async () => true,
    run: async () => { throw new Error('unexpected installer/login'); },
    harness: async id => ({ id, bin: `/tools/${id}`, version: [1, 0, 0], checks: [
      { name: id, verdict: 'ok', detail: 'installed' }, { name: `${id} auth`, verdict: 'ok', detail: 'logged in' },
    ] }),
  };
  const hub: SetupHub = {
    running: async () => ({ pid: 42 }), session: async () => ({ status: 'running' }),
    start: async () => { throw new Error('unexpected hub start'); },
    launch: async () => { throw new Error('unexpected Aide launch'); }, resume: async () => { throw new Error('unexpected resume'); },
    attach: async name => { assert.equal(name, 'aide-1'); return 'opencode attach http://localhost:1234'; },
  };
  for (const args of [[], [], ['--attach'], ['--no-accounts'], ['--attach', '--no-accounts'], ['--attach', '--no-aide']]) {
    let output = '';
    const calls: unknown[] = [];
    const io = {
      machine, hub, stdinTTY: true, stdoutTTY: true, write: (s: string) => { output += s; },
      prompter: scriptedPrompter([{ kind: 'confirm', question: 'Set up Telegram remote now?', answer: false }, ...(args.includes('--attach') && !args.includes('--no-aide') ? [{ kind: 'pause' as const, question: /Press Enter/ }] : [])]),
      run: async (...input: Parameters<NonNullable<HandoverOptions['run']>>) => {
        assert.match(output, /\d+ ok, \d+ done, \d+ skip, 0 open, 0 fail\n/);
        calls.push(input);
        return 0;
      },
    };
    assert.equal(await runSetup(['--yes', ...args], root, { HOME: root, PATH: join(root, 'bin'), CLAND_LAUNCHER: '/tools/workbench' }, io), 0, output);
    assert.match(output, args.includes('--no-accounts') ? /skip  accounts  --no-accounts/ : /ok    accounts  no new signed-in profiles/);
    assert.equal(calls.length, args.includes('--no-aide') ? 0 : 1);
    if (calls.length) assert.equal((calls[0] as unknown[])[0], args.includes('--attach') ? 'sh' : '/tools/workbench');
    assert.equal(output.split('\n').filter(s => s.includes('session stop')).length, args.includes('--no-aide') ? 0 : 1);
    assert.match(output.trim().split('\n').at(-1)!, args.includes('--no-aide') ? /^open the workbench: cland$/ : /cland session stop aide-1/);
    assert.deepEqual(io.prompter.left(), []);
  }
});
