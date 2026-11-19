// T3: killed native listeners and failed fixture drainage retain or remove private
// socket owners through native close receipts; all children and roots are disposable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { dirname, sep, join } from 'node:path';
import { cp, mkdir, lstat, stat, writeFile, readFile, readdir, realpath } from 'node:fs/promises';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { tempProject, CLI_ENTRY, isolateVerification, readDiscovery } from './harness.ts';
import { afterCleanup, beforeDirectories, captureProcess, ownProcess, guardDirectoryRemoval } from './process-cleanup.ts';
import { enableFixtureHostSockets } from '../../shared/fixture-sockets.ts';
import { hostPaths } from '../src/host/records.ts';
import { findFixtureOrphans, removeWorktreeWithFixtures } from '../src/fixture-processes.ts';
import { residueControl, residueChild } from './fixture-residue-control.ts';
import { fixtureOwnership } from '../../shared/fixture-ownership.ts';
import { fixtureCopyFilter } from '../../shared/fake-layout.ts';
import { ensureGitignore, layout } from '../src/project.ts';
import { askHubFrame } from '../src/cli/socket-client.ts';
import { eventually } from './until.ts';

test('a hub serves requests after refusing an unowned fixture registration', t => residueControl(t, { native: true }).run(async c => {
  const root = await c.root('refused-', '/tmp'), accounts = await c.root();
  await c.step('isolated serving configuration', async () => { await mkdir(join(root, '.git')); await isolateVerification(root); });
  // Separate account authority deliberately grants no registration to root in
  // the child. The parent retains responsibility for joining this native hub.
  const extras = {
    CLAND_TEST_FIXTURE_ROOT: root, CLAND_TEST_ORPHAN_ROOT: root, CLAND_TEST_SKIP_ORPHAN_SWEEP: '1',
  };
  const env = fixtureEnvironment(accounts, process.env, extras);
  const refusalReceipt = Promise.withResolvers<unknown>();
  void refusalReceipt.promise.catch(() => {});
  const native = await residueChild(c, 'unowned fixture hub launch', () => {
    const child = spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve'], {
      cwd: root, env: fixtureEnvironment(accounts, process.env, extras), detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Observe the exact producer receipt before startup can displace it from
    // the bounded diagnostic tail. Retain at most one 16 KiB partial line.
    let pending = Buffer.alloc(0), complete = false;
    child.stderr.on('data', (bytes: Buffer) => {
      if (complete) return;
      let offset = 0;
      while (offset < bytes.length) {
        const newline = bytes.indexOf(10, offset), end = newline < 0 ? bytes.length : newline;
        if (pending.length + end - offset > 16 * 1024) {
          complete = true; pending = Buffer.alloc(0);
          refusalReceipt.reject(new Error('incomplete registration diagnostic: line exceeds 16 KiB'));
          return;
        }
        pending = Buffer.concat([pending, bytes.subarray(offset, end)]);
        if (newline < 0) return;
        try {
          const value = JSON.parse(pending.toString('utf8'));
          if (value.event === 'fixture-ownership-refused') { complete = true; refusalReceipt.resolve(value); }
        } catch { /* Not the structured receipt. */ }
        pending = Buffer.alloc(0); offset = end + 1;
        if (complete) return;
      }
    });
    return child;
  });
  const discovery = await native.observe('persisted serving readiness', () => eventually('discovery names the launched hub', async () => {
    const value = await readDiscovery(root);
    return value.pid === native.child.pid ? value : undefined;
  }, 5000));
  const refusal = await native.observe('structured registration refusal', () => refusalReceipt.promise);
  assert.deepEqual(refusal, { event: 'fixture-ownership-refused', outcome: 'refused', root, reason: 'unowned-root', nativeCode: null, cleanupCodes: [] });
  const status = await native.observe('request served after refusal', () => askHubFrame(discovery, { type: 'hub.status' }, 3000, env));
  assert.equal((status as { root: string }).root, root);
  await c.step('no ownership authority persisted', () => assert.rejects(lstat(join(root, '.fixture-sockets/owners')), { code: 'ENOENT' }));
  await native.observe('requested hub stop', () => askHubFrame(discovery, { type: 'hub.stop' }, 3000, env));
  assert.deepEqual(await native.observe('native serving hub close', () => native.closed), [0, null], native.diagnostic());
  await c.step('serving owner settlement', native.close);
}));

