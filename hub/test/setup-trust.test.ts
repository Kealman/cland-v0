// T1: scratch config files and a complete fake clock; no real harnesses or processes.
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { CodexTrustDependencies } from '../src/setup/codex-trust.ts';
import assert from 'node:assert/strict';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTrustStep } from '../src/setup/steps/trust.ts';
import { scriptedPrompter } from './setup-prompter.ts';
import type { SetupOptions } from '../src/setup/types.ts';
import { grantClaudeTrust } from '../src/setup/trust.ts';
import { FakeClock } from './fake-clock.ts';

function scratch(t: test.TestContext): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'cland-trust-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('Claude trust preserves other data, mode, symlink and trailing newline', async t => {
  const dir = scratch(t);
  for (const newline of ['', '\n']) {
    const file = join(dir, newline ? 'newline.json' : 'plain.json');
    const link = `${file}.link`;
    const original = { theme: 'dark', projects: { '/other': { hasTrustDialogAccepted: false }, [dir]: { tools: ['Read'] } } };
    writeFileSync(file, JSON.stringify(original) + newline);
    chmodSync(file, 0o640);
    symlinkSync(file, link);
    await grantClaudeTrust(link, dir);
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { ...original, projects: { ...original.projects, [dir]: { tools: ['Read'], hasTrustDialogAccepted: true } } });
    assert.equal(statSync(file).mode & 0o777, 0o640);
    assert.equal(readFileSync(file, 'utf8').endsWith('\n'), Boolean(newline));
    assert.ok(lstatSync(link).isSymbolicLink());
  }
  const fresh = join(dir, 'new.json');
  await grantClaudeTrust(fresh, dir);
  assert.equal(statSync(fresh).mode & 0o777, 0o600);
});

test('Claude trust waits for the current writer and rereads its update under the lock', async t => {
  const dir = scratch(t), file = join(dir, '.claude.json'), lock = `${file}.lock`;
  const clock = new FakeClock();
  writeFileSync(file, '{}');
  mkdirSync(lock);
  utimesSync(lock, clock.now(), clock.now());
  let finished = false;
  const grant = grantClaudeTrust(file, dir, clock).then(() => { finished = true; });
  await clock.advance(200);
  assert.equal(finished, false);
  assert.equal(readFileSync(file, 'utf8'), '{}');
  writeFileSync(file, JSON.stringify({ changedByWriter: true }));
  rmSync(lock, { recursive: true });
  await clock.advance(100);
  await grant;
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).changedByWriter, true);
  assert.equal(finished, true);
  assert.equal(clock.pending, 0);
});

test('Claude trust takes over a lock older than ten seconds', async t => {
  const dir = scratch(t), file = join(dir, '.claude.json'), lock = `${file}.lock`;
  const clock = new FakeClock();
  mkdirSync(lock);
  const stale = new Date(clock.now().getTime() - 10_001);
  utimesSync(lock, stale, stale);
  await grantClaudeTrust(file, dir, clock);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).projects[dir].hasTrustDialogAccepted, true);
  assert.equal(clock.pending, 0);
});

