// T2: native Unix listener allocation and close under a deep, multibyte TMPDIR; no child or hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, stat, access, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { tempProject } from './harness.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { removeFixtureSockets, enableFixtureHostSockets, fixtureHostSocketDirectory } from '../../shared/fixture-sockets.ts';
import { dirname } from 'node:path';
import { hostPaths } from '../src/host/records.ts';
import { layout } from '../src/project.ts';
import { writeFile, readFile, lstat, symlink } from 'node:fs/promises';
import { basename } from 'node:path';
import { fixtureOwnership, registerFixtureOwnership, readFixtureReceipt } from '../../shared/fixture-ownership.ts';
import { ownDirectory, onCleanup } from './process-cleanup.ts';
import { residueControl } from './fixture-residue-control.ts';
import cp from 'node:child_process';
import { within } from '../src/executor/droplet/deadline.ts';
import { testWaitMs } from './until.ts';
import { removeWorktreeWithFixtures, type FixtureProcesses } from '../src/fixture-processes.ts';
import fsPromises from 'node:fs/promises';
import { recoveryScanOwner } from './recovery-scan.ts';
import { syncBuiltinESMExports } from 'node:module';

test('recovery scan guarded removal joins a cancelled held scan and writer',async t=>{
 const listed=Promise.withResolvers<void>(),releaseScan=Promise.withResolvers<void>(),removing=Promise.withResolvers<void>();
 let root='',held=false,releaseObserved=false,remove:(()=>Promise<void>)|undefined;
 const owner=recoveryScanOwner(t,{
   beforeRead:async path=>{if(path.endsWith('.new-held')){held=true;listed.resolve();await releaseScan.promise;}},
   releaseOnClose:()=>{
     try{if(held){
       assert.equal(statSync(root).isDirectory(),true,'root remains while original scan is held');
       assert.equal(owner.writerClosed(),false,'no writer-close receipt inferred from release');
       releaseObserved=true;
     }}finally{releaseScan.resolve();}
   },
 });
 const sequence=owner.scope.run(async admit=>{
   root=await owner.scope.wait('scan control root setup',()=>admit(()=>tempProject(owner.scope.fixtures)));
   guardDirectoryRemoval(root,async()=>{removing.resolve();});owner.adoptRoot(root);
   remove=ownDirectory(undefined,root);
   await admit(()=>owner.scan([root],'absent-credential'));
 });
 const failed=assert.rejects(sequence,/fixture work admission closed/);void failed.catch(()=>{});
 await within(listed.promise,testWaitMs(),undefined,()=>new Error('scan listing receipt missing'));
 const removal=remove!();void removal.catch(()=>{});
 await within(removing.promise,testWaitMs(),undefined,()=>new Error('guarded removal entry missing'));
 await removal;await failed;
 assert.equal(releaseObserved,true,'guarded removal observed the retained root before releasing the scan');
 assert.equal(owner.writerClosed(),true,'writer closed before guarded removal completed');
 await assert.rejects(stat(root),{code:'ENOENT'});
});

test('recovery scan retains its primary failure and root after rejected writer close',async t=>{
 const scanFailure=new Error('planted credential scan failure'),closeFailure=new Error('planted writer close failure');
 let rejectClose=true,root='',remove:(()=>Promise<void>)|undefined;
 const owner=recoveryScanOwner(t,{
   beforeRead:async()=>{throw scanFailure;},
   afterWriterJoin:async()=>{if(rejectClose)throw closeFailure;},
 });
 await assert.rejects(owner.scope.run(async admit=>{
   root=await owner.scope.wait('rejected close root setup',()=>admit(()=>tempProject(owner.scope.fixtures)));
   owner.adoptRoot(root);remove=ownDirectory(undefined,root);
   await admit(()=>owner.scan([root],'absent-credential'));
 }),error=>{
   assert.ok(error instanceof AggregateError);
   assert.equal(error.cause,error.errors[0]);
   assert.equal(error.errors[0].cause,scanFailure,'selected scan failure remains primary');
   assert.equal(error.errors[1].cause,closeFailure,'drain rejection is secondary');return true;
 });
 await assert.rejects(remove!(),/scan writer close unconfirmed/);
 assert.equal((await stat(root)).isDirectory(),true,'actual removal guard retains root after rejected close');
 assert.equal(owner.writerClosed(),false);
 rejectClose=false;await owner.closeWriter();assert.equal(owner.writerClosed(),true);
 await remove!();await assert.rejects(stat(root),{code:'ENOENT'});
});
import fs from 'node:fs';
import { readdir } from 'node:fs/promises';

