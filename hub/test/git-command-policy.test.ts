// T1: pure Git argv ownership classification; no native acquisition.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gitCommandPolicy } from '../src/git-command-policy.ts';
import { glob, readFile } from 'node:fs/promises';
import { gitCommandCallSites, compareGitCommandCallSites } from './git-command-call-sites.ts';
import { GitReadCapabilities, gitReadLog, PROMISOR_CONFIG_KEYS } from '../src/git-read-capability.ts';

test('known read-only Git commands avoid writer ownership and optional index writes', () => {
  for (const args of [
    ['rev-parse', 'HEAD'], ['rev-parse', '--verify', 'refs/heads/dev'],
    ['status', '--porcelain'], ['status', '--porcelain=v1', '--untracked-files=no'],
    ['worktree', 'list', '--porcelain', '-z'],
    ['-c', 'gc.auto=0', 'worktree', 'list', '--porcelain'],
    ['log', '--format=%h %s', 'dev..topic', '--'],
    ['--literal-pathspecs', 'log', '-1', '--format=%H', 'dev', '--', 'file'],
    ['show', '-s', '--format=%P', 'HEAD'], ['show', 'HEAD:package.json'],
    ['diff', '--name-only', '-z', 'HEAD', '--'], ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD'],
    ['ls-tree', '--name-only', '-z', 'HEAD', '--', 'file'], ['ls-files', '--others', '--exclude-standard', '-z'],
    ['for-each-ref', '--format=%(objectname)', 'refs/heads/'], ['merge-base', '--is-ancestor', 'base', 'tip'],
    ['check-ref-format', '--branch', 'topic'], ['show-ref', '--verify', '--quiet', 'refs/heads/dev'],
    ['symbolic-ref', '--quiet', '--short', 'HEAD'], ['config', '--get', 'cland.defaultBranch'],
  ]) {
    const original = [...args];
    const policy = gitCommandPolicy(args);
    assert.equal(policy.kind, 'read-only', args.join(' '));
    assert.ok(policy.args.includes('--no-optional-locks'), 'read-only status cannot refresh the native index');
    assert.ok(policy.args.includes('--no-lazy-fetch'), 'direct reads cannot fetch missing promisor objects or write packs');
    assert.deepEqual(args, original, 'classification never changes the caller argv');
  }
});

test('unknown commands, options and write variants retain durable writer ownership', () => {
  for (const args of [
    [], ['future-command'], ['__proto__'], ['constructor'], ['status', '--future-option'], ['rev-parse', '--future-option'],
    ['worktree', 'remove', '--', 'scratch'], ['worktree', 'prune'], ['worktree', 'list', '--future-option'],
    ['config', 'core.bare', 'true'], ['config', '--get', 'core.bare', '--add'],
    ['merge-tree', '--write-tree', 'dev', 'topic'], ['write-tree'], ['read-tree', '--dry-run', '-m', '-u', 'dev', 'topic'],
    ['update-ref', 'refs/heads/dev', 'object'], ['-c', 'alias.future=!unsafe', 'future'],
    ['log', '--output=outside'], ['show', '--output=outside'], ['diff', '--output=outside'],
    ['symbolic-ref', 'HEAD', 'refs/heads/other'], ['config', '--', 'core.bare', 'true', '--get'],
    ['config', '--file', '--get', 'core.bare', 'true'], ['config', '--file', '--list', 'core.bare', 'true'],
  ]) assert.equal(gitCommandPolicy(args).kind, 'writer', args.join(' '));
});

test('Git read capability shares one owned probe and records an older-executable fallback once', async () => {
  const cache = new GitReadCapabilities(), events: unknown[] = [];
  await gitReadLog.run(entry => events.push(entry), async () => {
    let calls = 0;
    const held = Promise.withResolvers<{ code: number; stdout: string; stderr: string; nativeClose: { code: number; signal: null }; nativeCleanup: 'complete' }>();
    const probe = () => { calls++; return held.promise; };
    const first = cache.supports('old-native-file', '/fixture/git', probe);
    const second = cache.supports('old-native-file', '/fixture/git', probe);
    held.resolve({ code: 129, stdout: '', stderr: 'the fake Git refuses this option', nativeClose: { code: 129, signal: null }, nativeCleanup: 'complete' });
    assert.deepEqual(await Promise.all([first, second]), [false, false]);
    assert.equal(await cache.supports('old-native-file', '/fixture/git', probe), false);
    cache.writerFallback('/fixture/git', '/fixture/promisor');
    cache.writerFallback('/fixture/git', '/fixture/promisor');
    assert.equal(calls, 1); assert.equal(events.length, 1);
    assert.equal(await cache.supports('new-native-file', '/fixture/git', async () => ({ code: 0, stdout: 'fake Git', stderr: '', nativeClose: { code: 0, signal: null }, nativeCleanup: 'complete' })), true, 'replacement executable is independently probed');
    assert.equal(events.length, 1);
    assert.equal(await cache.supports('missing-close-proof', '/fixture/git', async () => ({ code: 0, stdout: '', stderr: '' })), false, 'exit-code-shaped data without native close is not support proof');
    cache.writerFallback('/fixture/git', '/fixture/unknown');
    assert.equal(events.length, 2);
    const cancelled = Object.assign(new Error('selected capability cancellation'), { code: 'CLAND_GIT_CANCELLED' });
    await assert.rejects(cache.supports('cancelled-probe', '/fixture/git', async () => { throw cancelled; }), error => error === cancelled);
    assert.equal(await cache.supports('cancelled-probe', '/fixture/git', async () => ({ code: 0, stdout: '', stderr: '', nativeClose: { code: 0, signal: null }, nativeCleanup: 'complete' })), true, 'cancelled producers do not poison later executable capability');
    await assert.rejects(cache.supports('incomplete-probe', '/fixture/git', async () => ({ code: 7, stdout: 'kept output', stderr: 'kept diagnostic', nativeClose: { code: 7, signal: null }, nativeCleanup: 'incomplete' })), error => {
      assert.equal(Reflect.get(error as object, 'code'), 7);
      assert.equal(Reflect.get(error as object, 'nativeCleanup'), 'incomplete');
      assert.deepEqual(Reflect.get(error as object, 'nativeClose'), { code: 7, signal: null });
      assert.equal(Reflect.get(error as object, 'stdout'), 'kept output');
      return true;
    });
  });
});