test('fixture runtime metadata stays out of Git status, commits, clones and copies', t => residueControl(t, { native: true }).run(async c => {
  const outer = await c.root('fixture-git-', '/tmp'), root = join(outer, 'project');
  await c.step('repository directory setup', () => mkdir(root));
  const receipt = await c.acquire('live receipt setup', () => fixtureOwnership([root]), owner => owner.close());
  await c.step('socket alias setup', async () => { fixtureSocketPath(root, 'copy-control'); });
  const env = fixtureEnvironment(outer, process.env, {}, root), exec = promisify(execFile);
  const git = (cwd: string, ...args: string[]) => c.step('isolated Git ' + args[0], async () => (await exec('git', args, { cwd, env })).stdout.trim());
  await git(root, 'init', '-q', '-b', 'dev');
  await c.step('ordinary source setup', () => writeFile(join(root, 'seed'), 'fixture seed\n'));
  assert.equal(await git(root, 'status', '--porcelain', '--untracked-files=all'), '?? seed', 'ordinary source is visible while live runtime metadata is excluded');
  await git(root, 'add', '.');
  await git(root, '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture source');
  assert.equal(await git(root, 'ls-tree', '-r', '--name-only', 'HEAD'), 'seed');
  assert.equal(await git(root, 'status', '--porcelain', '--untracked-files=all'), '');
  const clone = join(outer, 'clone');
  await git(outer, 'clone', '-q', '--no-hardlinks', root, clone);
  assert.equal(await c.step('clone source receipt', () => readFile(join(clone, 'seed'), 'utf8')), 'fixture seed\n');
  await c.step('clone has no runtime metadata', () => assert.rejects(lstat(join(clone, '.fixture-sockets')), { code: 'ENOENT' }));
  assert.equal(await git(clone, 'status', '--porcelain', '--untracked-files=all'), '');
  const copied = join(outer, 'copied');
  await c.step('fixture tree copy', () => cp(root, copied, { recursive: true, verbatimSymlinks: true, filter: fixtureCopyFilter }));
  assert.equal(await c.step('copied source receipt', () => readFile(join(copied, 'seed'), 'utf8')), 'fixture seed\n');
  await c.step('copy has no runtime metadata', () => assert.rejects(lstat(join(copied, '.fixture-sockets')), { code: 'ENOENT' }));
  await c.step('managed ignore directory setup', () => mkdir(join(root, '.cland')));
  await c.step('managed ignore update', async () => { ensureGitignore(layout(root)); });
  assert.equal(await c.step('nested ignore remains owner controlled', () => readFile(join(root, '.fixture-sockets/.gitignore'), 'utf8')), '*\n');
  const ordinary = join(outer, 'ordinary');
  await c.step('non-fixture storage setup', async () => {
    await mkdir(join(ordinary, '.fixture-sockets'), { recursive: true, mode: 0o700 });
    await writeFile(join(ordinary, '.fixture-sockets/user-data'), 'ordinary project data');
  });
  await git(ordinary, 'init', '-q', '-b', 'dev');
  assert.equal(await git(ordinary, 'status', '--porcelain', '--untracked-files=all'), '?? .fixture-sockets/user-data', 'non-fixture project data remains visible to Git');
  await c.step('live receipt descriptor closure', receipt.close);
  await c.step('receipt removal', async () => { receipt.value.remove(); });
  assert.equal(await git(root, 'status', '--porcelain', '--untracked-files=all'), '?? .cland/.gitignore', 'receipt removal creates no tracked deletion');
}));

