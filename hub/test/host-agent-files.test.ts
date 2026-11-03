// T3: Unix agent file RPC, native short commands and Git worktrees require real OS boundaries.
// Lifecycle: scratch HOME/Git environment; RPC completion and server drain before fixture removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { serveAgent } from '../src/host/agent/server.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { localHost } from '../src/host/local.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

type Agent = Awaited<ReturnType<typeof serveAgent>>;
async function fixture(t: test.TestContext, connect: (server: Agent) => Promise<AgentClient> = server => AgentClient.connect(server.socket, 'synthetic')) {
  const root = await mkdtemp(join(tmpdir(), 'agent-files-'));
  let server: Agent | undefined;
  let client: AgentClient | undefined;
  let setup = Promise.resolve();
  let closing: Promise<void> | undefined;
  const cleanup = () => closing ??= (async () => {
    // Teardown can run on test cancellation while acquisition is still pending.
    await setup.catch(() => {});
    await client?.close();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  })();
  t.after(cleanup);
  const boot = join(root, 'boot');
  const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: 'f1,f2', CLAND_FAKE_HOST_ROOT: root, CLAND_HOST_BOOT_ID_FILE: boot });
  setup = (async () => {
    await writeFile(boot, '11111111-1111-1111-1111-111111111111');
    server = await serveAgent({ runDir: join(root, 'run'), secret: 'synthetic', version: 'test', env });
    client = await connect(server);
  })();
  try { await setup; }
  catch (error) { await cleanup(); throw error; }
  assert.ok(client);
  const connected = client;
  return { root, env, local: localHost(env), rpc: (op: string, args: Record<string, unknown>) => connected.request(op, args) };
}

test('agent C1/C2 file reads match local and transfer exact bounded bytes', { timeout: 10000 }, async t => {
  const {root, local, rpc} = await fixture(t);
  const folder = join(root, 'folder'); await mkdir(folder); await mkdir(join(folder, 'nested'));
  const path = join(folder, 'nested', 'bytes'); const bytes = Buffer.from(Array.from({length: 256}, (_, n) => n)); await writeFile(path, bytes);
  for (const path of [folder, join(root, 'absent'), join(folder, 'nested', 'bytes')]) {
    assert.deepEqual(await rpc('statDirectory', {path}), await local.statDirectory(path));
    assert.equal(await rpc('realpath', {path}), await local.realpath(path));
    assert.equal(await rpc('fileType', {path}), await local.fileType(path));
  }
  assert.deepEqual(await rpc('listFolder', {path: folder}), await local.listFolder(folder));
  assert.deepEqual(Buffer.from(await rpc('readFile', {path}) as string, 'base64'), await local.readFile(path));
  await assert.rejects(rpc('readFile', {path: folder}), /regular file/);
  await assert.rejects(rpc('readFile', {path: join(root, 'absent')}), /ENOENT/);
  const cap = join(root, 'cap'); const capBytes = Buffer.alloc(512 * 1024, 255);
  await rpc('writeFile', {path: cap, bytes: capBytes.toString('base64')});
  assert.deepEqual(Buffer.from(await rpc('readFile', {path: cap}) as string, 'base64'), capBytes);
  await assert.rejects(rpc('writeFile', {path: cap, bytes: 'a==='}), /base64/);
  const large = join(root, 'large'); await writeFile(large, Buffer.alloc(512 * 1024 + 1));
  await assert.rejects(rpc('readFile', {path: large}), /cap/);
  await symlink(folder, join(root, 'alias'));
  assert.equal(await rpc('fileType', {path: join(root, 'alias')}), 'symlink');
  await assert.rejects(rpc('listFolder', {path: join(root, 'alias')}), /symbolic links/);
});

