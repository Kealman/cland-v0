// T2: OpenCode lifecycle routes exclusively through the row's recording Host.
import { testWaitMs } from './until.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import { localHost } from '../src/host/local.ts';
import { fakeHarness } from './fakes/harness.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject, eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { join } from 'node:path';
import { beforeDirectories } from './process-cleanup.ts';
import { renameCase } from './rename-case.ts';
import { recordingHost } from './recording-host.ts';

test('OpenCode remote rename moves host files, preserves the hub mirror, and supports delivery, resume and retirement', t => renameCase(t, async ({ step, root: acquireRoot, mocks, dispose }) => {
  const fs = await step(() => import('node:fs/promises'));
  const { OpenCodeClient } = await step(() => import('../src/adapters/opencode/client.ts'));
  const root = await acquireRoot(), env = fixtureEnvironment(root, process.env);
  let cleanup = async () => {};
  dispose(() => cleanup());
  const mirror = join(root, 'opencode/worker'), remote = join(root, 'remote/worker');
  for (const dir of [mirror, remote]) {
    await step(() => fs.mkdir(dir, { recursive: true }));
    await step(() => fs.writeFile(join(dir, 'password'), dir === mirror ? 'hub-sentinel' : 'synthetic-password'));
    await step(() => fs.writeFile(join(dir, 'opencode.json'), '{}'));
    await step(() => fs.writeFile(join(dir, 'serve.log'), 'retained log'));
  }
  const local = localHost(env);
  const machine = { ...recordingHost(join(root, 'remote'), {sourceRoot: join(root, 'opencode')}), name: 'remote',
    spawn: async () => { throw new Error('unexpected native spawn'); },
    run: async () => { throw new Error('unexpected native run'); },
    identity: async () => { throw new Error('unexpected native identity'); },
    alive: async () => true, stop: async () => true,
    forward: async () => ({ socket: join(root, 'synthetic.sock') }), unforward: async () => {},
  };
  await step(() => assert.rejects(machine.spawn(), /unexpected native spawn/));
  const prompts: unknown[] = [];
  let opened = false;
  mocks.method(OpenCodeClient.prototype, 'events', async (_event: unknown, onOpen: () => void, signal: AbortSignal) => {
    opened = true; onOpen();
    await new Promise<void>(resolve => { signal.addEventListener('abort', () => resolve(), { once: true }); if (signal.aborted) resolve(); });
  });
  mocks.method(OpenCodeClient.prototype, 'request', async (_method: string, path: string, body: unknown) => {
    if (path.endsWith('/prompt')) { prompts.push(body); return { data: { id: 'inbox-rename' } }; }
    if (path.endsWith('/permission') || path.endsWith('/form')) return { data: [] };
    if (path.endsWith('/active')) return { data: {} };
    return { data: { id: 'ses_rename' } };
  });
  const row = { ...await step(() => fakeHarness('opencode').spawn({ name: 'worker', role: null, model: null, cwd: root })), host: 'remote', harnessId: 'http://127.0.0.1:12345', harnessSessionId: 'ses_rename' };
  const state = new Map<string, string>();
  const { hostGenerationKey } = await step(() => import('../src/adapters/processes.ts'));
  const key = 'opencode.privateDirectory:' + hostGenerationKey(row);
  state.set(key, JSON.stringify({ path: mirror, canonical: mirror, identity: (await step(() => local.statDirectory(remote))).identity }));
  const adapterHost: import('../src/adapters/contract.ts').AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '', cli: '', spoke: '', hostForProcess: () => machine, signal: () => {}, recordPid: () => {}, exited: () => {}, log: () => {}, adapterState: { read: key => state.get(key) ?? null, write: (key, value) => { state.set(key, value); } } };
  const adapter = new OpenCodeAdapter(adapterHost, { env, clock: new FakeClock() });
  cleanup = () => adapter.close();
  adapter.watch(row);
  await step(() => eventually('original remote subscription opened', () => opened || undefined));
  const renamed = { ...row, name: 'new' };
  await step(() => adapter.renamed(renamed, row.name));
  assert.equal(await step(() => fs.readFile(join(root, 'remote/new/password'), 'utf8')), 'synthetic-password');
  assert.equal(await step(() => local.fileType(remote)), 'missing');
  assert.equal(await step(() => fs.readFile(join(mirror, 'password'), 'utf8')), 'hub-sentinel');
  assert.equal(await step(() => local.fileType(join(root, 'opencode/new'))), 'missing');
  await step(() => adapter.inject(renamed, { id: 'rename-message', from: 'human', fromKind: 'human', via: 'hub', to: ['new'], text: 'after rename', kind: 'report', ts: new Date().toISOString() }, null));
  assert.equal(prompts.length, 1);
  assert.match((prompts[0] as { text: string }).text, /to="new"/);
  assert.equal((await step(() => adapter.resume(renamed))).found, true);
  await step(() => adapter.releaseHostGeneration(renamed, () => {}));
  assert.equal(await step(() => local.fileType(join(root, 'remote/new/password'))), 'missing');
  assert.equal(await step(() => local.fileType(join(root, 'remote/new/opencode.json'))), 'missing');
  assert.equal(await step(() => fs.readFile(join(root, 'remote/new/serve.log'), 'utf8')), 'retained log');
  assert.equal(await step(() => fs.readFile(join(mirror, 'password'), 'utf8')), 'hub-sentinel');
  await step(() => fs.mkdir(join(root, 'remote/taken')));
  const failed = { ...renamed, name: 'taken' };
  await step(() => assert.rejects(adapter.renamed(failed, renamed.name), /EEXIST/));
  assert.match(adapter.stateReason(failed)!, /rename incomplete on host:.*EEXIST/);
  const { HubCore } = await step(() => import('../src/hub/core.ts'));
  const { Sessions } = await step(() => import('../src/adapters/sessions.ts'));
  const { ProcessTable } = await step(() => import('../src/adapters/processes.ts'));
  const clock = new FakeClock(), core = new HubCore({ clock }), table = new ProcessTable(':memory:', clock);
  const sessions = new Sessions({ core, table, root, hosts: [machine], env });
  dispose(async () => { await sessions.close(); table.close(); core.close(); core.store.close(); });
  sessions.register(adapter);
  for (const status of ['running', 'stopped', 'exited'] as const) assert.match(sessions.view({ ...failed, status }).stateReason!, /rename incomplete on host:.*EEXIST/);
  await step(() => adapter.close());
  const recovered = new OpenCodeAdapter(adapterHost, { env, clock: new FakeClock() });
  cleanup = () => recovered.close();
  sessions.register(recovered);
  for (const status of ['running', 'stopped', 'exited'] as const) assert.match(sessions.view({ ...failed, status }).stateReason!, /rename incomplete on host:.*EEXIST/);
  assert.match(recovered.stateReason(failed)!, /rename incomplete on host:.*EEXIST/);
  await step(() => assert.rejects(recovered.resume(failed), /rename incomplete on host/));
  await step(() => assert.rejects(recovered.inject(failed, { id: 'fenced', from: 'human', fromKind: 'human', via: 'hub', to: ['taken'], text: 'fenced', ts: new Date().toISOString() }, null), /rename incomplete on host/));
  await step(() => assert.rejects(recovered.releaseHostGeneration(failed, () => {}), /rename incomplete on host/));
  assert.equal(await step(() => fs.readFile(join(root, 'remote/new/serve.log'), 'utf8')), 'retained log');
}));