test('rejected fixture closure retains its root and native guard until the owning process exits', t => residueControl(t, { native: true }).run(async c => {
  const root = await c.root('rejected-', '/tmp'), source = join(root, 'rejected.test.mjs'), receipt = join(root, 'retained.json');
  const control = new URL('./fixture-residue-control.ts', import.meta.url).href;
  await c.step('rejected-close worker source setup', () => writeFile(source, `import test from 'node:test';import assert from 'node:assert/strict';import cp from 'node:child_process';import {lstat,writeFile} from 'node:fs/promises';import {residueControl} from ${JSON.stringify(control)};
const originalSpawn=cp.spawn;let root='',rejected=false;
test('resource close rejects',t=>residueControl(t).run(async c=>{root=await c.root();await c.acquire('fake owner setup',()=>({}),async()=>{rejected=true;throw Error('planted closure rejection');});}));
test('observe the rejected owner',t=>residueControl(t,{native:true}).run(async c=>{assert.equal(rejected,true);assert.notEqual(cp.spawn,originalSpawn);assert.equal((await c.step('retained root receipt',()=>lstat(root))).isDirectory(),true);await c.step('retention publication',()=>writeFile(${JSON.stringify(receipt)},JSON.stringify({root,rejected,guardRetained:cp.spawn!==originalSpawn})));}));`));
  const native = await residueChild(c, 'rejected-close worker setup', () => spawn(process.execPath, ['--test', source], {
    cwd: root, detached: true, env: fixtureEnvironment(root, process.env, { TMPDIR: root, NODE_TEST_CONTEXT: undefined }), stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const [code, signal] = await native.observe('rejected-close worker native completion', () => native.closed);
  assert.equal(code, 1, native.diagnostic()); assert.equal(signal, null);
  const { readFile } = await import('node:fs/promises');
  const saved = JSON.parse(await c.step('retention receipt read', () => readFile(receipt, 'utf8'))) as {root:string;rejected:boolean;guardRetained:boolean};
  assert.equal(saved.rejected, true); assert.equal(saved.guardRetained, true);
  const retained = await c.step('retained root canonical ownership', () => realpath(saved.root));
  assert.ok(retained.startsWith(root + sep));
  assert.equal((await c.step('retained root observation', () => lstat(retained))).isDirectory(), true);
  await c.step('worker ownership settlement', native.close);
  const { ownDirectory } = await import('./process-cleanup.ts');
  await c.step('guarded recovery after native exit', () => ownDirectory(undefined, retained)());
  await c.step('recovered root removal observation', () => assert.rejects(lstat(retained), { code: 'ENOENT' }));
}));

for (const failed of [false, true]) test(`post-file census clears fixture endpoints and receipts after ${failed ? 'test failure' : 'success'}`, t => residueControl(t, { native: true }).run(async c => {
  const root = await c.root('census-', '/tmp'), source = join(root, 'case.test.mjs'), receipt = join(root, 'paths.json');
  const harness = new URL('./harness.ts', import.meta.url).href;
  const ownership = new URL('../../shared/fixture-ownership.ts', import.meta.url).href;
  const project = new URL('../src/project.ts', import.meta.url).href;
  const control = new URL('./fixture-residue-control.ts', import.meta.url).href;
  await c.step('test worker source setup', () => writeFile(source, `import test from 'node:test';import {writeFile} from 'node:fs/promises';
import {fixtureResidueCensus} from ${JSON.stringify(harness)};
import {fixtureOwnership} from ${JSON.stringify(ownership)};import {layout} from ${JSON.stringify(project)};
import {residueControl} from ${JSON.stringify(control)};
test('owned fixture',t=>residueControl(t).run(async c=>{const root=await c.root('deep'.repeat(35));const owner=await c.acquire('receipt setup',()=>fixtureOwnership([root]),value=>value.close());
const paths=[root,layout(root).socket,layout(root).spokeSocket,owner.value.path];
for(const path of paths.slice(1,3))await c.step('placeholder setup',()=>writeFile(path,'failed socket placeholder'));
await c.step('paths publication',()=>writeFile(${JSON.stringify(receipt)},JSON.stringify(paths)));${failed ? "throw new Error('planted test failure');" : ''}}));test('fixture file outputs are removed',fixtureResidueCensus());`));
  const native = await residueChild(c, 'test worker launch setup', () => spawn(process.execPath, ['--test', source], { cwd: root, detached: true, env: fixtureEnvironment(root, process.env, { NODE_TEST_CONTEXT: undefined, TMPDIR: root }), stdio: ['ignore', 'pipe', 'pipe'] }));
  const [code, signal] = await native.observe('test worker native completion', () => native.closed);
  assert.equal(code, failed ? 1 : 0, native.diagnostic()); assert.equal(signal, null);
  if (failed) assert.match(native.diagnostic(), /planted test failure/);
  const { readFile } = await import('node:fs/promises');
  const paths = JSON.parse(await c.step('paths receipt read', () => readFile(receipt, 'utf8'))) as string[];
  assert.equal(paths.length, 4);
  const kinds = ['project root', 'hub fallback placeholder', 'spoke fallback placeholder', 'owner receipt'];
  const remaining: string[] = [];
  for (const [index, path] of paths.entries()) {
    const present = await c.step('file completion output census', () => lstat(path).then(() => true, error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }));
    if (present) remaining.push(kinds[index]!);
  }
  assert.deepEqual(remaining, [], 'no named fixture output survives file completion');
}));

test('orphan sweep discovers a root-local receipt after the test worker is killed', t => residueControl(t, { native: true }).run(async c => {
  const root = await c.root();
  const sourceCheckout = join(root, 'source-checkout');
  await c.step('separate source setup', async () => { await mkdir(sourceCheckout); await writeFile(join(sourceCheckout, 'keep'), 'source remains'); });
  const stub = join(sourceCheckout, 'stub-hub.ts');
  const ownership = new URL('../../shared/fixture-ownership.ts', import.meta.url).href;
  const environment = new URL('./fixture-environment.ts', import.meta.url).href;
  await c.step('stub source setup', () => writeFile(stub, `import {fixtureOwnership} from ${JSON.stringify(ownership)};
const owner=fixtureOwnership([process.cwd()],${JSON.stringify(sourceCheckout)});
process.send({pid:process.pid,path:owner.path});setInterval(()=>{},1000);`));
  const source = `import {spawn} from 'node:child_process';import {fixtureEnvironment} from ${JSON.stringify(environment)};
process.on('message',()=>{const child=spawn(process.execPath,[process.argv[1]],{cwd:process.cwd(),env:fixtureEnvironment(process.cwd(),process.env),stdio:['ignore','ignore','ignore','ipc']});child.on('message',message=>process.send(message));});process.send('ready');setInterval(()=>{},1000);`;
  const native = await residueChild(c, 'worker launch setup', () => spawn(process.execPath, ['--input-type=module', '-e', source, stub], { cwd: root, detached: true, env: fixtureEnvironment(root, process.env), stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }), true);
  const worker = native.child;
  const [ready] = await native.observe('worker readiness setup', () => native.firstMessage!);
  assert.equal(ready, 'ready');
  const receiptMessage = once(worker, 'message', { signal: AbortSignal.any([c.signal, AbortSignal.timeout(5000)]) });
  worker.send('spawn');
  const [receipt] = await native.observe('stub ownership publication', () => receiptMessage) as [{pid:number;path:string}];
  await c.acquire('stub native owner setup', () => ownProcess(undefined, receipt.pid), stop => stop());
  assert.ok(receipt.path.startsWith(root + '/'));
  assert.equal((await c.step('persisted receipt observation', () => stat(receipt.path))).isFile(), true);
  worker.kill('SIGKILL');
  const [, signal] = await native.observe('killed worker native completion', () => native.closed);
  assert.equal(signal, 'SIGKILL');
  const found = await c.step('source-associated orphan discovery', () => findFixtureOrphans(root, undefined, undefined, sourceCheckout));
  assert.ok(found.some(row => row.owned && row.process.pid === receipt.pid), 'open receipt still grants discovery after worker death');
  let joined = false;
  await c.step('source-associated worktree removal join', () => removeWorktreeWithFixtures(sourceCheckout, async () => { joined = true; }));
  assert.equal(joined, true, 'authorized source removal waits for the associated orphan');
  await c.step('swept receipt removal observation', () => assert.rejects(lstat(receipt.path), { code: 'ENOENT' }));
  assert.equal(await c.step('source metadata preservation', () => readFile(join(sourceCheckout, 'keep'), 'utf8')), 'source remains');
}));

test('a cold hub child allocates its first host sockets beneath the scratch root and persists independent reader paths', async t => {
  const root = await tempProject(t);
  assert.deepEqual(await readdir(root), [], 'parent has not allocated host storage');
  const harness = new URL('./harness.ts', import.meta.url).href;
  const store = new URL('../src/hub/store.ts', import.meta.url).href;
  const testHost = new URL('../src/host/test-host.ts', import.meta.url).href;
  const roots = new URL('../../shared/fixture-roots.ts', import.meta.url).href;
  const records = new URL('../src/host/records.ts', import.meta.url).href;
  const program = `import test from 'node:test';import {projectHub} from ${JSON.stringify(harness)};import {Store} from ${JSON.stringify(store)};import {testHost} from ${JSON.stringify(testHost)};import {HostSecretStore,hostPaths} from ${JSON.stringify(records)};import {FIXTURE_HOST_SOCKET_ROOT} from ${JSON.stringify(roots)};import {realpathSync,mkdirSync} from 'node:fs';import {join} from 'node:path';
const root=process.argv[1],action=Promise.withResolvers();process.on('message',message=>{if(message==='allocate')action.resolve();});test('cold hub first allocation',async t=>{await action.promise;mkdirSync(join(root,'.cland'));const firstLayoutRoot=process.env[FIXTURE_HOST_SOCKET_ROOT],store=new Store(join(root,'.cland/hub.db'));let physical;try{new HostSecretStore(root,store.hosts).register({id:'child',address:'child',user:'agent',clientKeyPath:'/synthetic/key',knownHosts:'child ssh-ed25519 synthetic\\n'});physical=realpathSync(hostPaths(root,'child').socketDirectory);}finally{await store.hosts.leases.close();store.close();}const hub=await projectHub(t,root,{}, {hosts:[testHost('child',()=>{})]});const paths=hostPaths(root,'child'),restoredPhysical=realpathSync(paths.socketDirectory),layoutRoot=hub.hostEnvironment[FIXTURE_HOST_SOCKET_ROOT];await hub.stop();process.send({type:'allocated',socketDirectory:paths.socketDirectory,physical,restoredPhysical,layoutRoot,firstLayoutRoot},()=>process.disconnect());});process.send({type:'ready'});`;
  let child: ReturnType<typeof spawn> | undefined, closed: Promise<unknown[]> | undefined;
  let stopChild:(()=>Promise<void>)|undefined, childClosed=true;
  guardDirectoryRemoval(root,()=>{if(!childClosed)throw Error('cold child writer closure unconfirmed; root retained');});
  beforeDirectories(t, async () => {
    await stopChild?.();
    await closed;
  });
  child=spawn(process.execPath,['--input-type=module','-e',program,root],{cwd:root,env:fixtureEnvironment(root,process.env),stdio:['ignore','pipe','pipe','ipc']});
  childClosed=false;
  stopChild=ownProcess(t,child.pid);
  let tail='';for(const stream of [child.stdout,child.stderr])stream?.on('data',chunk=>{tail=(tail+String(chunk)).slice(-4000);});
  const incomplete=(boundary:string,error:unknown)=>new Error(`incomplete cold-child ${boundary}: exit ${child?.exitCode??'pending'}, signal ${child?.signalCode??'none'}; tail: ${tail}`,{cause:error});
  closed=once(child,'close',{signal:AbortSignal.timeout(10000)}).then(receipt=>{childClosed=true;return receipt;}).catch(error=>{throw incomplete('close',error);});
  void closed.catch(()=>{}); // Teardown and the final await still observe failure.
  const [ready]=await once(child,'message',{signal:AbortSignal.timeout(5000)}).catch(error=>{throw incomplete('readiness',error);});
  assert.deepEqual(ready,{type:'ready'});
  const allocating=once(child,'message',{signal:AbortSignal.timeout(5000)}).catch(error=>{throw incomplete('allocation',error);});
  child.send('allocate');
  const [allocated]=await allocating as [{type:string;socketDirectory:string;physical:string;restoredPhysical:string;layoutRoot:string;firstLayoutRoot:string;error?:string}];
  assert.equal(allocated.type,'allocated',allocated.error);
  const [code,signal]=await closed;
  assert.equal(code,0);assert.equal(signal,null);
  assert.equal(allocated.firstLayoutRoot,root,'first registration has only the environment opt-in');
  assert.equal(allocated.layoutRoot,root,'the spawned hub retains the subject root through account-environment sealing');
  assert.ok(allocated.physical.startsWith(root+sep));
  assert.equal(allocated.restoredPhysical,allocated.physical);
  assert.equal((await stat(allocated.physical)).isDirectory(),true);
  // Remove this process's memory opt-in: the persisted marker must suffice.
  enableFixtureHostSockets(root)();
  assert.equal(await realpath(hostPaths(root,'child').socketDirectory),allocated.physical);
  afterCleanup(t, async()=>{await assert.rejects(lstat(dirname(allocated.socketDirectory)),{code:'ENOENT'});});
});

for (const killed of [false, true]) test(`private socket ownership cleans after ${killed ? 'killed listener' : 'normal close'}`, async t => {
  const root = await tempProject(t);
  const path = fixtureSocketPath(root, 'owned.sock');
  const program = `import {createServer} from 'node:net'; const s=createServer(); s.listen(process.argv[1],()=>process.send('listening')); process.on('message',()=>s.close(()=>process.disconnect()));`;
  let child: ReturnType<typeof spawn> | undefined;
  let closed: Promise<unknown> | undefined;
  beforeDirectories(t, async () => {
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
  });
  child = spawn(process.execPath, ['--input-type=module', '-e', program, path], { env: fixtureEnvironment(root, process.env), stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  closed = once(child, 'close', { signal: AbortSignal.timeout(10000) });
  await once(child, 'message', { signal: AbortSignal.timeout(5000) });
  assert.equal((await stat(path)).isSocket(), true);
  if (killed) child.kill('SIGKILL'); else child.send('close');
  const [code, signal] = await closed as [number | null, string | null];
  assert.equal(killed ? signal : code, killed ? 'SIGKILL' : 0);
  if (killed) assert.equal((await stat(path)).isSocket(), true, 'killed listener leaves a native endpoint for the owner');
  afterCleanup(t, async () => { await assert.rejects(lstat(dirname(path)), { code: 'ENOENT' }); });
});

test('incomplete fixture drain retains private sockets and root', async t => {
  const root = await tempProject(t);
  const receipt = root + '/receipt';
  const source = root + '/incomplete.test.mjs';
  const helper = new URL('../../test-support/socket-path.ts', import.meta.url).href;
  const harness = new URL('./harness.ts', import.meta.url).href;
  const cleanup = new URL('./process-cleanup.ts', import.meta.url).href;
  await writeFile(source, `
import test from 'node:test';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {writeFileSync, existsSync} from 'node:fs';
import {fixtureSocketPath} from ${JSON.stringify(helper)};
import {tempProject} from ${JSON.stringify(harness)};
import {onCleanup,afterCleanup,guardDirectoryRemoval} from ${JSON.stringify(cleanup)};
test('incomplete owner',async t=>{
  const root=await tempProject(t);
  const path=fixtureSocketPath(root,'held.sock');
  const server=createServer();
  onCleanup(t,()=>{throw new Error('incomplete native drain receipt');});
  guardDirectoryRemoval(root,()=>{
    if(server.listening) throw new Error('incomplete native drain receipt: listener still live');
  });
  afterCleanup(t,async()=>{
    const retainedWhileLive=server.listening && existsSync(root) && existsSync(path);
    writeFileSync(${JSON.stringify(receipt)},JSON.stringify({root,path,retainedWhileLive}));
    if(server.listening){
      const closed=once(server,'close',{signal:AbortSignal.timeout(5000)});
      server.close();
      await closed;
    }
  });
  const listening=once(server,'listening',{signal:AbortSignal.timeout(5000)});
  server.listen(path);
  await listening;
});`);
  let child: ReturnType<typeof spawn> | undefined;
  let nativeClosed: Promise<unknown[]> | undefined;
  beforeDirectories(t, async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
    await nativeClosed;
  });
  child = spawn(process.execPath, ['--test', source], { cwd: root, env: fixtureEnvironment(root, process.env, { NODE_TEST_CONTEXT: undefined }), stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostic = '';
  child.stdout?.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-4000); });
  child.stderr?.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-4000); });
  nativeClosed = once(child, 'close', { signal: AbortSignal.timeout(10000) });
  const [code] = await nativeClosed;
  assert.equal(code, 1, diagnostic);
  assert.match(diagnostic, /incomplete native drain receipt/);
  const { readFile, rm } = await import('node:fs/promises');
  const saved = JSON.parse(await readFile(receipt, 'utf8')) as { root: string; path: string; retainedWhileLive: boolean };
  assert.equal(saved.retainedWhileLive, true, 'failed drainage preserves the endpoint beneath its live listener');
  assert.equal((await stat(saved.root)).isDirectory(), true);
  assert.equal((await stat(dirname(saved.path))).mode & 0o777, 0o700);
  // The child close above positively ends all writers before removing retained data.
  await rm(saved.root, { recursive: true, force: true });
  await rm(dirname(saved.path), { recursive: true, force: true });
});

