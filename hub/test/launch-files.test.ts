// T2: recording Host file operations and legacy rollback, no native children or hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LaunchFiles } from '../src/adapters/launch-files.ts';
import { localHost } from '../src/host/local.ts';
import { testHost } from '../src/host/test-host.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('LaunchFiles routes directory, write, restore, truncate and removal through its Host', async t => {
  const root = await tempProject(t);
  const local = localHost(fixtureEnvironment(root, process.env));
  const calls: string[] = [];
  const host = {
    ...local,
    makeDirectory: async (...args: Parameters<typeof local.makeDirectory>) => { calls.push('mkdir'); return local.makeDirectory(...args); },
    writeFile: async (...args: Parameters<typeof local.writeFile>) => { calls.push(args[2]?.truncate === undefined ? 'write' : 'truncate'); return local.writeFile(...args); },
    removePath: async (...args: Parameters<typeof local.removePath>) => { calls.push(args[1]?.directory ? 'rmdir' : 'remove'); return local.removePath(...args); },
    readFile: async (path: string) => { calls.push('read'); return local.readFile(path); },
  };
  const existing = join(root, 'existing');
  const log = join(root, 'log');
  await writeFile(existing, Buffer.from([0, 255]), { mode: 0o640 });
  await writeFile(log, 'old');
  const files = new LaunchFiles(work => work(), host);
  await files.directory(join(root, 'new', 'nested'), 0o700);
  await files.directory(join(root, 'new'), 0o700);
  await files.write(join(root, 'new', 'nested', 'file'), Buffer.from('new'), 0o600);
  await files.write(existing, Buffer.from('replacement'), 0o600);
  await files.file(log, true);
  await host.writeFile(log, Buffer.from('old appended'));
  const state = await files.snapshot();
  // The persisted journal remains the previous wire shape and is recoverable after restart.
  await LaunchFiles.restore(JSON.parse(JSON.stringify(state)), work => work(), host).rollback();
  assert.deepEqual(await readFile(existing), Buffer.from([0, 255]));
  assert.equal((await stat(existing)).mode & 0o777, 0o640);
  assert.equal(await readFile(log, 'utf8'), 'old');
  assert.equal(await local.fileType(join(root, 'new')), 'missing');
  for (const operation of ['mkdir', 'write', 'read', 'truncate', 'remove', 'rmdir']) assert.ok(calls.includes(operation), operation);
});

test('LaunchFiles recovers a pre-change pending-stop journal through the Host', async t => {
  const root = await tempProject(t);
  const path = join(root, 'old-log');
  await writeFile(path, 'old appended');
  const host = localHost(fixtureEnvironment(root, process.env));
  const files = LaunchFiles.restore({ undo: [{ kind: 'truncate', path, size: 3 }], children: [] }, work => work(), host);
  await files.rollback();
  assert.equal(await readFile(path, 'utf8'), 'old');
  assert.deepEqual(await files.snapshot(), { undo: [], children: [] });
});

test('test Host refuses every added mutation and endpoint operation by name', async () => {
  const records: Record<string, unknown>[] = [];
  const host = testHost('remote-test', entry => { records.push(entry); });
  const operations = {
    writeFile: () => host.writeFile('/unused', new Uint8Array()),
    makeDirectory: () => host.makeDirectory('/unused'),
    removePath: () => host.removePath('/unused'),
    freePort: () => host.freePort(),
    forward: () => host.forward('s', { port: 123 }),
    unforward: () => host.unforward('s'),
  };
  for (const [name, operation] of Object.entries(operations)) {
    await assert.rejects(operation(), { message: `test host remote-test refuses ${name}` });
  }
  assert.throws(() => host.layout({ discoveryFile: '', node: '', cli: '', spoke: '' }), /refuses layout/);
  assert.deepEqual(records.map(row => row.operation), [...Object.keys(operations), 'layout']);
});