test('Codex trust sends the folder spellings in one batch and closes its process group', async () => {
  const { grantCodexTrust } = await import('../src/setup/codex-trust.ts');
  for (const failure of ['none', 'connect', 'write', 'spawn'] as const) {
    const child = Object.assign(new EventEmitter(), { pid: failure === 'spawn' ? undefined : 42, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
    const requests: unknown[] = [], killed: number[] = [];
    let clientClosed = false;
    const env = { CODEX_HOME: '/profile' };
    const promise = grantCodexTrust('/tools/codex', env, ['/alias', '/real'], {
      spawn: (bin, args, options) => {
        assert.equal(bin, '/tools/codex');
        assert.deepEqual(args, ['app-server']);
        assert.deepEqual(options, { env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
        if (failure === 'spawn') queueMicrotask(() => { child.emit('error', new Error('spawn failed')); child.emit('close'); });
        return child;
      },
      connect: async () => {
        if (failure === 'connect') throw new Error('connect failed');
        return { request: async (method, params) => {
          requests.push([method, params]);
          if (failure === 'write') throw new Error('write failed');
        }, close: () => { clientClosed = true; } };
      },
      kill: (pid, signal) => { assert.equal(signal, 'SIGKILL'); killed.push(pid); child.emit('close'); return true; },
    });
    if (failure === 'none') await promise;
    else await assert.rejects(promise, new RegExp(`${failure} failed`));
    assert.deepEqual(killed, failure === 'spawn' ? [] : [-42]);
    assert.equal(clientClosed, failure !== 'connect');
    if (failure === 'none') assert.deepEqual(requests, [['config/batchWrite', { edits: [
      { keyPath: 'projects."/alias".trust_level', value: 'trusted', mergeStrategy: 'replace' },
      { keyPath: 'projects."/real".trust_level', value: 'trusted', mergeStrategy: 'replace' },
    ] }]]);
  }
});

function codexClient(onBatch: (params: Record<string, unknown>) => void): CodexTrustDependencies {
  let child: EventEmitter;
  return {
    spawn: () => {
      child = new EventEmitter();
      return Object.assign(child, { pid: 42, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
    },
    connect: async () => ({ request: async (method, params) => { assert.equal(method, 'config/batchWrite'); onBatch(params); }, close() {} }),
    kill: () => { child.emit('close'); return true; },
  };
}

function options(root: string): SetupOptions {
  return { root, env: { HOME: root }, interactive: true, yes: false, prompter: scriptedPrompter([]), machine: {
    read: async () => null, write: async () => { throw new Error('unexpected project write'); }, run: async () => { throw new Error('unexpected installer'); },
    projectExists: async () => true, onPath: async () => true,
    harness: async id => ({ id, bin: `/tools/${id}`, version: [1, 0, 0], checks: [] }),
  } };
}

test('one trust line covers installed harnesses and a second run writes nothing', async t => {
  const root = scratch(t), alias = join(root, 'alias');
  symlinkSync(root, alias);
  const opts = options(alias);
  opts.env.HOME = root;
  let writes = 0;
  const deps = codexClient(params => {
    assert.deepEqual(params, { edits: [
      { keyPath: `projects."${alias}".trust_level`, value: 'trusted', mergeStrategy: 'replace' },
      { keyPath: `projects."${root}".trust_level`, value: 'trusted', mergeStrategy: 'replace' },
    ] });
    writes++;
    mkdirSync(join(root, '.codex'));
    writeFileSync(join(root, '.codex/config.toml'), `[projects.${JSON.stringify(alias)}]\ntrust_level = "trusted"\n[projects.${JSON.stringify(root)}]\ntrust_level = "trusted"\n`);
  });
  const spawnClient = deps.spawn!;
  deps.spawn = (bin, args, launch) => {
    assert.equal(bin, '/tools/codex');
    assert.equal(launch.env.HOME, root);
    return spawnClient(bin, args, launch);
  };
  const step = createTrustStep({ codex: deps });
  const first = await step(opts);
  assert.equal(first.length, 1);
  assert.equal(first[0]?.name, 'trust');
  assert.equal(first[0]?.verdict, 'done');
  assert.match(first[0]!.detail, /trusted for claude-code \(~\/.claude.json\), codex \(~\/.codex\/config.toml\)/);
  assert.match(first[0]!.detail, /opencode.*no trust gate/);
  assert.match(first[0]!.detail, /real harness configuration.*this path/);
  const file = join(root, '.claude.json'), before = statSync(file);
  const second = await step(opts);
  assert.equal(second[0]?.verdict, 'ok');
  assert.equal(writes, 1);
  assert.equal(statSync(file).ino, before.ino);
  assert.equal(statSync(file).mtimeMs, before.mtimeMs);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).projects[root].hasTrustDialogAccepted, true);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).projects[alias], undefined);
});

test('without a terminal or yes trust stays open without writing', async t => {
  const root = scratch(t), opts = { ...options(root), interactive: false };
  const step = createTrustStep({ codex: { spawn: () => { assert.fail('must not launch Codex'); } } });
  const lines = await step(opts);
  assert.equal(lines[0]?.verdict, 'open');
  assert.match(lines[0]!.fix!, /cland setup --yes/);
  assert.throws(() => statSync(join(root, '.claude.json')), { code: 'ENOENT' });
  assert.throws(() => statSync(join(root, '.codex')), { code: 'ENOENT' });
});

test('trust includes launch profiles and only the accounts named by roles', async t => {
  const root = scratch(t), opts = options(root);
  const claude = join(root, 'launch-claude'), codex = join(root, 'launch-codex');
  const workClaude = join(root, 'work-claude'), workCodex = join(root, 'work-codex');
  for (const dir of [claude, codex, workClaude, workCodex, join(root, '.cland'), join(root, '.config/cland')]) mkdirSync(dir, { recursive: true });
  opts.env = { HOME: root, CLAUDE_CONFIG_DIR: claude, CODEX_HOME: codex };
  writeFileSync(join(root, '.cland/roles.toml'), '[implementer.launch]\nharness = "claude-code"\naccount = "work-claude"\n[reviewer.launch]\nharness = "codex"\naccount = "work-codex"\n[qa.launch]\nharness = "codex"\naccount = "work-codex"\n');
  writeFileSync(join(root, '.config/cland/accounts.toml'), `[accounts.work-claude]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(workClaude)}\n[accounts.work-codex]\nharness = "codex"\nhome = ${JSON.stringify(workCodex)}\n[accounts.unused]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(join(root, 'unused'))}\n`);
  const homes: string[] = [];
  let currentHome = '';
  const deps = codexClient(() => {
    writeFileSync(join(currentHome, 'config.toml'), `[projects.${JSON.stringify(root)}]\ntrust_level = "trusted"\n`);
  });
  const spawnClient = deps.spawn!;
  deps.spawn = (bin, args, launch) => {
    currentHome = launch.env.CODEX_HOME!;
    homes.push(currentHome);
    return spawnClient(bin, args, launch);
  };
  const step = createTrustStep({ codex: deps });
  const lines = await step(opts);
  assert.equal(lines[0]?.verdict, 'done', JSON.stringify(lines));
  assert.deepEqual(homes, [codex, workCodex]);
  for (const dir of [claude, workClaude]) assert.equal(JSON.parse(readFileSync(join(dir, '.claude.json'), 'utf8')).projects[root].hasTrustDialogAccepted, true);
  assert.throws(() => statSync(join(root, '.claude.json')), { code: 'ENOENT' });
  assert.throws(() => statSync(join(root, 'unused')), { code: 'ENOENT' });
});

test('a Codex write that does not reread as trusted reports its own dialog', async t => {
  const root = scratch(t);
  const step = createTrustStep({ codex: codexClient(() => {}) });
  const lines = await step({ ...options(root), interactive: false, yes: true });
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.verdict, 'fail');
  assert.match(lines[0]!.detail, /codex.*did not reread as trusted/);
  assert.match(lines[0]!.fix!, /codex.*own trust dialog/);
});

test('invalid Claude JSON is preserved while the line explains the manual dialog', async t => {
  const root = scratch(t);
  writeFileSync(join(root, '.claude.json'), 'not-json\n');
  const opts = options(root), base = opts.machine;
  opts.machine = { ...base, harness: async id => ({ ...await base.harness(id), bin: id === 'claude-code' ? '/tools/claude' : null }) };
  const lines = await createTrustStep()(opts);
  assert.equal(lines[0]?.verdict, 'fail');
  assert.match(lines[0]!.detail, /claude-code.*not valid JSON/);
  assert.match(lines[0]!.fix!, /claude.*own trust dialog/);
  assert.equal(readFileSync(join(root, '.claude.json'), 'utf8'), 'not-json\n');
});

test('a Codex initialization deadline still ends its process group', async () => {
  const { grantCodexTrust } = await import('../src/setup/codex-trust.ts');
  const clock = new FakeClock();
  const child = Object.assign(new EventEmitter(), { pid: 42, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  let killed = false;
  const grant = grantCodexTrust('/tools/codex', {}, ['/root'], {
    clock, spawn: () => child, connect: () => new Promise(() => {}),
    kill: (pid, signal) => { assert.equal(pid, -42); assert.equal(signal, 'SIGKILL'); killed = true; child.emit('close'); return true; },
  });
  const rejected = assert.rejects(grant, /timed out/);
  await clock.advance(15_000);
  await rejected;
  assert.equal(killed, true);
  assert.equal(clock.pending, 0);
});

test('Claude trust refuses unsupported project shapes without changing their bytes', async t => {
  const root = scratch(t), file = join(root, '.claude.json');
  for (const value of [
    { theme: 'dark', projects: [] },
    { theme: 'dark', projects: 'unsupported' },
    { theme: 'dark', projects: null },
    { theme: 'dark', projects: { [root]: [] } },
    { theme: 'dark', projects: { [root]: 'unsupported' } },
    { theme: 'dark', projects: { [root]: null } },
  ]) {
    const original = JSON.stringify(value, null, 4) + '\n';
    writeFileSync(file, original);
    await assert.rejects(grantClaudeTrust(file, root), /projects.*object.*trust dialog/);
    assert.equal(readFileSync(file, 'utf8'), original);
  }
});