test('optional registration refuses an unowned root without creating cleanup authority', t => residueControl(t).run(async c => {
  const root = await c.root();
  const source = await realpath(new URL('../../', import.meta.url).pathname);
  assert.deepEqual(registerFixtureOwnership([source]), { outcome: 'refused', diagnostic: {
    event: 'fixture-ownership-refused', outcome: 'refused', root: source, reason: 'unowned-root', nativeCode: null, cleanupCodes: [],
  } });
  const positive = registerFixtureOwnership([root]);
  assert.equal(positive.outcome, 'registered');
  if (positive.outcome !== 'registered') throw new Error('positive registration was refused');
  const owner = c.own(positive.owner, receipt => receipt.close());
  assert.deepEqual((await c.step('positive persisted receipt', () => readFixtureReceipt(owner.value.path)))?.roots, [root]);
}));

test('registration canonicalizes aliases of an allocated scratch root', t => residueControl(t).run(async c => {
  const parent = await c.root(), root = join(parent, 'owned'), alias = join(parent, 'alias');
  await c.step('scratch alias setup', async () => { await mkdir(root); await symlink(root, alias); });
  const aliases = [alias, ...(root.startsWith('/private/var/') ? [root.replace('/private/var/', '/var/')] : [])];
  for (const path of aliases) {
    const owner = await c.acquire('aliased registration', () => fixtureOwnership([path]), receipt => receipt.close());
    assert.deepEqual((await c.step('canonical receipt read', () => readFixtureReceipt(owner.value.path)))?.roots, [root]);
  }
}));

test('a refused initial receipt write closes its descriptor and removes its partial receipt', t => residueControl(t).run(async c => {
  const root = await c.root();
  const seed = await c.acquire('storage positive control', () => fixtureOwnership([root]), receipt => receipt.close());
  await c.step('seed closure', seed.close);
  seed.value.remove();
  const original = fs.writeSync;
  const restore = () => { fs.writeSync = original; syncBuiltinESMExports(); };
  c.restore(restore);
  let failedFd: number | undefined;
  fs.writeSync = ((fd: number) => { failedFd = fd; throw Object.assign(new Error('planted write failure'), { code: 'ENOSPC' }); }) as typeof fs.writeSync;
  syncBuiltinESMExports();
  const refusal = registerFixtureOwnership([root]);
  restore();
  assert.deepEqual(refusal, { outcome: 'refused', diagnostic: {
    event: 'fixture-ownership-refused', outcome: 'refused', root, reason: 'receipt-write-failed', nativeCode: 'ENOSPC', cleanupCodes: [],
  } });
  assert.notEqual(failedFd, undefined, 'positive control: the initial receipt write was reached');
  assert.throws(() => fs.fstatSync(failedFd!), { code: 'EBADF' });
  assert.deepEqual(await c.step('partial receipt removal observation', () => readdir(join(root, '.fixture-sockets/owners'))), []);
  assert.equal((await c.step('independent root preservation receipt', () => lstat(root))).isDirectory(), true);
}));

