// T1: release setup report with in-memory filesystem and command boundaries; no native imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { releasePreflight, type PreflightIO } from '../src/release-preflight.ts';

test('release preflight reports missing tools, authentication, dirty root and version drift together without covers', async () => {
  const calls: string[] = [];
  const io: PreflightIO = {
    lookup: async tool => tool === 'gh' ? null : `/hub/bin/${tool}`,
    auth: async () => { throw new Error('private authentication diagnostic'); },
    git: async args => { calls.push(args.join(' ')); return args[0] === 'status' ? ' M package.json' : 'head'; },
    read: async path => path === 'package.json' ? '{"version":"0.3.0"}' : path === 'package-lock.json' ? '{"version":"0.3.0","packages":{"":{"version":"0.3.0"}}}' : null,
    managedIgnore: text => text === 'current',
  };
  const missing = await releasePreflight('v0.4.1', io);
  assert.deepEqual(missing.checks.filter(c => c.status !== 'ok').map(c => c.name), ['tool:gh', 'gh-auth', 'clean-root', 'package.json', 'package-lock.json', 'package-lock.json packages[""]', 'managed-header']);
  assert.equal(missing.checks.find(c => c.name === 'gh-auth')?.status, 'unknown');
  io.lookup = async tool => `/hub/bin/${tool}`;
  const unauthenticated = await releasePreflight('v0.4.1', io);
  assert.equal(unauthenticated.checks.find(c => c.name === 'gh-auth')?.status, 'refused');
  assert.doesNotMatch(JSON.stringify(unauthenticated), /private authentication/);
  assert.ok(calls.every(call => call === 'status --porcelain' || call === 'rev-parse --verify refs/heads/dev'));
  assert.equal(missing.mode, 'report');
});

test('release preflight inspects every tool and labels unreadable state unknown', async () => {
  const io: PreflightIO = {
    lookup: async () => null,
    auth: async () => assert.fail('missing gh must not execute authentication'),
    git: async () => { throw new Error('unavailable'); },
    read: async () => { throw new Error('unreadable'); },
    managedIgnore: () => false,
  };
  const result = await releasePreflight(undefined, io);
  assert.deepEqual(result.checks.filter(c => c.status === 'refused').map(c => c.name), ['tool:gh', 'tool:git', 'tool:tar', 'version']);
  assert.equal(result.commit, null);
  assert.equal(result.checks.find(c => c.name === 'clean-root')?.status, 'unknown');
  assert.equal(result.checks.find(c => c.name === 'package.json')?.status, 'unknown');
});

test('release preflight reports matching versions and clean state without publication readiness', async () => {
  const result = await releasePreflight('v0.4.1', {
    lookup: async tool => `/hub/bin/${tool}`,
    auth: async gh => { assert.equal(gh, '/hub/bin/gh'); },
    git: async args => args[0] === 'status' ? '' : 'reviewed-dev',
    read: async path => path === '.cland/.gitignore' ? 'current' : '{"version":"0.4.1","packages":{"":{"version":"0.4.1"}}}',
    managedIgnore: text => text === 'current',
  });
  assert.equal(result.commit, 'reviewed-dev');
  assert.ok(result.checks.every(c => c.status === 'ok'));
});