test('OpenCode local rename preserves private bytes, permissions and directory identity', t => renameCase(t, async ({ step, root: acquireRoot, mocks, dispose }) => {
  const fs = await step(() => import('node:fs/promises'));
  const root = await acquireRoot(), env = fixtureEnvironment(root, process.env);
  const host = localHost(env), source = join(root, 'opencode/worker'), target = join(root, 'opencode/new');
  await step(() => fs.mkdir(source, { recursive: true, mode: 0o700 }));
  await step(() => fs.writeFile(join(source, 'password'), 'synthetic-password', { mode: 0o600 }));
  await step(() => fs.writeFile(join(source, 'opencode.json'), '{}'));
  const identity = (await step(() => host.statDirectory(source))).identity;
  const row = await step(() => fakeHarness('opencode').spawn({ name: 'worker', role: null, model: null, cwd: root }));
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, 'hub.json'), node: '', cli: '', spoke: '', hostForProcess: () => host, signal: () => {}, recordPid: () => {}, exited: () => {}, log: () => {} }, { env, clock: new FakeClock() });
  dispose(() => adapter.close());
  const renamed = { ...row, name: 'new' };
  await step(() => adapter.renamed(renamed, 'worker'));
  assert.equal(await step(() => host.fileType(source)), 'missing');
  assert.deepEqual((await step(() => host.statDirectory(target))).identity, identity);
  assert.equal(await step(() => fs.readFile(join(target, 'password'), 'utf8')), 'synthetic-password');
  assert.equal((await step(() => fs.stat(join(target, 'password')))).mode & 0o777, 0o600);
  assert.equal(await step(() => fs.readFile(join(target, 'opencode.json'), 'utf8')), '{}');
  assert.match(adapter.attachCommand(renamed), /opencode\/new\/password/);
}));

for (const capable of [false, true]) test(`OpenCode host directory move ${capable ? 'uses a durable agent receipt and refuses existing targets' : 'refuses an older agent without local fallback'}`, t => renameCase(t, async ({ step, root: acquireRoot, mocks, dispose }) => {
  const { EventEmitter } = await step(() => import('node:events'));
  const { sshHost } = await step(() => import('../src/host/ssh-host.ts'));
  const { PreparedOperations } = await step(() => import('../src/host/agent/prepared.ts'));
  const { MOVE_DIRECTORY_CAPABILITY } = await step(() => import('../src/host/agent/files.ts'));
  const { PREPARED_HOST_CAPABILITY } = await step(() => import('../src/host/agent/protocol.ts'));
  const fs = await step(() => import('node:fs/promises'));
  const root = await acquireRoot(), env = fixtureEnvironment(root, process.env);
  let cleanup = async () => {};
  dispose(() => cleanup());
  const processes = new Proxy({}, { get: () => () => { throw new Error('unexpected process boundary'); } }) as import('../src/host/agent/processes.ts').AgentProcesses;
  const prepared = new PreparedOperations(join(root, 'run'), env, processes);
  cleanup = () => prepared.close();
  await step(() => prepared.start());
  const operations: string[] = [];
  let loseReply = capable;
  const client = Object.assign(new EventEmitter(), {
    hello: { protocol: 1, version: 'test', pid: 1, bootId: 'synthetic', capabilities: [PREPARED_HOST_CAPABILITY, ...(capable ? [MOVE_DIRECTORY_CAPABILITY] : [])] },
    request: async (op: string, args: Record<string, unknown>) => {
      operations.push(op);
      if (op === 'processes' || op === 'native-receipts') return [];
      if (op === 'prepare-moveDirectory') return prepared.prepare('moveDirectory', args);
      if (op === 'commit-prepared') {
        const result = await prepared.commit(String(args.token));
        if (loseReply) { loseReply = false; throw new Error('synthetic lost move reply'); }
        return result;
      }
      if (op === 'settle-prepared') return prepared.settle(String(args.token), String(args.recoveryKey));
      throw new Error(`unexpected RPC ${op}`);
    }, close: async () => { client.emit('closed'); },
  });
  const host = sshHost({ name: 'remote', layout: localHost(env).layout({ discoveryFile: join(root, 'hub.json'), node: '', cli: '', spoke: '' }), transport: { status: () => ({ state: 'up' }), forward: async () => { throw new Error('unexpected forward'); }, unforward: async () => {} } as unknown as Parameters<typeof sshHost>[0]['transport'], connect: async () => client as unknown as import('../src/host/agent-client.ts').AgentClient });
  cleanup = async () => { await host.close(); await prepared.close(); };
  const source = join(root, 'source'), target = join(root, 'target');
  await step(() => fs.mkdir(source)); await step(() => fs.writeFile(join(source, 'password'), 'synthetic'));
  if (!capable) {
    await step(() => assert.rejects(host.moveDirectory!(source, target), { message: 'host agent lacks moveDirectory', code: 'CLAND_HOST_CAPABILITY_MISSING', capability: MOVE_DIRECTORY_CAPABILITY }));
    assert.equal(await step(() => fs.readFile(join(source, 'password'), 'utf8')), 'synthetic');
    assert.equal(await step(() => localHost(env).fileType(target)), 'missing');
    assert.equal(operations.includes('prepare-moveDirectory'), false);
  } else {
    const identity = await step(() => fs.stat(source));
    await step(() => assert.rejects(host.moveDirectory!(source, target, {sourceIdentity:{dev:identity.dev,ino:identity.ino+1}}), /source directory identity changed/));
    assert.equal(await step(() => localHost(env).fileType(target)), 'missing');
    assert.equal(await step(() => fs.readFile(join(source,'password'),'utf8')), 'synthetic');
    const commitsBefore = operations.filter(op => op === 'commit-prepared').length;
    const settlementsBefore = operations.filter(op => op === 'settle-prepared').length;
    await step(() => host.moveDirectory!(source, target, {sourceIdentity:{dev:identity.dev,ino:identity.ino}}));
    assert.equal(operations.filter(op => op === 'commit-prepared').length, commitsBefore+1);
    assert.equal(operations.filter(op => op === 'settle-prepared').length, settlementsBefore+1);
    assert.equal(await step(() => fs.readFile(join(target, 'password'), 'utf8')), 'synthetic');
    assert.equal(await step(() => localHost(env).fileType(source)), 'missing');
    await step(() => fs.mkdir(source));
    await step(() => assert.rejects(host.moveDirectory!(source, target), /EEXIST/));
    assert.equal(await step(() => fs.readFile(join(target, 'password'), 'utf8')), 'synthetic');
    assert.equal(await step(() => localHost(env).fileType(source)), 'directory');
    await step(() => assert.rejects(host.moveDirectory!(join(root, 'missing'), join(root, 'unused')), /ENOENT/));
    assert.equal(await step(() => localHost(env).fileType(join(root, 'unused'))), 'missing', 'failed rename removes its reservation before the failure receipt');
  }
}));

