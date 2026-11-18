// T2: scratch file boundaries and synthetic process receipts; no native children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { tempProject } from './harness.ts';
import { recordingHost } from './recording-host.ts';
import { fakeOnlyFixture } from './fake-only-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';

test('recording Host explicitly maps every member of the Host interface', async t => {
  const root = await tempProject(t);
  const source = ts.createSourceFile('host.ts', await readFile(new URL('../src/host/host.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const contract = source.statements.find((node): node is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(node) && node.name.text === 'Host')!;
  const members = contract.members.map(member => member.name!.getText(source)).sort();
  assert.deepEqual(Object.keys(recordingHost(root)).sort(), members);
  const extended = ts.createSourceFile('future-host.ts', source.text.replace('export interface Host {', 'export interface Host { unmappedOperation(): Promise<void>;'), ts.ScriptTarget.Latest, true);
  const future = extended.statements.find((node): node is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(node) && node.name.text === 'Host')!;
  assert.throws(() => assert.deepEqual(Object.keys(recordingHost(root)).sort(), future.members.map(member => member.name!.getText(extended)).sort()), /unmappedOperation/);
});

test('recording Host shares scratch files and completes the synthetic exit when stopped', async t => fakeOnlyFixture(t, async root => {
  const host = recordingHost(root, { sourceRoot: '/remote' });
  await host.makeDirectory('/remote/files', 0o700);
  assert.equal(await host.publishFile('/remote/files/item', Buffer.from('one'), {mode: 0o600}), true);
  assert.equal(await host.publishFile('/remote/files/item', Buffer.from('lost')), false);
  await host.appendFile('/remote/files/item', Buffer.from('two'));
  assert.equal(Buffer.from(await host.readFile('/remote/files/item')).toString(), 'onetwo');
  assert.equal((await host.stat('/remote/files/item')).size, 6);
  assert.equal(await host.realpath('/remote/files/item'), '/remote/files/item');
  assert.equal(await host.fileType('/remote/files/item'), 'file');
  assert.deepEqual(await host.listFolder('/remote/files'), ['item']);
  assert.equal((await host.statDirectory('/remote/files')).refusal, null);
  await host.writeFile('/remote/files/item', Buffer.from('new'));
  assert.equal(await readFile(join(root, 'files/item'), 'utf8'), 'new');
  await host.removePath('/remote/files/item');
  await host.removePath('/remote/files', {directory: true});
  await assert.rejects(host.readFile('/outside'), /outside recording Host/);
  const child = await host.spawn({command: 'never-native', args: [], cwd: '/remote', env: {}});
  assert.equal(await host.alive({pid: child.pid}), true);
  assert.equal(await host.stop({pid: child.pid}), true);
  assert.deepEqual(await within(child.exited, 1000), {code: 0, signal: null});
  assert.equal(await host.alive({pid: child.pid}), false);
  await assert.rejects(host.run({command: 'never-native', args: [], cwd: '/remote', env: {}}), /refuses run/);
}));

test('recording Host moves both mapped directory paths and forwards source identity', async t => fakeOnlyFixture(t, async root => {
  const storage = join(root, 'storage'); await mkdir(storage);
  const host = recordingHost(storage, {sourceRoot: '/remote'});
  await host.makeDirectory('/remote/source');
  await host.writeFile('/remote/source/password', Buffer.from('synthetic'));
  const {identity} = await host.statDirectory('/remote/source'); assert.ok(identity);
  await assert.rejects(host.moveDirectory!('/remote/source', '/remote/target', {sourceIdentity: {...identity, ino: identity.ino + 1}}), /source directory identity changed/);
  assert.equal(await host.fileType('/remote/target'), 'missing');
  await host.moveDirectory!('/remote/source', '/remote/target', {sourceIdentity: identity});
  assert.equal(await host.fileType('/remote/source'), 'missing');
  assert.deepEqual((await host.statDirectory('/remote/target')).identity, identity);
  assert.equal(Buffer.from(await host.readFile('/remote/target/password')).toString(), 'synthetic');
  await host.makeDirectory('/remote/source');
  await assert.rejects(host.moveDirectory!('/remote/source', '/remote/target'), {code: 'EEXIST'});
  await assert.rejects(host.moveDirectory!('/outside', '/remote/unused'), /outside recording Host/);
  await assert.rejects(host.moveDirectory!('/remote/source', '/outside'), /outside recording Host/);
  assert.equal(await host.fileType('/remote/source'), 'directory');
  assert.equal(Buffer.from(await host.readFile('/remote/target/password')).toString(), 'synthetic');
}));

test('a scoped recording Host fault preserves unrelated scratch file operations', async t => fakeOnlyFixture(t, async root => {
  const files = recordingHost(root, {sourceRoot: '/remote'});
  const host = recordingHost(root, {sourceRoot: '/remote', overrides: {
    readFile: async path => {
      if (path === '/remote/blocked') throw new Error('scoped read fault');
      return files.readFile(path);
    },
  }});
  await host.writeFile('/remote/blocked', Buffer.from('kept'));
  await host.writeFile('/remote/other', Buffer.from('readable'));
  await assert.rejects(host.readFile('/remote/blocked'), /scoped read fault/);
  assert.equal(Buffer.from(await files.readFile('/remote/blocked')).toString(), 'kept');
  assert.equal(Buffer.from(await host.readFile('/remote/other')).toString(), 'readable');
}));

test('recording Host observes default operations while scoped observers keep their own receipts', async t => fakeOnlyFixture(t, async root => {
  const calls: string[] = [];
  const host = recordingHost(root, {record: operation => calls.push(operation), overrides: {
    run: async () => { calls.push('scoped-run'); return {code: 0, stdout: '', stderr: ''}; },
  }});
  await host.writeFile(join(root, 'file'), Buffer.from('bytes'));
  await host.readFile(join(root, 'file'));
  await host.run({command: 'fake', args: [], cwd: root, env: {}});
  assert.deepEqual(calls, ['writeFile', 'readFile', 'scoped-run']);
}));

test('recording Host accepts its scratch alias and canonical file receipts', async t => fakeOnlyFixture(t, async root => {
  const storage = join(root, 'storage'), alias = join(root, 'alias');
  await mkdir(storage); await symlink(storage, alias, 'dir');
  const host = recordingHost(alias);
  await host.writeFile(join(alias, 'file'), Buffer.from('owned'));
  const canonical = await host.realpath(join(alias, 'file'));
  assert.equal(canonical, join(storage, 'file'));
  assert.equal(Buffer.from(await host.readFile(canonical)).toString(), 'owned');
}));
