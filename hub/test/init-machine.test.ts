// T3: isolated CLI/Git processes prove init's shallow-clone refusal and fetch --unshallow recovery.
// Fixture self-tests run in a poisoned-HOME child to prove they cannot modify host state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { emptyFolder, filesFolder, gitIn, initializedProject, initIn, ledger, legacyLedger, masterClone, scratchMachine, shallowClone, snapshot, unbornRepo } from './init-machine.ts';

// Every fixture self-test runs in a child with a poisoned, scratch-owned host HOME.
// Neither importing the fixture nor starting cland may use that inherited HOME.
if (process.env.CLAND_INIT_MACHINE_SELFTEST !== '1') {
  test('init machine self-tests keep the inherited HOME untouched', async t => {
    const host = await realpath(await mkdtemp(join(tmpdir(), 'cland-init-host-')));
    t.after(() => rm(host, { recursive: true, force: true }));
    await writeFile(join(host, '.gitconfig'), '[user]\nname = Host\nemail = host@example.invalid\n[commit]\ngpgsign = true\n');
    await writeFile(join(host, 'keep'), 'host content\n');
    const before = await snapshot(host);
    const isolated = await scratchMachine(t, { identity: false });
    const env: NodeJS.ProcessEnv = { ...isolated.env, HOME: host, XDG_CONFIG_HOME: host, XDG_DATA_HOME: host, XDG_STATE_HOME: host,
      GIT_CONFIG_GLOBAL: join(host, '.gitconfig'), GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'user.email', GIT_CONFIG_VALUE_0: 'injected@example.invalid',
      GIT_AUTHOR_NAME: 'Host', GIT_AUTHOR_EMAIL: 'author@example.invalid', GIT_COMMITTER_NAME: 'Host', GIT_COMMITTER_EMAIL: 'committer@example.invalid', EMAIL: 'host@example.invalid',
      DIGITALOCEAN_TOKEN: 'poison-provider', OPENAI_API_KEY: 'poison-account', CODEX_HOME: host, CLAUDE_CONFIG_DIR: host, OPENCODE_AUTH_JSON: 'poison-account',
      CLAND_INIT_MACHINE_SELFTEST: '1' };
    delete env.NODE_TEST_CONTEXT;
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      execFile(process.execPath, ['--test', fileURLToPath(import.meta.url)], { env, encoding: 'utf8', timeout: 30_000 }, (error, stdout, stderr) => {
        if (error && typeof error.code !== 'number') reject(error);
        else resolve({ code: error ? error.code as number : 0, stdout, stderr });
      });
    });
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.deepEqual(await snapshot(host), before, 'the inherited HOME stays untouched');
  });
} else {
  test('initIn supplies scratch HOME and Git has only the requested identity', async t => {
    const machine = await scratchMachine(t, { identity: false });
    const folder = await emptyFolder(machine);
    const email = await gitIn(machine, folder, 'config', 'user.email');
    assert.equal(email.code, 1);
    assert.equal(email.stdout, '');
    assert.equal((await gitIn(machine, folder, 'config', 'commit.gpgsign')).stdout.trim(), 'false');
    for (const key of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'EMAIL', 'GIT_CONFIG_COUNT', 'OPENAI_API_KEY', 'OPENCODE_AUTH_JSON']) assert.equal(machine.env[key], undefined, key);
    assert.equal(machine.env.DIGITALOCEAN_TOKEN, '');
    assert.equal(machine.env.CLAUDE_CONFIG_DIR, join(machine.home, '.claude'));
    assert.equal(machine.env.CODEX_HOME, join(machine.home, '.codex'));
    const identified = await scratchMachine(t, { identity: true });
    const receipt = join(identified.root, 'home-observed');
    const probe = join(identified.root, 'probe.mjs');
    await writeFile(probe, `import assert from 'node:assert/strict';\nimport { writeFileSync } from 'node:fs';\nassert.equal(process.env.HOME, ${JSON.stringify(identified.home)});\nfor (const key of ['XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME']) assert.ok(process.env[key].startsWith(process.env.HOME + '/'));\nwriteFileSync(${JSON.stringify(receipt)}, 'observed');\n`);
    identified.env.NODE_OPTIONS = `--import=${pathToFileURL(probe).href}`;
    const result = await initIn(identified, await emptyFolder(identified), 'init', '--json');
    assert.equal(result.code, 0, result.stderr);
    assert.equal(await readFile(receipt, 'utf8'), 'observed', 'the actual cland process observed HOME');
    assert.equal((await gitIn(identified, await emptyFolder(identified), 'config', 'user.email')).stdout.trim(), 'init@example.test');
    assert.equal((await gitIn(identified, identified.home, 'config', 'user.name')).stdout.trim(), 'Init Test');
    assert.equal((await gitIn(identified, identified.home, 'config', 'commit.gpgsign')).stdout.trim(), 'false');
  });

  test('folder builders produce plain folders and unborn repositories with an optional staged file', async t => {
    const machine = await scratchMachine(t, { identity: false });
    const empty = await emptyFolder(machine);
    assert.deepEqual(await snapshot(empty), {});
    const files = await filesFolder(machine);
    assert.equal(await readFile(join(files, 'src', 'index.js'), 'utf8'), 'console.log("hello");\n');
    for (const folder of [empty, files]) assert.equal((await gitIn(machine, folder, 'rev-parse', '--git-dir')).code, 128);
    for (const staged of [false, true]) {
      const folder = await unbornRepo(machine, { staged });
      assert.equal((await gitIn(machine, folder, 'rev-parse', '--is-inside-work-tree')).stdout.trim(), 'true');
      assert.equal((await gitIn(machine, folder, 'rev-parse', '--verify', 'HEAD')).code, 128);
      assert.equal((await gitIn(machine, folder, 'diff', '--cached', '--name-only')).stdout.trim(), staged ? 'staged.txt' : '');
    }
  });

  test('clone builders preserve master upstream HEAD and make a real shallow clone', async t => {
    const machine = await scratchMachine(t, { identity: false });
    for (const [builder, shallow] of [[masterClone, false], [shallowClone, true]] as const) {
      const { upstream, clone } = await builder(machine);
      assert.equal((await gitIn(machine, upstream, 'rev-parse', '--is-bare-repository')).stdout.trim(), 'true');
      assert.equal((await gitIn(machine, upstream, 'symbolic-ref', 'HEAD')).stdout.trim(), 'refs/heads/master');
      assert.equal((await gitIn(machine, clone, 'symbolic-ref', 'refs/remotes/origin/HEAD')).stdout.trim(), 'refs/remotes/origin/master');
      assert.equal((await gitIn(machine, clone, 'rev-list', '--count', 'HEAD')).stdout.trim(), '1');
      assert.equal((await gitIn(machine, clone, 'rev-parse', '--is-shallow-repository')).stdout.trim(), String(shallow));
      assert.equal((await gitIn(machine, clone, 'config', 'user.email')).stdout, '', 'seed identity did not persist');
    }
  });

  test('initialized project builder provisions a project with a subfolder', async t => {
    const machine = await scratchMachine(t, { identity: false });
    const { root, subfolder } = await initializedProject(machine);
    assert.equal((await gitIn(machine, subfolder, 'rev-parse', '--show-toplevel')).stdout.trim(), root);
    assert.ok((await readFile(join(root, '.cland', 'config.toml'), 'utf8')).includes('[tracker]'));
    assert.ok((await readFile(join(root, 'AGENTS.md'), 'utf8')).includes('managed by cland'));
  });

  test('shallow init recovers after fetching the full history', { timeout: 5000 }, async t => {
    const machine = await scratchMachine(t, { identity: false });
    const { clone } = await shallowClone(machine);
    // Isolate shallow recovery; arbitrary default branches belong to T-650/T-651.
    const renamed = await gitIn(machine, clone, 'branch', '-m', 'main');
    assert.equal(renamed.code, 0, renamed.stderr);
    const before = await snapshot(machine.root);
    const outside = await snapshot(machine.root, { except: clone });
    const refused = await initIn(machine, clone, 'init');
    assert.equal(refused.code, 1);
    assert.equal(refused.stdout, '');
    assert.match(refused.stderr, /cland init: the territory needs the full history: run git fetch --unshallow, then cland init again/);
    assert.deepEqual(await snapshot(machine.root), before, 'refusal preserves files and Git metadata across the scratch machine');

    const fetched = await gitIn(machine, clone, 'fetch', '--unshallow');
    assert.equal(fetched.code, 0, fetched.stderr);
    const initialized = await initIn(machine, clone, 'init');
    assert.equal(initialized.code, 0, initialized.stderr);
    const dev = await gitIn(machine, join(clone, '.cland', 'territory.git'), 'rev-parse', '--verify', 'refs/heads/dev');
    assert.equal(dev.code, 0, dev.stderr);
    assert.equal(dev.stdout, (await gitIn(machine, clone, 'rev-parse', 'refs/heads/dev')).stdout);
    assert.deepEqual(await snapshot(machine.root, { except: clone }), outside, 'successful init stays inside its target');
  });

  test('snapshot catches outside changes and link targets without following links or the excepted subtree', async t => {
    const machine = await scratchMachine(t, { identity: false });
    const target = await emptyFolder(machine);
    await mkdir(join(machine.home, 'empty-directory'));
    await symlink(target, join(machine.home, 'link'));
    const before = await snapshot(machine.home, { except: target });
    await writeFile(join(target, 'inside'), 'ignored');
    assert.deepEqual(await snapshot(machine.home, { except: target }), before);
    assert.equal(before.link, `link:${target}`);
    assert.equal(before['empty-directory'], 'directory');
    await writeFile(join(machine.home, 'outside'), 'changed');
    await writeFile(join(machine.home, '__proto__'), 'ordinary file');
    const after = await snapshot(machine.home, { except: target });
    assert.notDeepEqual(after, before);
    assert.match(after.outside!, /^[a-f0-9]{64}$/);
    assert.match(after.__proto__!, /^[a-f0-9]{64}$/);
    assert.deepEqual(await snapshot(machine.home, { except: target.slice(machine.home.length + 1) }), after);
    await writeFile(join(machine.home, 'outside'), 'changed again');
    assert.notEqual((await snapshot(machine.home, { except: target })).outside, after.outside);
  });

  test('ledger helpers stage v0.1.3 state and read the XDG state ledger', async t => {
    const machine = await scratchMachine(t, { identity: false });
    const entries = [{ project: '/fixture/project', lease: 'lease-1', run: 'run-1', size: 'c-8', reservation: 0.1, cost: null, created: '2026-10-16T00:00:00Z', deadline: '2026-10-16T01:00:00Z' }];
    await legacyLedger(machine, entries);
    assert.deepEqual(JSON.parse(await readFile(join(machine.home, '.cland', 'executor', 'spend.json'), 'utf8')), { version: 1, entries });
    machine.env.XDG_STATE_HOME = join(machine.home, 'custom-state');
    await mkdir(join(machine.env.XDG_STATE_HOME, 'cland'), { recursive: true });
    await writeFile(join(machine.env.XDG_STATE_HOME, 'cland', 'spend.json'), JSON.stringify({ version: 1, entries, projects: ['/fixture/project'] }));
    assert.deepEqual(await ledger(machine), { version: 1, entries, projects: ['/fixture/project'] });
  });
}