test('OpenCode rename refuses a replacement private source before moving it', t => renameCase(t, async ({step, root: acquireRoot, dispose}) => {
  const fs = await step(() => import('node:fs/promises'));
  const root = await acquireRoot(), env = fixtureEnvironment(root, process.env), host = localHost(env);
  const source = join(root, 'opencode/worker'), target = join(root, 'opencode/new'), kept = join(root, 'original');
  await step(() => fs.mkdir(source, {recursive:true}));
  await step(() => fs.writeFile(join(source, 'password'), 'original'));
  const row = await step(() => fakeHarness('opencode').spawn({name:'worker',role:null,model:null,cwd:root}));
  const { hostGenerationKey } = await step(() => import('../src/adapters/processes.ts'));
  const identity = (await step(() => host.statDirectory(source))).identity;
  const state = new Map([['opencode.privateDirectory:' + hostGenerationKey(row), JSON.stringify({path:source,canonical:source,identity})]]);
  const adapter = new OpenCodeAdapter({root,discoveryFile:join(root,'hub.json'),node:'',cli:'',spoke:'',hostForProcess:()=>host,signal:()=>{},recordPid:()=>{},exited:()=>{},log:()=>{},adapterState:{read:key=>state.get(key)??null,write:(key,value)=>{state.set(key,value);}}},{env,clock:new FakeClock()});
  dispose(()=>adapter.close());
  await step(() => fs.rename(source, kept));
  await step(() => fs.mkdir(source));
  await step(() => fs.writeFile(join(source,'password'),'replacement'));
  await step(() => assert.rejects(adapter.renamed({...row,name:'new'},row.name), /identity changed/));
  assert.equal(await step(() => host.fileType(target)), 'missing');
  assert.equal(await step(() => fs.readFile(join(source,'password'),'utf8')), 'replacement');
  assert.equal(await step(() => fs.readFile(join(kept,'password'),'utf8')), 'original');
}));

for (const boundary of ['before move', 'failed move cleanup'] as const) test(`Host rename preserves a replaced reservation at ${boundary}`, t => renameCase(t, async ({step, root: acquireRoot, mocks}) => {
  const fs = await step(() => import('node:fs/promises'));
  const { syncBuiltinESMExports } = await step(() => import('node:module'));
  const root = await acquireRoot(), host = localHost(fixtureEnvironment(root,process.env));
  const source=join(root,'source'),target=join(root,'target'),kept=join(root,'reservation');
  await step(() => fs.mkdir(source));
  await step(() => fs.writeFile(join(source,'password'),'original'));
  const nativeRename=fs.default.rename,nativeLstat=fs.default.lstat;
  let controlled=false,reads=0;
  const replace=async()=>{await nativeRename(target,kept);await fs.mkdir(target);controlled=true;};
  if(boundary==='failed move cleanup') mocks.method(fs.default,'rename',async()=>{await replace();throw Object.assign(new Error('injected rename failure'),{code:'ENOENT'});});
  else mocks.method(fs.default,'lstat',async(...args:Parameters<typeof nativeLstat>)=>{
    const observed=await nativeLstat(...args);
    // Count positive reservation receipts, never missing-path owner probes.
    if(args[0]===target&&++reads===2){await replace();return nativeLstat(...args);}
    return observed;
  });
  syncBuiltinESMExports();
  await step(() => assert.rejects(host.moveDirectory!(source,target), /reservation.*changed|identity changed/));
  assert.equal(controlled,true,'the replacement boundary was reached');
  assert.equal(await step(() => host.fileType(target)), 'directory');
  assert.equal(await step(() => host.fileType(source)), 'directory');
  assert.equal(await step(() => fs.readFile(join(source,'password'),'utf8')), 'original');
}));

test('Host directory owner serializes same-directory writes while another directory progresses', t => renameCase(t, async ({step, root:acquireRoot, mocks, dispose}) => {
  const fs = await step(() => import('node:fs/promises'));
  const {syncBuiltinESMExports} = await step(() => import('node:module'));
  const {fileOperations} = await step(() => import('../src/host/agent/files.ts'));
  const root=await acquireRoot(), source=join(root,'source'), target=join(root,'target'), other=join(root,'other');
  await step(() => fs.mkdir(source)); await step(() => fs.mkdir(other));
  await step(() => fs.writeFile(join(source,'password'),'original'));
  const entered=Promise.withResolvers<void>(), release=Promise.withResolvers<void>(), events:string[]=[];
  const nativeRename=fs.default.rename,nativeWrite=fs.default.writeFile;
  mocks.method(fs.default,'rename',async (...args:Parameters<typeof nativeRename>)=>{
    events.push('move entered');entered.resolve();await release.promise;
    await nativeRename(...args);events.push('move completed');
  });
  mocks.method(fs.default,'writeFile',async (...args:Parameters<typeof nativeWrite>)=>{
    events.push(args[0]===join(source,'password')?'source write entered':'other write entered');
    return nativeWrite(...args);
  });
  syncBuiltinESMExports();
  let moving:Promise<void>|undefined,writing:Promise<void>|undefined;
  dispose(async()=>{release.resolve();await Promise.allSettled([moving,writing]);});
  moving=fileOperations.moveDirectory(source,target);
  await step(() => entered.promise);
  writing=fileOperations.writeFile(join(source,'password'),Buffer.from('queued'));
  void writing.catch(()=>{});
  await step(() => fileOperations.writeFile(join(other,'password'),Buffer.from('independent')));
  release.resolve();
  await step(() => moving!);
  await step(() => assert.rejects(writing!,{code:'ENOENT'}));
  assert.deepEqual(events,['move entered','other write entered','move completed','source write entered']);
  assert.equal(await step(() => fs.readFile(join(target,'password'),'utf8')),'original');
}));