test('source association joins scratch writers without granting source directory cleanup', t => residueControl(t).run(async c => {
  const parent = await c.root(), root = join(parent, 'scratch'), source = join(parent, 'checkout');
  await c.step('separate roots setup', async () => { await mkdir(root); await mkdir(source); await writeFile(join(source, 'keep'), 'source remains'); });
  const originalOpen = fsPromises.opendir;
  const visited: string[] = [];
  const restore = () => { fsPromises.opendir = originalOpen; syncBuiltinESMExports(); };
  c.restore(restore);
  fsPromises.opendir = async (...args) => { visited.push(String(args[0])); return originalOpen(...args); };
  syncBuiltinESMExports();
  await c.step('traversal observer positive control', async () => { const dir = await fsPromises.opendir(source); await dir.close(); });
  assert.deepEqual(visited, [source]);
  visited.length = 0;
  const owner = await c.acquire('associated receipt setup', () => fixtureOwnership([root], source), receipt => receipt.close());
  const started = new Date().toString(), born = Date.parse(started);
  owner.value.bind(101, born, born);
  const row = { pid: 101, parent: 1, group: 101, state: 'S', started, command: 'node /fixture/stub-hub.ts' };
  let rows = [row], joined = false, removed = false;
  const readers: FixtureProcesses = {
    rows: async () => rows, paths: async () => ({ cwd: root, files: [owner.value.path] }), sameUser: async () => true, missing: () => false,
    end: async (_identity, _log, _grace, beforeSignal, options) => { await beforeSignal?.(); assert.equal(options?.canSignal?.(rows), true); rows = []; joined = true; return true; },
  };
  await c.step('authorized source worktree removal', () => removeWorktreeWithFixtures(source, async () => { assert.equal(joined, true); removed = true; }, readers));
  assert.equal(removed, true);
  await c.step('receipt close', owner.close);
  await c.step('guarded scratch directory removal', () => ownDirectory(undefined, root)());
  assert.ok(visited.includes(root), 'positive control: actual scratch cleanup traversed its root');
  assert.equal(visited.some(path => path === source || path.startsWith(source + '/')), false, 'no source metadata traversal');
  restore();
  await c.step('scratch removal receipt', () => assert.rejects(lstat(root), { code: 'ENOENT' }));
  assert.equal(await c.step('independent source preservation receipt', () => readFile(join(source, 'keep'), 'utf8')), 'source remains');
}));

test('registration refuses the source worktree and cleanup ignores a forged source root', t => residueControl(t).run(async c => {
  const root = await c.root();
  const source = await realpath(new URL('../../', import.meta.url).pathname);
  let unexpected: ReturnType<typeof fixtureOwnership> | undefined;
  try {
    assert.throws(() => { unexpected = fixtureOwnership([root, source]); }, /fixture-owned scratch root/);
  } finally { unexpected?.close(); unexpected?.remove(); }
  const escape = join(root, 'source-link');
  await c.step('source link setup', () => symlink(source, escape));
  assert.throws(() => fixtureOwnership([root, escape]), /fixture-owned scratch root/);
  const owner = await c.acquire('valid receipt', () => fixtureOwnership([root]), value => value.close());
  await c.step('receipt close', owner.close);
  const original = await c.step('receipt bytes', () => readFile(owner.value.path, 'utf8'));
  await c.step('forged root', () => writeFile(owner.value.path, JSON.stringify({ ...JSON.parse(original), roots: [root, source] })));
  assert.equal(await c.step('forged receipt refusal', () => readFixtureReceipt(owner.value.path)), null);
}));

test('previous local receipt shape retains scratch selection without inventing source association', t => residueControl(t).run(async c => {
  const parent = await c.root(), root = join(parent, 'scratch'), source = join(parent, 'source');
  await c.step('legacy roots setup', async () => { await mkdir(root); await mkdir(source); });
  const owner = await c.acquire('legacy receipt setup', () => fixtureOwnership([root]), receipt => receipt.close());
  const started = new Date().toString(), born = Date.parse(started);
  owner.value.bind(101, born, born);
  let live = true;
  const row = { pid: 101, parent: 1, group: 101, state: 'S', started, command: 'node /fixture/stub-hub.ts' };
  const readers: FixtureProcesses = {
    rows: async () => live ? [row] : [], paths: async () => ({ cwd: root, files: [owner.value.path] }), sameUser: async () => true, missing: () => false,
    end: async () => { live = false; return true; },
  };
  assert.equal((await c.step('previous receipt read', () => readFixtureReceipt(owner.value.path)))?.sourceCheckout, undefined);
  await c.step('unassociated source removal', () => removeWorktreeWithFixtures(source, async () => { assert.equal(live, true); }, readers));
  await c.step('legacy scratch removal positive control', () => removeWorktreeWithFixtures(root, async () => { assert.equal(live, false); }, readers));
}));

