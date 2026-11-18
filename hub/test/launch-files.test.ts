// T2: recording Host file operations and legacy rollback, no native children or hub.
import { testWaitMs } from './until.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LaunchFiles } from '../src/adapters/launch-files.ts';
import { localHost } from '../src/host/local.ts';
import { testHost } from '../src/host/test-host.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { recordingHost } from './recording-host.ts';

test('LaunchFiles routes directory, write, restore, truncate and removal through its Host', async t => {
  const root = await tempProject(t);
  const local = recordingHost(root);
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

test('test Host stat requires explicit local file delegation', async t => {
  const root = await tempProject(t);
  const file = join(root, 'metadata');
  await writeFile(file, 'bytes', {mode: 0o640});
  const local = localHost(fixtureEnvironment(root, process.env));
  const host = testHost('metadata-double', () => {});
  await assert.rejects(host.stat(file), /refuses stat/);
  await assert.rejects(({...host, fileType: async () => 'file' as const}).stat(file), /refuses stat/);
  await assert.rejects(({...host, fileType: local.fileType, writeFile: local.writeFile}).stat(file), /refuses stat/);
  await assert.rejects(({...host, fileType: local.fileType, removePath: local.removePath}).stat(file), /refuses stat/);
  const delegated = {...host, fileType: local.fileType, writeFile: local.writeFile, removePath: local.removePath};
  assert.deepEqual(await delegated.stat(file), await local.stat(file));
  await assert.rejects(delegated.stat(join(root, 'missing')), {code: 'ENOENT'});
  await assert.rejects(delegated.appendFile(file, Buffer.from('refused')), /refuses appendFile/);
  await assert.rejects(delegated.publishFile(file, Buffer.from('refused')), /refuses publishFile/);
  assert.equal(await readFile(file, 'utf8'), 'bytes');
});

import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
test('remote LaunchFiles reads only Host metadata and bytes while the hub mirror stays unread', async t => {
  const root = await tempProject(t), mirror = join(root, 'hub-file'), storage = join(root, 'remote'), remote = join(storage, 'hub-file');
  await mkdir(storage);
  await writeFile(mirror, 'hub-only', {mode: 0o644});
  await writeFile(remote, 'remote-before', {mode: 0o640});
  const nativeRead = fsp.readFile, nativeStat = fsp.stat;
  let mirrorReads = 0;
  t.mock.method(fsp, 'readFile', (...args: Parameters<typeof fsp.readFile>) => {
    if (String(args[0]) === mirror) { mirrorReads++; throw new Error('hub mirror read forbidden'); }
    return Reflect.apply(nativeRead, fsp, args);
  });
  t.mock.method(fsp, 'stat', (...args: Parameters<typeof fsp.stat>) => {
    if (String(args[0]) === mirror) { mirrorReads++; throw new Error('hub mirror stat forbidden'); }
    return Reflect.apply(nativeStat, fsp, args);
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  assert.throws(() => fsp.stat(mirror), /hub mirror stat forbidden/);
  assert.throws(() => fsp.readFile(mirror), /hub mirror read forbidden/);
  assert.equal(mirrorReads, 2, 'positive controls reach both native mirror guards');
  mirrorReads = 0;
  const base = recordingHost(storage, {sourceRoot: root});
  const mapped = (path: string) => { assert.equal(path, mirror); return path; };
  const host = {...base, name: 'remote', stat: (path: string) => base.stat(mapped(path)),
    readFile: (path: string) => base.readFile(mapped(path)),
    writeFile: (path: string, bytes: Uint8Array, options?: Parameters<typeof base.writeFile>[2]) => base.writeFile(mapped(path), bytes, options)};
  const files = new LaunchFiles(undefined, host);
  await files.write(mirror, Buffer.from('remote-after'), 0o600);
  assert.equal(await nativeRead(remote, 'utf8'), 'remote-after');
  await files.rollback();
  assert.equal(await nativeRead(remote, 'utf8'), 'remote-before');
  assert.equal((await nativeStat(remote)).mode & 0o777, 0o640);
  assert.equal(mirrorReads, 0);
  assert.equal(await nativeRead(mirror, 'utf8'), 'hub-only');
  assert.equal((await nativeStat(mirror)).mode & 0o777, 0o644);
});

test('rollback bounds a missing native exit receipt and fences undo and repeated stop until it resolves', {timeout:8 * testWaitMs() + 1000}, async t => {
  const {beforeDirectories}=await import('./process-cleanup.ts');
  const root=await tempProject(t);const env=fixtureEnvironment(root,process.env);
  const exit=Promise.withResolvers<{code:number|null;signal:string|null}>();let stops=0;
  const host={...recordingHost(root),identity:async(pid:number)=>({pid,pidStarted:'start',pidIdentity:'birth'}),stop:async()=>{stops++;return true;}};
  const files=new LaunchFiles(undefined,host,10);
  const owned=join(root,'owned');await files.write(owned,Buffer.from('retained'));
  files.spawned({pid:987654,exited:exit.promise},()=>{},50);
  let flight:Promise<void>|undefined;
  beforeDirectories(t,async()=>{exit.resolve({code:0,signal:null});await flight?.catch(()=>{});await files.rollback();});
  flight=files.rollback();
  const concurrent=files.rollback();
  await Promise.all([assert.rejects(flight,/cleanup-incomplete.*native exit receipt.*10 ms/),assert.rejects(concurrent,/cleanup-incomplete.*native exit receipt.*10 ms/)]);
  const pending=await files.snapshot();assert.equal(pending.children.length,1);assert.equal(pending.undo.length,1);
  assert.equal(await readFile(owned,'utf8'),'retained');assert.equal(stops,1);
  await assert.rejects(files.rollback(),/cleanup-incomplete.*native exit receipt.*10 ms/);
  assert.equal(stops,1,'missing exit receipt cannot repeat a signal-producing stop');
  assert.equal(await readFile(owned,'utf8'),'retained');
  exit.resolve({code:0,signal:null});await files.rollback();
  assert.deepEqual(await files.snapshot(),{children:[],undo:[]});assert.equal(stops,1);
  await assert.rejects(readFile(owned),{code:'ENOENT'});
});
