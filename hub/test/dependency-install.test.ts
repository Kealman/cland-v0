// T1: the root install decision from manifest contents, with no hub, child process or real time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dependencyInstall, dependencyInstallBetween } from '../src/dependency-install.ts';

const root = '/project';
const manifest = (value: Record<string, unknown>) => JSON.stringify(value);
const base = {
  name: 'cland',
  version: '0.2.2',
  scripts: { test: 'node --test' },
  dependencies: { 'smol-toml': '1.4.2' },
  devDependencies: { typescript: '7.0.2' },
};
const expected = { files: ['package.json'], command: 'npm install' as const, cwd: root };

test('a scripts-only package.json change needs no install', () => {
  const after = manifest({ ...base, scripts: { test: 'node --test --experimental-strip-types' } });
  assert.equal(dependencyInstall(root, ['package.json'], () => ({ before: manifest(base), after })), undefined);
});

test('a project version bump needs no install', () => {
  const after = manifest({ ...base, version: '0.2.3' });
  assert.equal(dependencyInstall(root, ['package.json'], () => ({ before: manifest(base), after })), undefined);
});

test('fields outside the install set need no install', () => {
  const after = manifest({ ...base, name: 'renamed', description: 'new', engines: { node: '>=23' }, bin: { cland: 'hub/bin/cland.ts' } });
  assert.equal(dependencyInstall(root, ['package.json'], () => ({ before: manifest(base), after })), undefined);
});

for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'overrides', 'workspaces'] as const) {
  test(`a ${field} change still needs an install`, () => {
    const after = manifest({ ...base, [field]: field === 'workspaces' ? ['hub', 'web'] : { changed: '1.0.0' } });
    assert.deepEqual(dependencyInstall(root, ['package.json'], () => ({ before: manifest(base), after })), expected);
  });
}

test('a lockfile change still needs an install without reading any manifest', () => {
  assert.deepEqual(dependencyInstall(root, ['package-lock.json', 'web/package-lock.json']), {
    files: ['package-lock.json', 'web/package-lock.json'], command: 'npm install', cwd: root,
  });
  assert.deepEqual(dependencyInstall(root, ['package-lock.json'], () => assert.fail('a lockfile needs no manifest read')), {
    files: ['package-lock.json'], command: 'npm install', cwd: root,
  });
});

test('an added, deleted, unreadable or malformed manifest stays conservative', () => {
  const cases = [
    { name: 'added', before: null, after: manifest(base) },
    { name: 'deleted', before: manifest(base), after: null },
    { name: 'unreadable', before: null, after: null },
    { name: 'malformed before', before: 'not json', after: manifest(base) },
    { name: 'malformed after', before: manifest(base), after: '{' },
    { name: 'non-object', before: '[]', after: manifest(base) },
    { name: 'absent content', before: undefined, after: undefined },
  ] as const;
  for (const item of cases) {
    const contents = item.before === undefined ? undefined : { before: item.before, after: item.after };
    assert.deepEqual(dependencyInstall(root, ['package.json'], () => contents), expected, item.name);
  }
  assert.deepEqual(dependencyInstall(root, ['package.json']), expected, 'an uninspected manifest stays conservative');
});

test('no package file means no install', () => {
  assert.equal(dependencyInstall(root, ['hub/src/parser.ts', 'docs/agents/tests.md', 'mypackage.json']), undefined);
});

test('a candidate reads each changed manifest before and after and keeps lockfiles unread', async () => {
  const reads: string[] = [];
  const read = async (revision: string, path: string) => {
    reads.push(`${revision}:${path}`);
    return path === 'hub/package.json' && revision === 'bbb' ? manifest({ ...base, dependencies: { changed: '1.0.0' } }) : manifest(base);
  };
  const install = await dependencyInstallBetween(root, ['package.json', 'hub/package.json', 'package-lock.json'], { before: 'aaa', after: 'bbb' }, read);
  assert.deepEqual(install, { files: ['hub/package.json', 'package-lock.json'], command: 'npm install', cwd: root });
  assert.deepEqual(reads.sort(), ['aaa:hub/package.json', 'aaa:package.json', 'bbb:hub/package.json', 'bbb:package.json']);
});

test('a candidate whose only manifest change is scripts-only needs no install', async () => {
  const read = async (revision: string) => manifest({ ...base, scripts: { test: revision === 'aaa' ? 'old' : 'new' } });
  assert.equal(await dependencyInstallBetween(root, ['package.json'], { before: 'aaa', after: 'bbb' }, read), undefined);
});

test('an unreadable candidate manifest keeps the conservative install', async () => {
  const read = async () => { throw new Error('git show failed'); };
  assert.deepEqual(await dependencyInstallBetween(root, ['package.json'], { before: 'aaa', after: 'bbb' }, read), expected);
});

test('reordered dependency object keys do not require an install', () => {
  assert.equal(dependencyInstall(root, ['package.json'], () => ({
    before: manifest({ dependencies: { alpha: '1', beta: '2' } }),
    after: manifest({ dependencies: { beta: '2', alpha: '1' } }),
  })), undefined);
});