for (const populated of [true,false]) for (const operation of ['write', 'append', 'truncate', 'local log', 'prepared log', 'agent log'] as const) test(`Host ${operation} through a file symlink${populated?'':' with a missing referent'} waits for the referent directory move`, t => renameCase(t, async ({step,root:acquireRoot,mocks,dispose})=>{
  const fs=await step(()=>import('node:fs/promises'));
  const {syncBuiltinESMExports}=await step(()=>import('node:module'));
  const {fileOperations}=await step(()=>import('../src/host/agent/files.ts'));
  const root=await acquireRoot(),source=join(root,'source'),target=join(root,'target'),aliases=join(root,'aliases'),other=join(root,'other'),link=join(aliases,'file');
  const env=fixtureEnvironment(root,{...process.env,CLAND_FAKE_HOSTS:'synthetic'});
  for(const path of [source,aliases,other])await step(()=>fs.mkdir(path));
  if(populated)await step(()=>fs.writeFile(join(source,'file'),'original'));
  await step(()=>fs.symlink(join(source,'file'),link));
  const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>(),aliasObserved=Promise.withResolvers<void>(),events:string[]=[];
  const nativeRename=fs.default.rename,nativeRealpath=fs.default.realpath;
  let moved=false;
  // Before release the topology is fixed. Synchronous fake canonical receipts
  // make admission ordering deterministic, without a timer or queue-count claim.
  mocks.method(fs.default,'realpath',async(path: string)=>{
    if(path===aliases)aliasObserved.resolve();
    if(!moved&&!populated&&(path===link||path===join(source,'file')))throw Object.assign(new Error('synthetic missing referent'),{code:'ENOENT'});
    return moved?nativeRealpath(path):path===link?join(source,'file'):path;
  });
  mocks.method(fs.default,'rename',async(...args:Parameters<typeof nativeRename>)=>{
    if(args[0]!==source)return nativeRename(...args);
    events.push('move entered');entered.resolve();await release.promise;
    await nativeRename(...args);moved=true;events.push('move complete');
  });
  for(const method of ['writeFile','appendFile','truncate','open'] as const){
    const native=fs.default[method];
    mocks.method(fs.default,method,async(...args:unknown[])=>{
      if(args[0]===link)events.push('writer entered');
      return Reflect.apply(native,fs.default,args);
    });
  }
  syncBuiltinESMExports();
  let moving:Promise<void>|undefined,writing:Promise<unknown>|undefined;
  let write:()=>Promise<unknown>;
  if(operation==='write')write=()=>fileOperations.writeFile(link,Buffer.from('changed'));
  else if(operation==='append')write=()=>fileOperations.appendFile(link,Buffer.from('changed'));
  else if(operation==='truncate')write=()=>fileOperations.writeFile(link,Buffer.alloc(0),{truncate:0});
  else if(operation==='local log')write=()=>localHost(env).spawn({command:process.execPath,args:[],cwd:root,env,logFile:link},{authorize:()=>{throw new Error('synthetic launch refused');}});
  else if(operation==='prepared log'){
    const {PreparedOperations}=await step(()=>import('../src/host/agent/prepared.ts'));
    const processes=new Proxy({}, {get:()=>()=>{throw new Error('unexpected process boundary');}}) as import('../src/host/agent/processes.ts').AgentProcesses;
    const prepared=new PreparedOperations(join(root,'run'),env,processes);
    dispose(()=>prepared.close());await step(()=>prepared.start());
    write=()=>prepared.prepare('spawn',{command:process.execPath,args:[],cwd:root,env,logFile:link});
  }else{
    const {AgentProcesses}=await step(()=>import('../src/host/agent/processes.ts'));
    const run=join(root,'run');await step(()=>fs.mkdir(run));
    await step(()=>fs.writeFile(join(run,'available-memory'),JSON.stringify({availableBytes:2_000_000_000})));
    const processes=new AgentProcesses(run,env,()=>{},{beforeBootstrap:async()=>{throw new Error('synthetic launch refused');}});
    dispose(()=>processes.drain());await step(()=>processes.load());
    write=()=>processes.spawn({command:process.execPath,args:[],cwd:root,env,logFile:link});
  }
  dispose(async()=>{release.resolve();await Promise.allSettled([moving,writing]);});
  try{
    moving=fileOperations.moveDirectory(source,target);await step(()=>entered.promise);
    writing=write();void writing.catch(()=>{});
    await step(()=>Promise.race([aliasObserved.promise,writing!.then(()=>{throw new Error('writer completed before canonical admission');},error=>{throw error;})]));
    await step(()=>fileOperations.writeFile(join(other,'file'),Buffer.from('independent')));
    events.push('independent write complete');release.resolve();await step(()=>moving!);
    // Opening or writing the dangling old link must fail after the move, rather
    // than modifying the referent while its directory has a different owner.
    await step(()=>assert.rejects(writing!,{code:'ENOENT'}));
    assert.ok(events.indexOf('writer entered')>events.indexOf('move complete'),JSON.stringify(events));
    if(populated)assert.equal(await step(()=>fs.readFile(join(target,'file'),'utf8')),'original');
    else await step(()=>assert.rejects(fs.readFile(join(target,'file')),{code:'ENOENT'}));
  }finally{release.resolve();await Promise.allSettled([moving,writing]);}
}));

test('Host directory owner fences an unknown post-move identity and never replays the move', t => renameCase(t, async ({step,root:acquireRoot,mocks})=>{
  const fs=await step(()=>import('node:fs/promises'));
  const {syncBuiltinESMExports}=await step(()=>import('node:module'));
  const {fileOperations}=await step(()=>import('../src/host/agent/files.ts'));
  const root=await acquireRoot(),source=join(root,'source'),target=join(root,'target'),kept=join(root,'moved-original');
  await step(()=>fs.mkdir(source));await step(()=>fs.writeFile(join(source,'password'),'original'));
  const nativeRename=fs.default.rename;let moves=0;
  mocks.method(fs.default,'rename',async (...args:Parameters<typeof nativeRename>)=>{
    moves++;await nativeRename(...args);await nativeRename(target,kept);await fs.mkdir(target);await fs.writeFile(join(target,'password'),'replacement');
  });
  syncBuiltinESMExports();
  await step(()=>assert.rejects(fileOperations.moveDirectory(source,target),{code:'CLAND_DIRECTORY_MOVE_UNKNOWN'}));
  await step(()=>assert.rejects(fileOperations.moveDirectory(source,target),{code:'CLAND_DIRECTORY_OWNER_FENCED'}));
  await step(()=>assert.rejects(fileOperations.writeFile(join(target,'password'),Buffer.from('must not write')),{code:'CLAND_DIRECTORY_OWNER_FENCED'}));
  assert.equal(moves,1);
  assert.equal(await step(()=>fs.readFile(join(kept,'password'),'utf8')),'original');
  assert.equal(await step(()=>fs.readFile(join(target,'password'),'utf8')),'replacement');
}));

test('Host move keeps the original native error when reservation cleanup cannot prove non-delivery', t=>renameCase(t,async({step,root:acquireRoot,mocks})=>{
  const fs=await step(()=>import('node:fs/promises'));
  const {syncBuiltinESMExports}=await step(()=>import('node:module'));
  const {fileOperations}=await step(()=>import('../src/host/agent/files.ts'));
  const root=await acquireRoot(),source=join(root,'source'),target=join(root,'target');
  await step(()=>fs.mkdir(source));await step(()=>fs.writeFile(join(source,'password'),'original'));
  const nativeRename=fs.default.rename;let moves=0;
  mocks.method(fs.default,'rename',async(...args:Parameters<typeof nativeRename>)=>{
    moves++;await nativeRename(...args);throw Object.assign(new Error('synthetic native completion lost'),{code:'EIO'});
  });
  syncBuiltinESMExports();
  await step(()=>assert.rejects(fileOperations.moveDirectory(source,target),error=>{
    assert.equal((error as NodeJS.ErrnoException).code,'CLAND_DIRECTORY_MOVE_UNKNOWN');
    assert.equal((error as Error & {cause:NodeJS.ErrnoException}).cause.code,'EIO');
    return true;
  }));
  await step(()=>assert.rejects(fileOperations.moveDirectory(source,target),{code:'CLAND_DIRECTORY_OWNER_FENCED'}));
  assert.equal(moves,1);
  assert.equal(await step(()=>fs.readFile(join(target,'password'),'utf8')),'original');
}));