test('agent C3 mutations preserve modes, single-path and symlink boundaries; freePort releases loopback', { timeout: 10000 }, async t => {
  const {root, rpc} = await fixture(t);
  const path = join(root, 'dir'); await rpc('makeDirectory', {path, mode: 0o700});
  assert.equal((await stat(path)).mode & 0o777, 0o700);
  const file = join(path, 'file'); const bytes = Buffer.from([0, 255, 128, 10]);
  await rpc('writeFile', {path: file, bytes: bytes.toString('base64'), options: {mode: 0o600}});
  assert.deepEqual(await readFile(file), bytes); assert.equal((await stat(file)).mode & 0o777, 0o600);
  await rpc('writeFile', {path: file, bytes: '', options: {mode: 0o640, truncate: 2}});
  assert.equal((await stat(file)).mode & 0o777, 0o640); assert.deepEqual(await readFile(file), bytes.subarray(0, 2));
  await assert.rejects(rpc('removePath', {path, options: {directory: true}}), /ENOTEMPTY|EEXIST/);
  const alias = join(root, 'alias'); await symlink(path, alias);
  await rpc('removePath', {path: alias}); assert.deepEqual(await readFile(file), bytes.subarray(0, 2));
  await rpc('removePath', {path: file}); await rpc('removePath', {path, options: {directory: true}});
  const port = await rpc('freePort', {}) as number; assert.ok(port > 0);
  const {createServer} = await import('node:net'); const server = createServer();
  try { await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('agent C5 occupants matches local real paths through aliases and excludes siblings', { timeout: 10000 }, async t => {
  const {root, rpc, local} = await fixture(t);
  const path = join(root, 'tree'); await mkdir(path); await mkdir(join(path, 'child')); await symlink(path, join(root, 'alias'));
  const sessions = [{name:'a', cwd:join(root,'alias','child')}, {name:'b',cwd:path}, {name:'c',cwd:path+'-other'}, {name:'a',cwd:path}];
  assert.deepEqual(await rpc('occupants', {path: join(root, 'alias'), sessions}), await local.occupants(path, sessions));
  assert.deepEqual(await rpc('occupants', {path, sessions}), ['a','b']);
});

test('agent C1 short command output and timeout match local', { timeout: 10000 }, async t => {
  const {root, env, rpc, local} = await fixture(t);
  const command = {command: process.execPath, args: ['-e', 'process.stdout.write("out");process.stderr.write("err");process.exit(7)'], cwd: root, env};
  assert.deepEqual(await rpc('run', command), await local.run(command));
  const timed = await rpc('run', {...command, args:['-e','setInterval(()=>{},1000)'], timeoutMs: 50}) as {code:null;error:string};
  assert.equal(timed.code, null); assert.match(timed.error, /no answer within/); assert.doesNotMatch(timed.error, /incomplete/);
});

test('agent C4 worktrees share root install, preserve stale warning and refuse dirty removal', { timeout: 15000 }, async t => {
  const {root, env, rpc, local} = await fixture(t);
  const repo = join(root, 'repo'); await mkdir(repo);
  async function git(args: string[]) { const r = await local.run({command:'git',args:['-c','gc.auto=0',...args],cwd:repo,env}); assert.equal(r.code,0,r.stderr || r.error); }
  await git(['init','-b','dev']); await git(['config','user.name','Fixture']); await git(['config','user.email','fixture@example.invalid']);
  await writeFile(join(repo,'.gitignore'), 'node_modules\n'); await writeFile(join(repo,'package-lock.json'), JSON.stringify({packages:{'node_modules/absent':{version:'1'}}}));
  await git(['add','.']); await git(['commit','-m','fixture']); await git(['branch','task']);
  await mkdir(join(repo,'node_modules'));
  const path = join(root,'tree'); const result = await rpc('worktreeAdd',{root:repo,path,branch:'task'}) as {warning:string};
  assert.equal(await realpath(join(path,'node_modules')), await realpath(join(repo,'node_modules')));
  assert.match(result.warning,/stale worktree install/);
  assert.deepEqual(await rpc('worktreeAdd',{root:repo,path,branch:'task',reuseOnly:true}), await local.worktreeAdd({root:repo,path,branch:'task',reuseOnly:true}));
  await writeFile(join(path,'dirty'),'changes'); await assert.rejects(rpc('worktreeRemove',{root:repo,path}), /modified|untracked|changes/);
  await rm(join(path,'dirty')); await rpc('worktreeRemove',{root:repo,path}); assert.equal(await local.fileType(path),'missing');
});


test('agent fixture drains server and removes root after failed connection setup', { timeout: 15000 }, async t => {
  let acquired: Agent | undefined;
  // Independent fallback owns the deliberately failed setup even in the red control.
  t.after(async () => {
    if (acquired) { await acquired.close(); await rm(dirname(dirname(acquired.socket)), {recursive: true, force: true}); }
  });
  await assert.rejects(fixture(t, async server => {
    acquired = server;
    return AgentClient.connect(server.socket, 'wrong-secret');
  }), /hello secret or protocol refused/);
  assert.ok(acquired);
  assert.equal(await localHost().fileType(dirname(dirname(acquired.socket))), 'missing', 'failed setup must finish owned cleanup before rejecting');
  const socket = acquired.socket;
  await assert.rejects(new Promise<void>((resolve, reject) => {
    const probe = createConnection(socket);
    let error: Error | undefined;
    probe.once('error', cause => { error = cause; });
    probe.once('connect', () => probe.destroy());
    probe.once('close', () => error ? reject(error) : resolve());
  }), /ENOENT|ECONNREFUSED/);
});
