// T2: setup sign-in policy through the public step and isolated project hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { signin } from '../src/setup/steps/signin.ts';
import { setupHub } from '../src/setup/hub.ts';
import type { SetupOptions } from '../src/setup/types.ts';
import { scriptedPrompter } from './setup-prompter.ts';
import { projectHub, tempProject, flushProjectLogs } from './harness.ts';
import { askHubFrame } from '../src/cli/socket-client.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../src/init/config.ts';

export function signinOptions(root: string): SetupOptions {
  return { root, env: {}, interactive: true, yes: false, hub: setupHub(root, {}),
    narrate: () => {}, prompter: scriptedPrompter([]), machine: {
      read: async () => null, write: async () => { throw Error('unexpected write'); },
      run: async () => { throw Error('unexpected process'); }, projectExists: async () => true,
      requiredHarnesses: async () => [], onPath: async () => false,
      harness: async id => ({ id, bin: null, version: null, checks: [] }),
    } };
}

test('C1 sign-in offer defaults No and yes skips with either terminal policy', async t => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const o = signinOptions(root);
  o.prompter.confirm = async (q, def) => { assert.match(q, /Let several people/); assert.equal(def, false); return false; };
  assert.equal((await signin(o))[0]?.verdict, 'skip');
  o.prompter = scriptedPrompter([]); o.yes = true;
  for (const interactive of [true, false]) {
    o.interactive = interactive;
    assert.equal((await signin(o))[0]?.verdict, 'skip');
    assert.equal((await o.hub!.signinStatus!()).mode, 'single');
  }
});

test('C2 C4 C5 confirmed switch prints the invite only to terminal and Enter leaves the exact command', async t => {
  const root = await tempProject(t);
  const logs: unknown[] = [];
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Setup'); config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const hub = await projectHub(t, root, {}, { git: async args => args.includes('user.name') ? 'Jane Doe\n' : '', log: row => logs.push(row) });
  const o = signinOptions(root), terminal: string[] = [];
  o.narrate = text => terminal.push(text);
  o.prompter = scriptedPrompter([
    { kind: 'confirm', question: /Let several people/, answer: true },
    { kind: 'confirm', question: /signs out the current browser sessions.*cland auth reset.*only way back/, answer: true },
    { kind: 'pause', question: /Enter skips/ },
  ]);
  const lines = await signin(o);
  assert.equal(lines[0]?.verdict, 'open');
  assert.equal(lines[0]?.fix, 'cland user invite jane-doe');
  const url = terminal.join('').match(/https?:\/\/[^\s]+/)?.[0];
  assert.ok(url, 'terminal received an invite');
  assert.match(terminal.join(''), /jane-doe/);
  await flushProjectLogs(t, root);
  const journal = await askHubFrame(hub.discovery, { type: 'events.list' }, 3000, {});
  const evidence = JSON.stringify([logs, journal, lines]);
  // Positive control must detect the credential before the absence assertion.
  const leaked = (text: string) => text.includes(url);
  assert.equal(leaked(evidence + url), true);
  assert.equal(leaked(evidence), false);
  o.prompter = scriptedPrompter([]);
  assert.deepEqual(await signin(o), [{ name: 'sign-in mode', verdict: 'ok', detail: 'users mode; 1 users' }]);
  // Previous wire shape stays unchanged for the CLI and older clients.
  const legacy = await askHubFrame(hub.discovery, { type: 'user.list' }, 3000, {}) as { users: unknown[] };
  assert.deepEqual(Object.keys(legacy), ['users']);
  assert.equal('passkeyRegistered' in (legacy.users[0] as object), false);
});

test('C4 nonterminal single mode skips with its command and a declined confirmation leaves single unchanged', async t => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const o = signinOptions(root); o.interactive = false;
  assert.equal((await signin(o))[0]?.verdict, 'skip');
  assert.equal((await signin(o))[0]?.fix, 'cland auth mode users');
  assert.equal((await o.hub!.signinStatus!()).mode, 'single');
  o.interactive = true;
  o.prompter = scriptedPrompter([
    { kind: 'confirm', question: /Let several people/, answer: true },
    { kind: 'confirm', question: /signs out/, answer: false },
  ]);
  assert.equal((await signin(o))[0]?.verdict, 'skip');
  assert.equal((await o.hub!.signinStatus!()).mode, 'single');
});

test('older injected hub metadata stays unknown without switching', async () => {
  const o = signinOptions('/unused');
  o.hub!.signinStatus = async () => ({ users: [] });
  o.hub!.signinUsers = async () => { throw Error('must not switch'); };
  assert.equal((await signin(o))[0]?.verdict, 'open');
});

test('lost registration read stays open and joins the terminal reader', async () => {
  const o = signinOptions('/unused');
  let reads = 0, joined = false;
  o.hub!.signinStatus = async () => { if (reads++) throw Error('edge disconnected'); return { mode: 'single', users: [] }; };
  o.hub!.signinUsers = async () => ({ user: { id: 'first', name: 'alex' }, url: 'http://localhost/invite?test' });
  o.prompter = {
    ...scriptedPrompter([
      { kind: 'confirm', question: /Let several people/, answer: true },
      { kind: 'confirm', question: /signs out/, answer: true },
    ]),
    pause: async (_message, signal) => {
      await new Promise<void>(resolve => signal?.addEventListener('abort', () => resolve(), { once: true }));
      joined = true;
    },
  };
  assert.equal((await signin(o))[0]?.fix, 'cland user invite alex');
  assert.equal(joined, true);
});