for(const boundary of ['post-move identity','lost native completion'] as const) test(`Prepared Host move retains an unknown ${boundary} through settlement and restart without replay`,t=>renameCase(t,async({step,root:acquireRoot,mocks,dispose})=>{
  const fs=await step(()=>import('node:fs/promises'));
  const {syncBuiltinESMExports}=await step(()=>import('node:module'));
  const {PreparedOperations}=await step(()=>import('../src/host/agent/prepared.ts'));
  const root=await acquireRoot(),run=join(root,'run'),source=join(root,'source'),target=join(root,'target'),kept=join(root,'kept'),env=fixtureEnvironment(root,process.env);
  const processes=new Proxy({}, {get:()=>()=>{throw new Error('unexpected process boundary');}}) as import('../src/host/agent/processes.ts').AgentProcesses;
  const owners:InstanceType<typeof PreparedOperations>[]=[];
  dispose(async()=>{for(const owner of owners.reverse())await assert.rejects(owner.close(),/cleanup incomplete/);});
  await step(()=>fs.mkdir(source));await step(()=>fs.writeFile(join(source,'password'),'original'));
  const nativeRename=fs.default.rename;let moves=0;
  mocks.method(fs.default,'rename',async(...args:Parameters<typeof nativeRename>)=>{
    if(args[0]!==source)return nativeRename(...args);
    moves++;await nativeRename(...args);
    if(boundary==='lost native completion')throw Object.assign(new Error('synthetic native completion lost'),{code:'EIO'});
    await nativeRename(target,kept);await fs.mkdir(target);await fs.writeFile(join(target,'password'),'replacement');
  });
  syncBuiltinESMExports();
  const prepared=new PreparedOperations(run,env,processes);owners.push(prepared);await step(()=>prepared.start());
  const recoveryKey='synthetic-recovery',admission=await step(()=>prepared.prepare('moveDirectory',{source,target,recoveryKey})),token=admission.token!;
  await step(()=>assert.rejects(prepared.commit(token),{code:'CLAND_DIRECTORY_MOVE_UNKNOWN'}));
  const planPath=join(run,'prepared',token+'.json'),plan={kind:'moveDirectory',phase:'committing',args:{source,target},recoveryKey};
  assert.deepEqual(JSON.parse(await step(()=>fs.readFile(planPath,'utf8'))),plan);
  await step(()=>assert.rejects(fs.readFile(join(run,'prepared-results',token+'.json')),{code:'ENOENT'}));
  assert.throws(()=>prepared.assertMutable(),{code:'CLAND_AGENT_ADMISSION_REFUSED'});
  const pending={state:'pending',reason:'file commit completion unknown; never replay'};
  assert.deepEqual(await step(()=>prepared.settle(token,recoveryKey)),pending);
  await step(()=>assert.rejects(prepared.settle(token,'wrong-owner'),/not owned/));
  await step(()=>assert.rejects(prepared.commit(token)));
  assert.deepEqual(JSON.parse(await step(()=>fs.readFile(planPath,'utf8'))),plan,'a repeated commit cannot settle or discard unknown ownership');
  await step(()=>assert.rejects(prepared.close(),/cleanup incomplete/));
  const restarted=new PreparedOperations(run,env,processes);owners.push(restarted);await step(()=>restarted.start());
  assert.throws(()=>restarted.assertMutable(),{code:'CLAND_AGENT_ADMISSION_REFUSED'});
  await step(()=>assert.rejects(restarted.prepare('appendFile',{path:join(root,'must-not-write'),bytes:Buffer.from('forbidden').toString('base64')}),{code:'CLAND_AGENT_ADMISSION_REFUSED'}));
  await step(()=>assert.rejects(restarted.commit(token)));
  await step(()=>assert.rejects(restarted.abort(token),/commit outcome unknown/));
  assert.deepEqual(await step(()=>restarted.settle(token,recoveryKey)),pending);
  assert.deepEqual(JSON.parse(await step(()=>fs.readFile(planPath,'utf8'))),plan);
  assert.equal(moves,1);
  assert.equal(await step(()=>fs.readFile(join(boundary==='post-move identity'?kept:target,'password'),'utf8')),'original');
  if(boundary==='post-move identity')assert.equal(await step(()=>fs.readFile(join(target,'password'),'utf8')),'replacement');
  await step(()=>assert.rejects(fs.readFile(join(root,'must-not-write')),{code:'ENOENT'}));
}));

for (const available of [true,false]) test(`Host move consumes the ${available?'available':'unsupported'} no-replace receipt under its owner`, t=>renameCase(t,async({step,root:acquireRoot})=>{
  const fs=await step(()=>import('node:fs/promises'));
  const {createFileOperations}=await step(()=>import('../src/host/agent/files.ts'));
  const root=await acquireRoot(),source=join(root,'source'),target=join(root,'target');
  await step(()=>fs.mkdir(source));await step(()=>fs.writeFile(join(source,'password'),'original'));
  let attempts=0;
  const files=createFileOperations({renameNoReplace:async(from,to)=>{
    attempts++;
    if(!available)return 'unsupported';
    assert.equal(await files.fileType(to),'missing','native seam receives an absent destination, never a reservation');
    await fs.rename(from,to);return 'moved';
  }});
  await step(()=>files.moveDirectory(source,target));
  assert.equal(attempts,1,'the structured native availability receipt is consumed');
  assert.equal(await step(()=>files.fileType(source)),'missing');
  assert.equal(await step(()=>fs.readFile(join(target,'password'),'utf8')),'original');
}));