test('ordinary repository proof requires a fresh complete no-match receipt for every read', async () => {
  const cache = new GitReadCapabilities();
  let probes = 0;
  const ordinary = async () => { probes++; return { code: 1, stdout: '', stderr: '', nativeClose: { code: 1, signal: null }, nativeCleanup: 'complete' as const }; };
  assert.equal(await cache.ordinary(ordinary), true);
  assert.equal(await cache.ordinary(ordinary), true); assert.equal(probes, 2);
  assert.equal(await cache.ordinary(async () => ({ code: 0, stdout: 'remote.origin.promisor\0', stderr: '', nativeClose: { code: 0, signal: null }, nativeCleanup: 'complete' })), false);
  assert.equal(await cache.ordinary(async () => ({ code: 1, stdout: '', stderr: '' })), false);
  assert.equal(await cache.ordinary(async () => ({ code: 1, stdout: '', stderr: 'unknown config warning', nativeClose: { code: 1, signal: null }, nativeCleanup: 'complete' })), false);
  assert.equal(gitCommandPolicy(['-C', '/another', 'status']).localRepository, false, 'untracked repository targets retain the conservative old-Git path');
  for (const key of ['extensions.partialclone', 'remote.origin.promisor', 'remote.origin.partialclonefilter']) assert.equal(new RegExp(PROMISOR_CONFIG_KEYS).test(key), true, `effective query detects ${key}`);
  assert.equal(new RegExp(PROMISOR_CONFIG_KEYS).test('user.name'), false);
});

test('promisor configuration includes partialclonefilter-only and mixed-case key shapes', () => {
  for (const key of ['remote.origin.partialclonefilter', 'REMOTE.Origin.PROMISOR', 'Extensions.PartialClone', 'extensions.partialclonefuture']) {
    assert.equal(new RegExp(PROMISOR_CONFIG_KEYS).test(key), true, key);
  }
  for (const key of ['user.name', 'remote.origin.url', 'extensions.objectformat']) assert.equal(new RegExp(PROMISOR_CONFIG_KEYS).test(key), false, key);
});

test('every territory Git callsite retains its recorded ownership class and forwarding disposition', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/git-command-call-sites.json', import.meta.url), 'utf8')) as {
    sources: string[]; calls: Array<{ file: string; call: string; argv: string[] | null; expected: 'read-only' | 'writer' | 'forwarded'; disposition: string }>;
  };
  const files: string[] = [];
  for await (const path of glob('hub/src/**/*.ts')) if (!path.endsWith('.test.ts')) files.push(path);
  assert.ok(files.length < 2000, 'bounded current-source census; widen explicitly when the source index grows');
  const actual: ReturnType<typeof gitCommandCallSites> = [];
  const sources: string[] = [];
  for (let at = 0; at < files.length; at += 32) {
    for (const { file, source } of await Promise.all(files.slice(at, at + 32).map(async file => ({ file, source: await readFile(file, 'utf8') })))) {
      if (!source.includes('territoryGitAsync')) continue;
      sources.push(file); actual.push(...gitCommandCallSites(file, source));
    }
  }
  assert.deepEqual(sources.sort(), fixture.sources.toSorted(), 'every producer module is listed');
  assert.deepEqual(actual.sort(compareGitCommandCallSites), fixture.calls.map(({ file, call, argv }) => ({ file, call, argv })), 'new and changed consumers require an explicit class disposition');
  for (const row of fixture.calls) {
    assert.ok(row.disposition.trim(), `${row.file}: a forwarding or class disposition is required`);
    if (row.expected === 'forwarded') {
      assert.equal(row.argv, null);
    } else {
      assert.ok(row.argv);
      assert.equal(gitCommandPolicy(row.argv).kind, row.expected, `${row.file}: ${row.call}`);
    }
  }
});

test('callsite census positively sees imported aliases, namespace calls, private wrappers and legacy cwd calls', () => {
  const rows = gitCommandCallSites('fixture.ts', `
    import { territoryGitAsync as execute } from './territory.ts';
    execute(root, ['status', '--porcelain']);
    territory.territoryGitAsync(root, ['update-ref', 'ref', 'object']);
    this.#git(root, ['rev-parse', 'HEAD']);
    this.#git(['merge-base', '--is-ancestor', head, 'dev']);
    this.#rootGit(['rev-parse', '--verify', ref]);
    git(root, ['worktree', 'remove', path]);
  `);
  assert.deepEqual(rows.map(row => row.argv), [
    ['status', '--porcelain'], ['update-ref', 'ref', 'object'], ['rev-parse', 'HEAD'], ['merge-base', '--is-ancestor', 'fixture', 'dev'], ['rev-parse', '--verify', 'fixture'], ['worktree', 'remove', 'fixture'],
  ]);
});