for (const failure of ['cancelled acquisition', 'setup rejection', 'cancelled body observation']) test(`residue control retains root and native guard through ${failure}`, async t => {
  const originalSpawn = cp.spawn;
  const entered = Promise.withResolvers<void>(), releaseAcquire = Promise.withResolvers<void>();
  const closingEntered = Promise.withResolvers<void>(), releaseClose = Promise.withResolvers<void>();
  const resourceCompletion = Promise.withResolvers<void>();
  const owner = residueControl(t);
  owner.release(() => releaseAcquire.resolve());
  onCleanup(t, () => releaseClose.resolve()); // Driver failures cannot strand the deliberately held close.
  let root = '', resourceClosed = false, laterBody = false;
  const sequence = owner.run(async c => {
    root = await c.root();
    await c.acquire('controlled acquisition setup', async () => {
      if (failure !== 'cancelled body observation') entered.resolve();
      if (failure === 'cancelled acquisition') await releaseAcquire.promise;
      return {};
    }, async () => {
      closingEntered.resolve();
      await releaseClose.promise;
      assert.equal((await lstat(root)).isDirectory(), true, 'root survives until positive resource closure');
      const receipt = join(root, 'resource.closed');
      await writeFile(receipt, 'closed');
      assert.equal(await readFile(receipt, 'utf8'), 'closed');
      resourceClosed = true;
      resourceCompletion.resolve();
    });
    if (failure === 'setup rejection') throw new Error('planted setup rejection');
    if (failure === 'cancelled body observation') await c.step('original body close observation', async () => {
      entered.resolve();
      await resourceCompletion.promise;
    });
    await c.step('later body admission', async () => { laterBody = true; });
  });
  const failed = assert.rejects(sequence, failure === 'setup rejection' ? /planted setup rejection/ : /fixture work admission closed/);
  void failed.catch(() => {});
  await within(entered.promise, testWaitMs(5000), undefined, () => new Error('controlled acquisition setup receipt missing'));
  const closing = owner.close();
  await within(closingEntered.promise, testWaitMs(5000), undefined, () => new Error('resource close setup receipt missing'));
  assert.equal((await lstat(root)).isDirectory(), true);
  assert.notEqual(cp.spawn, originalSpawn, 'the positively controlled guard remains installed while resource closure is held');
  releaseClose.resolve();
  await closing; await failed;
  assert.equal(resourceClosed, true);
  assert.equal(laterBody, false);
  await assert.rejects(lstat(root), { code: 'ENOENT' });
  assert.equal(cp.spawn, originalSpawn, 'guard restoration follows observed root removal');
});

test('receipt readers and guarded cleanup refuse a foreign ownership directory link', t => residueControl(t).run(async c => {
  const parent = await c.root(), source = join(parent, 'source'), target = join(parent, 'target');
  await c.step('source directory setup', () => mkdir(source));
  await c.step('foreign directory setup', () => mkdir(join(target, '.fixture-sockets'), { recursive: true, mode: 0o700 }));
  const owner = await c.acquire('receipt setup', () => fixtureOwnership([source]), receipt => receipt.close());
  const receipt = owner.value;
  await c.step('receipt descriptor closure', owner.close);
  const original = await c.step('original receipt read', () => readFile(receipt.path, 'utf8'));
  await c.step('foreign metadata setup', () => writeFile(receipt.path, JSON.stringify({ ...JSON.parse(original), roots: [target] })));
  assert.equal(await c.step('foreign metadata refusal', () => readFixtureReceipt(receipt.path)), null);
  await c.step('original receipt restoration', () => writeFile(receipt.path, original));
  await c.step('foreign link setup', () => symlink(join(source, '.fixture-sockets/owners'), join(target, '.fixture-sockets/owners')));
  assert.equal(await c.step('foreign link refusal', () => readFixtureReceipt(join(target, '.fixture-sockets/owners', basename(receipt.path)))), null);
  const targetOwner = await c.acquire('target removal owner setup', () => ownDirectory(undefined, target), remove => remove(), { afterJoin: true });
  await c.step('guarded target removal', targetOwner.close);
  assert.equal((await c.step('foreign receipt preservation', () => lstat(receipt.path))).isFile(), true);
  assert.equal((await c.step('original receipt acceptance', () => readFixtureReceipt(receipt.path)))?.pid, process.pid);
}));