test('OpenCode repeated port selection fails with a bounded typed launch error', async t => {
  const { startServer, serverFiles, OpenCodePortRetryError, SERVER_PORT_ATTEMPTS } = await import('../src/adapters/opencode/server.ts');
  const { LaunchFiles } = await import('../src/adapters/launch-files.ts');
  const { OpenCodeClient } = await import('../src/adapters/opencode/client.ts');
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  let selections = 0, spawns = 0;
  const started = performance.now();
  const host = { ...recordingHost(root), stat: async () => ({ size: 0, mode: 0o600 }),
    freePort: async () => {
      // A microtask spin starves node:test's timer; enforce the red-run bound inside the fake.
      if (++selections > 1000 || performance.now() - started > 1000) throw new Error('port selection exceeded regression safety bound');
      return 12345;
    },
    spawn: async () => { spawns++; return { pid: 987654, exited: Promise.resolve({ code: 1, signal: null }) }; },
    identity: async () => null,
    readFile: async () => Buffer.from('EADDRINUSE: address already in use'),
  };
  const transaction = new LaunchFiles(undefined, host);
  await assert.rejects(startServer({ host, bin: 'synthetic-opencode', cwd: root, env,
    files: serverFiles(root, 'repeated'), password: 'synthetic', deadlineMs: 10000,
    transaction, log: () => {}, stopGraceMs: 1,
    client: async url => { const client = new OpenCodeClient(url, 'synthetic'); t.mock.method(client, 'request', async () => { throw new Error('not ready'); }); return client; },
  }), error => {
    assert.ok(error instanceof Error);
    t.diagnostic(`${error.name}: ${error.message}; port selections: ${selections}`);
    assert.ok(error instanceof OpenCodePortRetryError);
    assert.equal(error.name, 'OpenCodePortRetryError');
    assert.match(error.message, /12345/);
    assert.equal((error as Error & { port: number }).port, 12345);
    assert.equal((error as Error & { attempts: number }).attempts, 8);
    return true;
  });
  assert.equal(selections, 8);
  assert.equal(SERVER_PORT_ATTEMPTS, 8);
  assert.equal(spawns, 1);
  transaction.commit();
});

test('OpenCode address-in-use retries successfully on a fresh port', async t => {
  const { startServer, serverFiles } = await import('../src/adapters/opencode/server.ts');
  const { LaunchFiles } = await import('../src/adapters/launch-files.ts');
  const { OpenCodeClient } = await import('../src/adapters/opencode/client.ts');
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  const ports = [12345, 12346], launched: string[][] = [], requests: string[] = [];
  let selections = 0;
  const exit = { code: 0, signal: null };
  let finish!: (value: typeof exit) => void;
  const liveExit = new Promise<typeof exit>(resolve => { finish = resolve; });
  t.after(() => finish(exit));
  const host = { ...recordingHost(root), stat: async () => ({ size: 0, mode: 0o600 }),
    freePort: async () => { assert.ok(selections < ports.length); return ports[selections++]!; },
    spawn: async (command: Parameters<import('../src/host/host.ts').Host['spawn']>[0]) => {
      launched.push([...command.args]);
      return { pid: 987654 + launched.length, exited: launched.length === 1 ? Promise.resolve({ code: 1, signal: null }) : liveExit };
    },
    identity: async () => null,
    readFile: async () => Buffer.from('EADDRINUSE: address already in use'),
  };
  const transaction = new LaunchFiles(undefined, host);
  const result = await startServer({ host, bin: 'synthetic-opencode', cwd: root, env,
    files: serverFiles(root, 'fresh'), password: 'synthetic', deadlineMs: 1000,
    transaction, log: () => {}, stopGraceMs: 1,
    client: async url => { const client = new OpenCodeClient(url, 'synthetic'); t.mock.method(client, 'request', async () => { requests.push(url); if (url.endsWith(':12345')) throw new Error('not ready'); return []; }); return client; },
  });
  assert.equal(selections, 2);
  assert.deepEqual(launched.map(args => args.at(-1)), ['12345', '12346']);
  assert.deepEqual(requests, ['http://127.0.0.1:12345', 'http://127.0.0.1:12346']);
  assert.equal(result.url, 'http://127.0.0.1:12346');
  assert.equal(result.pid, 987656);
  finish(exit);
  assert.deepEqual(await result.exited, exit);
  transaction.commit();
});

test('OpenCode poll, resume and stop use the row Host and preserve its birth identity', async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  const clock = new FakeClock();
  const row = { ...await fakeHarness('opencode').spawn({ name: 'worker', role: null, model: null, cwd: root }), pid: 987654, pidStarted: 'start', pidIdentity: 'birth' };
  const calls: string[] = [];
  let alive = true;
  const host = { ...recordingHost(root), alive: async (p: typeof row) => { assert.equal(p, row); calls.push('alive'); return alive; }, stop: async (p: typeof row, options?: import('../src/host/host.ts').HostStopOptions) => { assert.equal(p, row); assert.ok(options?.authorize); options.authorize([]); assert.ok(options.log); calls.push('stop'); return true; } };
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => { calls.push('exited'); }, hostForProcess: p => { assert.equal(p, row); return host; } }, { env, clock, pollMs: 100 });
  t.after(() => adapter.close());
  const resumed = await adapter.resume(row);
  assert.equal(resumed.found, false);
  assert.equal(resumed.alive, true);
  assert.deepEqual(calls, ['alive', 'alive']);
  adapter.watch(row);
  alive = false;
  await clock.advance(100);
  await eventually('poll result published as exact row exit', () => calls.at(-1) === 'exited' ? true : undefined);
  assert.deepEqual(calls, ['alive', 'alive', 'alive', 'exited']);
  let authorized = 0;
  await adapter.stop(row, undefined, () => { authorized++; });
  assert.equal(authorized, 1);
  assert.equal(calls.at(-1), 'stop');
  alive = false;
  adapter.watch(row);
  await clock.advance(100);
  await eventually('Host death reported', () => calls.at(-1) === 'exited' ? true : undefined);
  assert.deepEqual(calls.slice(-2), ['alive', 'exited']);
});

test('OpenCode launches once through Host with unchanged serve arguments, environment, cwd and log', async t => {
  const { OpenCodeClient } = await import('../src/adapters/opencode/client.ts');
  const { readFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env, { HOST_MARKER: 'kept', CLAND_PRIVATE: 'removed', OPENCODE_CONFIG: 'removed' });
  const commands: import('../src/host/host.ts').HostCommand[] = [];
  let finish!: (result: { code: number | null; signal: string | null }) => void;
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => { finish = resolve; });
  const host = { ...recordingHost(root), spawn: async (command: import('../src/host/host.ts').HostCommand) => { commands.push(command); return { pid: 987654, exited }; }, identity: async (pid: number) => ({ pid, pidStarted: 'start', pidIdentity: 'birth' }), alive: async () => true, stop: async () => { finish({ code: 0, signal: null }); return true; } };
  t.mock.method(OpenCodeClient.prototype, 'request', async (_method: string, path: string) => {
    if (path === '/api/session/active') return { data: {} };
    if (path === '/api/session') return { data: { id: 'ses_host' } };
    throw new Error(`unexpected ${path}`);
  });
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForLaunch: () => host, hostForProcess: () => host }, { env, bin: 'synthetic-opencode' });
  let row: Awaited<ReturnType<typeof adapter.spawn>> | undefined;
  t.after(async () => { if (row) await adapter.stop(row); await adapter.close(); });
  row = await adapter.spawn({ name: 'worker', role: 'implementer', model: 'openai/gpt-5.2', cwd: root });
  assert.equal(commands.length, 1);
  const command = commands[0]!;
  assert.equal(command.command, 'synthetic-opencode');
  assert.deepEqual(command.args.slice(0, 4), ['serve', '--hostname', '127.0.0.1', '--port']);
  assert.match(command.args[4]!, /^\d+$/);
  assert.equal(command.cwd, root);
  assert.equal(command.logFile, join(root, '.cland/opencode/worker/serve.log'));
  assert.equal(command.env.HOST_MARKER, 'kept');
  assert.equal(command.env.CLAND_PRIVATE, undefined);
  assert.equal(command.env.CLAND_SESSION_ID, row.sessionId);
  assert.equal(command.env.CLAND_ROLE, 'implementer');
  assert.equal(command.env.OPENCODE_CONFIG, join(root, '.cland/opencode/worker/opencode.json'));
  assert.equal(command.env.OPENCODE_PASSWORD, (await readFile(join(root, '.cland/opencode/worker/password'), 'utf8')).trim());
  assert.equal(row.pidIdentity, 'birth');
});