for (const recovery of ['fixture owner', 'suite sweep']) test(`${recovery} recovers socket ownership after the allocating worker is killed`, async t => {
  const root = await tempProject(t);
  const info = await stat(root);
  const helper = new URL('../../test-support/socket-path.ts', import.meta.url).href;
  const program = `import {fixtureSocketPath} from ${JSON.stringify(helper)}; import {createServer} from 'node:net'; import {mkdirSync} from 'node:fs'; const root=process.argv[1]+'/worker-root'; mkdirSync(root); const path=fixtureSocketPath(root,'worker.sock'); createServer().listen(path,()=>process.send(path));`;
  let child: ReturnType<typeof spawn> | undefined;
  let closed: Promise<unknown> | undefined;
  beforeDirectories(t, async () => {
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
  });
  child = spawn(process.execPath, ['--input-type=module', '-e', program, root], { env: fixtureEnvironment(root, process.env), stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  closed = once(child, 'close', { signal: AbortSignal.timeout(10000) });
  const [path] = await once(child, 'message', { signal: AbortSignal.timeout(5000) }) as [string];
  assert.equal((await stat(path)).isSocket(), true);
  const identity = captureProcess(child.pid!);
  assert.ok(identity, 'native worker identity captured before termination');
  child.kill('SIGKILL');
  const [, signal] = await closed as [number | null, string | null];
  assert.equal(signal, 'SIGKILL');
  assert.equal((await stat(path)).isSocket(), true);
  if (recovery === 'suite sweep') {
    const { sweep } = await import('../src/suite-lock.ts');
    await sweep({ pid: child.pid!, started: identity.started, since: new Date().toISOString(), token: 'socket-recovery', root, device: info.dev, inode: info.ino, runner: identity });
    await assert.rejects(lstat(dirname(path)), { code: 'ENOENT' });
  }
  afterCleanup(t, async () => { await assert.rejects(lstat(dirname(path)), { code: 'ENOENT' }); });
});