test('guarded root cleanup removes receipts left by a failed owner', t => residueControl(t).run(async c => {
  const parent = await c.root(), root = join(parent, 'owner');
  await c.step('owner directory setup', () => mkdir(root));
  const owner = await c.acquire('receipt setup', () => fixtureOwnership([root]), receipt => receipt.close());
  const receipt = owner.value;
  const removal = await c.acquire('removal owner setup', () => ownDirectory(undefined, root), remove => remove(), { afterJoin: true });
  assert.ok(receipt.path.startsWith(root + '/'), receipt.path);
  assert.equal((await c.step('receipt acceptance', () => readFixtureReceipt(receipt.path)))?.pid, process.pid);
  assert.equal((await c.step('previous local wire shape acceptance', () => readFixtureReceipt(receipt.path)))?.sourceCheckout, undefined);
  await c.step('failed owner descriptor closure', owner.close); // Leave its file for the directory owner.
  await c.step('guarded owner root removal', removal.close);
  await c.step('receipt removal observation', () => assert.rejects(lstat(receipt.path), { code: 'ENOENT' }));
}));

test('project fallback endpoints and failed socket placeholders stay in the disposable root', t => residueControl(t).run(async c => {
  const root = await c.root('residue-', '/tmp');
  const deep = join(root, 'deep'.repeat(40));
  await c.step('deep directory setup', () => mkdir(deep));
  let disable: (() => void) | undefined;
  c.restore(() => disable?.());
  await c.step('socket opt-in setup', async () => { disable = enableFixtureHostSockets(deep); });
  const previous = process.env.TMPDIR;
  c.restore(() => { if (previous === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previous; });
  process.env.TMPDIR = root;
  const paths = await c.step('fallback path allocation', async () => layout(deep));
  for (const path of [paths.socket, paths.spokeSocket]) {
    await c.step('placeholder write', () => writeFile(path, 'failed listener placeholder'));
    assert.equal((await c.step('placeholder creation receipt', () => lstat(path))).isFile(), true);
  }
  await c.step('socket ownership disposal', () => removeFixtureSockets(root));
  for (const path of [paths.socket, paths.spokeSocket]) await c.step('placeholder removal observation', () => assert.rejects(lstat(path), { code: 'ENOENT' }));
}));

test('root disposal retires discarded nested host socket opt-ins before any allocation', async t => {
  const parent=await tempProject(t), nested=join(parent,'nested');
  await mkdir(nested);
  enableFixtureHostSockets(nested); // Deliberately discard the per-call disposer.
  await removeFixtureSockets(parent);
  assert.equal(fixtureHostSocketDirectory(nested,'unused'),undefined,'disposed opt-in cannot allocate new fixture storage');
});

test('a newer host socket opt-in survives completion of an older disposal', async t => {
  const parent=await tempProject(t),nested=join(parent,'replacement');
  await mkdir(nested);
  enableFixtureHostSockets(nested);
  const disposing=removeFixtureSockets(parent);
  enableFixtureHostSockets(nested);
  await disposing;
  assert.notEqual(fixtureHostSocketDirectory(nested,'fresh'),undefined,'old disposal must not retire the replacement grant');
});

test('suite disposal removes reciprocal aliases nested inside fake host storage', async t => {
  const root = await tempProject(t);
  const outer = fixtureSocketPath(root, 'outer');
  const nested = join(dirname(outer), 'machine');
  await mkdir(nested);
  const physical = await realpath(nested);
  const inner = fixtureSocketPath(physical, 'inner');
  await access(dirname(inner));
  try {
    await removeFixtureSockets(root);
    await assert.rejects(access(dirname(inner)), {code:'ENOENT'});
  } finally { await removeFixtureSockets(physical); }
});

test('scratch host sockets bind under deep roots within the shortest macOS path budget', async t => {
  const root = await tempProject(t), deep = join(root, 'é'.repeat(60));
  await mkdir(deep);
  enableFixtureHostSockets(deep);
  const paths = hostPaths(deep, 'host');
  assert.notEqual(paths.agentSocket, hostPaths(deep, 'other').agentSocket);
  await mkdir(paths.socketDirectory, {mode:0o700});
  for (const path of [paths.agentSocket, paths.gitSocket, paths.controlSocket, paths.sessionSocket('long'.repeat(100))]) {
    assert.ok(Buffer.byteLength(path)+1 <=104, path);
    const server = createServer();
    try {
      const listening = once(server,'listening'); server.listen(path); await listening;
      assert.equal((await stat(path)).isSocket(), true);
    } finally {
      if(server.listening){const closed=once(server,'close');server.close();await closed;}
    }
  }
  assert.ok(Buffer.byteLength(paths.controlSocket)+1+20 <=104, 'SSH control suffix budget');
});

test('fixture socket binds within the macOS byte budget under a deep multibyte TMPDIR', async t => {
  const root = await tempProject(t);
  const deep = join(root, 'é'.repeat(60));
  await mkdir(deep);
  assert.ok(Buffer.byteLength(deep) >= 90);
  const previous = process.env.TMPDIR;
  process.env.TMPDIR = deep;
  const server = createServer();
  beforeDirectories(t, async () => {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    if (server.listening) {
      const closed = once(server, 'close', { signal: AbortSignal.timeout(5000) });
      server.close();
      await closed;
    }
  });
  const path = fixtureSocketPath(deep, '端'.repeat(60) + '.sock');
  assert.ok(Buffer.byteLength(path) + 1 < 104, path);
  assert.equal(fixtureSocketPath(deep, '端'.repeat(60) + '.sock'), path);
  assert.notEqual(fixtureSocketPath(deep, 'other.sock'), path);
  assert.notEqual(fixtureSocketPath(root, '端'.repeat(60) + '.sock'), path);
  const listening = once(server, 'listening', { signal: AbortSignal.timeout(5000) });
  server.listen(path);
  await listening;
  assert.equal((await stat(path)).isSocket(), true);
});

test('fixture sockets have private directory ownership after normal listener close', async t => {
  const root = await tempProject(t);
  const path = fixtureSocketPath(root, 'private.sock');
  const { dirname } = await import('node:path');
  assert.equal((await stat(dirname(path))).mode & 0o777, 0o700);
});

test('fake host socket guard names oversized paths before native connect', async () => {
  const { fakeHostSocketPath } = await import('./fakes/fake-host-socket.ts');
  for (const home of ['/' + 'x'.repeat(104), '/' + 'é'.repeat(45)]) {
    const path = join(home, '.cland-host/run/agent.sock');
    assert.throws(() => fakeHostSocketPath(home), error => {
      assert.match((error as Error).message, /104-byte/);
      assert.ok((error as Error).message.includes(path));
      return true;
    });
  }
  const suffix = '/.cland-host/run/agent.sock';
  const home = '/' + 'x'.repeat(104 - 1 - suffix.length - 1);
  assert.equal(Buffer.byteLength(fakeHostSocketPath(home)) + 1, 104);
  assert.throws(() => fakeHostSocketPath(home + 'x'), /104-byte/);
});

test('fake host setup guards long names and retains short paths across independent readers', async t => {
  const { createFakeHost, fakeHost, hostDirectory, hostPath } = await import('./fakes/fake-host.ts');
  const root = await tempProject(t);
  const name = 'x'.repeat(104);
  const oversized = join(hostDirectory(root, name), 'home', '.cland-host/run/agent.sock');
  await assert.rejects(createFakeHost(root, name), error => {
    assert.ok((error as Error).message.includes(oversized));
    return true;
  });
  const host = await createFakeHost(root, 'one');
  assert.ok(Buffer.byteLength(join(host.run, 'agent.sock')) + 1 <= 104);
  const reader = await fakeHost({ CLAND_FAKE_HOST_ROOT: root, CLAND_FAKE_HOSTS: 'one' }, 'one');
  assert.equal(reader.home, host.home);
  assert.equal(await hostPath(host.home, '.cland-host/run/agent.sock'), join(host.run, 'agent.sock'));
  await assert.rejects(hostPath(host.home, '../escape'), /escapes home/);
});