test('OpenCode recovered local server without a child receipt keeps Host stop confirmation', async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  const row = { ...await fakeHarness('opencode').spawn({ name: 'recovered', role: null, model: null, cwd: root }), pid: 987654, pidIdentity: 'birth' };
  let stops = 0;
  const host = { ...recordingHost(root), stop: async () => { stops++; return true; } };
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '',
    log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForProcess: () => host }, { env });
  t.after(() => adapter.close());
  await adapter.stop(row);
  assert.equal(stops, 1);
});

for (const outcome of ['receipt', 'deadline'] as const) test(`OpenCode stop joins the launched local server exit ${outcome} after Host stop`, { timeout: 8 * testWaitMs() + 2000 }, async t => {
  const { OpenCodeClient } = await import('../src/adapters/opencode/client.ts');
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  let finish!: () => void;
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => { finish = () => resolve({ code: null, signal: 'SIGTERM' }); });
  const clock = new FakeClock();
  let exits = 0, probes = 0;
  let publishExit!: () => void;
  const exitPublished = new Promise<void>(resolve => { publishExit = resolve; });
  let stopped!: () => void;
  const stopObserved = new Promise<void>(resolve => { stopped = resolve; });
  const host = { ...recordingHost(root), spawn: async () => ({ pid: 987654, exited }),
    identity: async (pid: number) => ({ pid, pidStarted: 'start', pidIdentity: 'birth' }),
    alive: async () => { probes++; return false; },
    stop: async () => { stopped(); return true; } };
  t.mock.method(OpenCodeClient.prototype, 'request', async (_method: string, path: string) => {
    if (path === '/api/session/active') return { data: {} };
    if (path === '/api/session') return { data: { id: 'ses_receipt' } };
    throw new Error(`unexpected ${path}`);
  });
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '',
    log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => { exits++; publishExit(); }, hostForLaunch: () => host, hostForProcess: () => host }, { env, clock, pollMs: 100 });
  beforeDirectories(t, async () => { finish(); await adapter.close(); });
  const row = await adapter.spawn({ name: 'worker', role: null, model: 'openai/gpt-5.2', cwd: root });
  adapter.watch(row);
  if (outcome === 'deadline') t.mock.timers.enable({ apis: ['setTimeout'] });
  let completed = false;
  const stopping = adapter.stop(row).then(() => { completed = true; });
  try {
    await stopObserved;
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(completed, false, 'Host stop can observe a zombie before the local child exit is reaped');
    if (outcome === 'deadline') {
      const refused = assert.rejects(stopping, /cleanup-incomplete: launch settlement exceeded 5000 ms/);
      t.mock.timers.tick(5000);
      await refused;
      assert.equal(completed, false, 'deadline never acknowledges settlement');
      await clock.advance(100);
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.ok(probes > 0, 'watched row liveness was checked after stop timed out');
      assert.equal(exits, 0, 'negative liveness cannot retire an unreaped local launch');
    }
  } finally { finish(); await stopping.catch(() => {}); }
  if (outcome === 'deadline') {
    await exitPublished;
    assert.equal(exits, 1, 'positive native exit receipt publishes the watched row exit');
  }
  if (outcome === 'deadline') await adapter.stop(row).then(() => { completed = true; });
  assert.equal(completed, true);
});

test('Host launch rollback retains files until its native completion receipt', async t => {
  const { LaunchFiles } = await import('../src/adapters/launch-files.ts');
  const { readFile, writeFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  let finish!: () => void;
  let stopped!: () => void;
  let stopObserved = false;
  const stopReceipt = new Promise<void>(resolve => { stopped = resolve; });
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => { finish = () => resolve({ code: null, signal: 'SIGTERM' }); });
  const host = { ...recordingHost(root), identity: async (pid: number) => ({ pid, pidStarted: 'start', pidIdentity: 'birth' }), stop: async () => { stopObserved = true; stopped(); return true; } };
  const files = new LaunchFiles(work => work(), host);
  const path = join(root, 'owned.log');
  await files.file(path);
  await writeFile(path, 'writer output');
  files.spawned({ pid: 987654, exited }, () => {}, 10);
  const rollback = files.rollback();
  try {
    await eventually('rollback stop completion setup', () => stopObserved || undefined);
    await stopReceipt;
    assert.equal(await readFile(path, 'utf8'), 'writer output');
    assert.deepEqual(files.pids, [987654]);
  } finally { finish(); await rollback; }
  await assert.rejects(readFile(path), { code: 'ENOENT' });
  assert.deepEqual(files.pids, []);
});

for (const boundary of ['alive', 'identity'] as const) test(`OpenCode close joins held resume ${boundary} and fences relaunch`, async t => {
  const root = await tempProject(t);
  const row = { ...await fakeHarness('opencode').spawn({ name: 'held', cwd: root, role: null, model: null }), pid: 987654 };
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let entered = false, completed = false, stops = 0, spawns = 0;
  const host = { ...recordingHost(root), alive: async () => {
    if (boundary === 'alive') { entered = true; await held; completed = true; }
    return false;
  }, identity: async (pid: number) => { entered = true; await held; completed = true; return { pid, pidIdentity: 'birth', pidStarted: 'start' }; }, stop: async () => { stops++; return true; }, spawn: async () => { spawns++; throw new Error('unexpected spawn'); } };
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForProcess: () => host, hostForLaunch: () => host }, { bin: 'synthetic-opencode', env: fixtureEnvironment(root, process.env) });
  const resumed = adapter.resume(row, { relaunch: true });
  const outcome = resumed.then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
  t.after(async () => { release(); await outcome; await adapter.close(); });
  await eventually(`held ${boundary} setup admitted`, () => entered || undefined);
  let closedBeforeCompletion = false;
  const closing = adapter.close().then(() => { closedBeforeCompletion = !completed; });
  await new Promise<void>(resolve => setImmediate(resolve));
  release();
  await closing;
  const result = await outcome;
  assert.equal(closedBeforeCompletion, false);
  assert.match(String(result.error), /closed/);
  assert.equal(result.value, undefined);
  assert.equal(stops, 0);
  assert.equal(spawns, 0);
});

test('OpenCode close joins stream Host liveness and prevents late reconnect work', async t => {
  const { OpenCodeClient } = await import('../src/adapters/opencode/client.ts');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  const clock = new FakeClock();
  const row = { ...await fakeHarness('opencode').spawn({ name: 'stream', cwd: root, role: null, model: null }), pid: 987654, harnessId: 'http://scripted', harnessSessionId: 'ses_stream' };
  await mkdir(join(root, '.cland/opencode/stream'), { recursive: true });
  await writeFile(join(root, '.cland/opencode/stream/password'), 'synthetic');
  let endStream: (() => void) | undefined;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let entered = false, completed = false, exits = 0, probes = 0;
  t.mock.method(OpenCodeClient.prototype, 'events', async () => new Promise<void>(resolve => { endStream = resolve; }));
  const host = { ...recordingHost(root), alive: async () => { probes++; entered = true; await held; completed = true; return true; } };
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => { exits++; }, hostForProcess: () => host }, { env: fixtureEnvironment(root, process.env), clock, pollMs: 10000 });
  t.after(async () => { endStream?.(); release(); await adapter.close(); });
  adapter.watch(row);
  await eventually('stream subscription setup admitted', () => endStream);
  endStream!();
  await eventually('stream liveness setup admitted', () => entered || undefined);
  let closedBeforeCompletion = false;
  const closing = adapter.close().then(() => { closedBeforeCompletion = !completed; });
  await new Promise<void>(resolve => setImmediate(resolve));
  release();
  await closing;
  assert.equal(closedBeforeCompletion, false);
  await clock.advance(10000);
  assert.equal(probes, 1);
  assert.equal(exits, 0);
});

test('OpenCode close owns a late accepted spawn and joins rollback before releasing files', async t => {
  const { readFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  let releaseSpawn!: () => void, finish!: () => void;
  const held = new Promise<void>(resolve => { releaseSpawn = resolve; });
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => { finish = () => resolve({ code: null, signal: 'SIGTERM' }); });
  let spawning = false, stopped = false, complete = false;
  const host = { ...recordingHost(root), spawn: async () => { spawning = true; await held; return { pid: 987654, exited }; }, identity: async (pid: number) => ({ pid, pidStarted: 'start', pidIdentity: 'birth' }), stop: async () => { stopped = true; return true; } };
  const adapter = new OpenCodeAdapter({ root, durableLaunchRecovery: true, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForProcess: () => host, hostForLaunch: () => host }, { bin: 'synthetic-opencode', env: fixtureEnvironment(root, process.env) });
  const launch = adapter.spawn({ name: 'late', cwd: root, role: null, model: 'openai/gpt-5.2' });
  const rejected = assert.rejects(launch, /closed/);
  t.after(async () => { releaseSpawn(); finish(); await Promise.allSettled([rejected, adapter.close()]); });
  await eventually('spawn setup admitted', () => spawning || undefined);
  const closing = adapter.close().then(() => { complete = true; });
  releaseSpawn();
  await eventually('late native PID stop completed', () => stopped || undefined);
  assert.equal(complete, false);
  assert.ok(await readFile(join(root, '.cland/opencode/late/password'), 'utf8'));
  finish();
  await rejected;
  await closing;
  await assert.rejects(readFile(join(root, '.cland/opencode/late/password')), { code: 'ENOENT' });
});

test('OpenCode revocation during Host log open is checked before native spawn', async t => {
  const { default: fs } = await import('node:fs/promises');
  const { default: cp } = await import('node:child_process');
  const { syncBuiltinESMExports } = await import('node:module');
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let opened = false, revoked = false, nativeSpawns = 0;
  const open = fs.open;
  const intercepted = t.mock.method(fs, 'open', async (...args: Parameters<typeof open>) => {
    const handle = await open(...args);
    if (args[0] === join(root, '.cland/opencode/revoked/serve.log')) { opened = true; await held; }
    return handle;
  });
  const spawn = t.mock.method(cp, 'spawn', () => { nativeSpawns++; throw new Error('unexpected native spawn'); });
  syncBuiltinESMExports();
  const host = localHost(env);
  const adapter = new OpenCodeAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForLaunch: () => host }, { env, bin: 'synthetic-opencode' });
  const launch = adapter.spawn({ name: 'revoked', cwd: root, role: null, model: 'openai/gpt-5.2' }, undefined, () => { if (revoked) throw new Error('authority revoked'); });
  const rejected = assert.rejects(launch, /authority revoked/);
  t.after(async () => { release(); await Promise.allSettled([rejected, adapter.close()]); intercepted.mock.restore(); spawn.mock.restore(); syncBuiltinESMExports(); });
  await eventually('native log preparation held', () => opened || undefined);
  revoked = true;
  release();
  await rejected;
  assert.equal(nativeSpawns, 0);
  await assert.rejects(fs.readFile(join(root, '.cland/opencode/revoked/password')), { code: 'ENOENT' });
});

test('OpenCode close reports incomplete launch cleanup and retains its durable owner', async t => {
  const { LaunchFiles, LaunchRecoveryPending } = await import('../src/adapters/launch-files.ts');
  const { readFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  let releaseSpawn!: () => void, finish!: () => void;
  const held = new Promise<void>(resolve => { releaseSpawn = resolve; });
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => { finish = () => resolve({ code: 0, signal: null }); });
  let spawning = false, canStop = false;
  const host = { ...recordingHost(root), spawn: async () => { spawning = true; await held; return { pid: 987654, exited }; }, identity: async (pid: number) => ({ pid, pidStarted: 'start', pidIdentity: 'birth' }), stop: async () => canStop };
  const adapter = new OpenCodeAdapter({ root, durableLaunchRecovery: true, discoveryFile: join(root, '.cland/hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForLaunch: () => host }, { bin: 'synthetic-opencode', env: fixtureEnvironment(root, process.env) });
  const outcome = adapter.spawn({ name: 'incomplete', cwd: root, role: null, model: 'openai/gpt-5.2' }).catch(error => error as unknown);
  t.after(async () => {
    releaseSpawn(); finish(); await exited; canStop = true;
    const error = await outcome;
    if (error instanceof LaunchRecoveryPending) await LaunchFiles.restore(error.files, work => work(), host).rollback();
    await adapter.close().catch(() => {});
  });
  await eventually('incomplete spawn setup admitted', () => spawning || undefined);
  const closing = assert.rejects(adapter.close(), /launch cleanup incomplete/);
  releaseSpawn();
  await closing;
  const error = await outcome;
  assert.ok(error instanceof LaunchRecoveryPending);
  assert.equal(error.files.children[0]?.pid, 987654);
  assert.ok(await readFile(join(root, '.cland/opencode/incomplete/password'), 'utf8'));
});
