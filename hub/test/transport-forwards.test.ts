// T3: fake SSH master native death/reconnect and native bound-socket census.
// Lifecycle: carrier joins every SSH child; in-process agent and peers close before fixture storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory, onCleanup, beforeDirectories, rememberProcess } from './process-cleanup.ts';
import { createFakeHost, hostControl } from './fakes/fake-host.ts';
import { serveAgent } from '../src/host/agent/server.ts';
import { HostRecords, HostSecretStore, hostPaths } from '../src/host/records.ts';
import { processIdentityAsync } from '../src/process-identity.ts';
import { processTableArgs, parseProcessTable } from '../src/process-table.ts';
import { SshTransport } from '../src/transport/ssh.ts';
import { eventually } from './harness.ts';
import { testWaitMs } from './until.ts';
import { listenerFailure, fixtureTreePids } from './tcp-listener-census.ts';

async function fixture(t: import('node:test').TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'fw-'));
  ownDirectory(t, root);
  const db = new DatabaseSync(':memory:');
  const blocked = new Set<string>(), removals: string[] = [];
  const removalFailures: Array<{ path: string; master: string; code: string }> = [];
  const peers = new Set<net.Socket>();
  let carrier: SshTransport | undefined, agent: Awaited<ReturnType<typeof serveAgent>> | undefined;
  onCleanup(t, () => { blocked.clear(); });
  onCleanup(t, () => carrier?.stop());
  onCleanup(t, () => agent?.close());
  onCleanup(t, () => { for (const s of peers) s.destroy(); });
  beforeDirectories(t, () => db.close());
  const host = await createFakeHost(root, 'one');
  const records = new HostRecords(db), secrets = new HostSecretStore(root, records);
  const record = secrets.register({ id: 'one', address: 'one', user: 'agent', clientKeyPath: join(host.directory, 'client-key'), knownHosts: `one ${host.key}\n` });
  const paths = hostPaths(root, 'one');
  if (!paths.socketDirectory.startsWith(root + '/')) ownDirectory(t, paths.socketDirectory);
  const argvFile = join(root, 'argv');
  const launchesFile = join(root, 'launches');
  const ssh = join(root, 'ssh');
  await writeFile(ssh, `#!${process.execPath}\nimport {appendFileSync,existsSync} from 'node:fs'; import {processIdentityAsync} from '${new URL('../src/process-identity.ts',import.meta.url).pathname}'; appendFileSync(${JSON.stringify(launchesFile)},JSON.stringify({pid:process.pid,birth:await processIdentityAsync(process.pid,process.env)})+'\\n'); const a=process.argv.slice(2); appendFileSync(${JSON.stringify(argvFile)},JSON.stringify(a)+'\\n'); if(a.includes('forward')&&a.some(s=>s.endsWith(':4567'))&&existsSync(${JSON.stringify(join(root,'fail'))}))process.exit(1); await import('${new URL('./fakes/fake-ssh.ts',import.meta.url).pathname}');`, { mode: 0o700 });
  const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: 'one', CLAND_FAKE_HOST_ROOT: root, CLAND_SSH_BIN: ssh, CLAND_HOST_BOOT_ID_FILE: host.bootId });
  // Existing agent is in-process; bootstrap's installed supervisor check must start nothing.
  const supervisor = join(root, 'supervisor'); await writeFile(supervisor, 'exit 0\n');
  agent = await serveAgent({ runDir: host.run, secret: secrets.readSecret('one'), version: 'test', env });
  const logs: string[] = [];
  carrier = new SshTransport({ root, record, secrets, hubSocket: fixtureSocketPath(root,'hub'), spokeSocket: fixtureSocketPath(root,'spoke'), remoteRun: host.run, supervisor, agentCommand: ['unused'], env, reconnectDelayMs: () => 10, forwardRetryDelaysMs: [10, 10], unlinkSessionSocket: async (path: string) => {
    removals.push(path);
    try {
      if (blocked.has(path)) throw Object.assign(new Error('injected unlink refusal'), {code:'EACCES'});
      await unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        const { token } = JSON.parse(await readFile(join(host.directory,'master-control'),'utf8')) as { token: string };
        removalFailures.push({ path, master: token, code: 'EACCES' });
      }
      throw error;
    }
  }, random: () => .5, log: s => logs.push(s) });
  function track(s: net.Socket) { peers.add(s); s.on('error',()=>s.destroy()); s.once('close',()=>peers.delete(s)); return s; }
  async function echo(path: string) { const server = net.createServer({ allowHalfOpen: true }, s => track(s).pipe(s)); onCleanup(t, () => new Promise<void>(r => server.close(() => r()))); await new Promise<void>((r,j)=>{ server.once('error',j); server.listen(path,r); }); }
  async function exchange(path: string) { return new Promise<string>((r,j)=>{ const s=track(net.createConnection({path,allowHalfOpen:true})); let out=''; s.setTimeout(500,()=>s.destroy(new Error('exchange timeout'))); s.once('error',j); s.once('connect',()=>s.end('proof')); s.on('data',b=>out+=b); s.once('end',()=>{s.destroy();r(out);}); }); }
  const unix = join(host.home,'codex.sock'), port = join(host.home,'opencode.sock');
  await echo(unix); await echo(port); await writeFile(join(host.directory,'ports.json'),JSON.stringify({'4567':port}));
  await carrier.start(); await eventually('authenticated master ready',()=>carrier!.status().state==='up'||undefined,10000);
  return { root, host, paths, carrier, env, logs, unix, exchange, launches: async () => (await readFile(launchesFile,'utf8')).trim().split('\n').map(line => JSON.parse(line) as {pid:number;birth:string|null}), blocked, removals, removalFailures, generation: async () => JSON.parse(await readFile(join(host.directory,'master-control'),'utf8')).token as string, argv: async()=> (await readFile(argvFile,'utf8')).trim().split('\n').map(s=>JSON.parse(s) as string[]) };
}

async function listenerDecoy(t: import('node:test').TestContext) {
  // A different fixture worker can bind TCP without belonging to this fixture.
  const decoyRoot = await mkdtemp(join(tmpdir(), 'fw-decoy-'));
  ownDirectory(t, decoyRoot);
  const decoy = spawn(process.execPath, ['--input-type=module', '-e', `
    import net from 'node:net';
    const tcp = net.createServer();
    tcp.listen(0, '127.0.0.1', () => process.send({port: tcp.address().port}));
    process.on('message', () => tcp.close(() => process.disconnect()));
  `], { cwd: decoyRoot, env: fixtureEnvironment(decoyRoot, process.env), stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  rememberProcess(decoy.pid, decoyRoot);
  let receipt: {code: number | null; signal: NodeJS.Signals | null} | undefined;
  const closed = new Promise<void>((resolve, reject) => { decoy.once('error', reject); decoy.once('close', (code, signal) => {receipt = {code, signal}; resolve();}); });
  void closed.catch(() => {});
  let decoyPort: number | undefined;
  decoy.on('message', message => { decoyPort = (message as {port: number}).port; });
  onCleanup(t, async () => { if (decoy.connected) decoy.send('close'); await closed; });
  await eventually('decoy listener bound', () => decoyPort, testWaitMs());
  return {root:decoyRoot, decoy, port:decoyPort!, receipt:()=>receipt};
}

test('C1 Unix and host-loopback forwards answer with no hub TCP listener; C2 cancellation removes both', {timeout:20000}, async t => {
  const f = await fixture(t);
  const {decoy, port:decoyPort} = await listenerDecoy(t);
  // Native positive control before creating forwards: lsof must see this exact listener.
  const control = net.createServer(); await new Promise<void>(r=>control.listen(0,'127.0.0.1',r));
  onCleanup(t, async()=>{if(control.listening) await new Promise<void>(r=>control.close(()=>r()));});
  const port = (control.address() as net.AddressInfo).port;
  const census = async(pid:number) => { try { return (await promisify(execFile)('lsof',['-nP','-a','-p',String(pid),'-iTCP','-sTCP:LISTEN'],{env:fixtureEnvironment(f.root, process.env), timeout:3000})).stdout; } catch(e) { if((e as {code?:number}).code===1)return ''; throw e; } };
  assert.match(await census(decoy.pid!), new RegExp(':'+decoyPort+'\\b'));
  assert.match(await census(process.pid),new RegExp(':'+port+'\\b'));
  const holderPaths = new Map<number, string[]>();
  const assertNoListeners = async (sources: Map<number, string[]>) => {
    const failures: string[] = [];
    const env = fixtureEnvironment(f.root, process.env);
    const rows = parseProcessTable((await promisify(execFile)('ps', processTableArgs(), {env:fixtureEnvironment(f.root, process.env), timeout:3000})).stdout);
    const roots: number[] = [];
    for (const launch of await f.launches()) {
      if (launch.birth && await processIdentityAsync(launch.pid, env) === launch.birth) roots.push(launch.pid);
    }
    assert.ok(roots.length > 0, 'fixture has a live SSH launch with its recorded native birth');
    const owned = fixtureTreePids(roots, rows);
    owned.add(process.pid); // authenticated agent and echo targets run in this worker
    for (const pid of owned) if (!sources.has(pid)) sources.set(pid, ['fixture launch tree']);
    for (const [pid, sourcesForPid] of sources) {
      if (!owned.has(pid)) {
        if (sourcesForPid.includes('control-socket holder')) {
          t.diagnostic(`Excluded TCP census holder pid=${pid} command=${JSON.stringify(rows.find(row => row.pid === pid)?.command ?? 'unavailable')} requestedPath=${JSON.stringify(f.paths.controlSocket)} matchedPaths=${JSON.stringify(holderPaths.get(pid) ?? [])}`);
        }
        continue;
      }
      const failure = await listenerFailure(pid, sourcesForPid, {
        identity: () => processIdentityAsync(pid, env),
        listeners: () => census(pid),
        description: async () => {
          const rows = parseProcessTable((await promisify(execFile)('ps', processTableArgs([pid]), { env: fixtureEnvironment(f.root, process.env), timeout: 3000 })).stdout);
          return rows.find(row => row.pid === pid) ?? null;
        },
      });
      if (failure) failures.push(failure);
    }
    assert.equal(failures.length, 0, `Unexpected TCP listeners:\n${failures.join('\n')}`);
  };
  // The same assertion used below must attribute a planted listener, not merely
  // fail with lsof's truncated command column.
  await assert.rejects(assertNoListeners(new Map([[process.pid, ['worker', 'control-socket holder (positive control)']]])), error => {
    const message = (error as Error).message;
    assert.match(message, new RegExp(`pid=${process.pid}\\b`));
    assert.match(message, /source=worker, control-socket holder/);
    assert.match(message, /command=.*transport-forwards/);
    assert.match(message, /nativeStart=(darwin:|linux:)/);
    assert.match(message, /parent=\d+/);
    assert.match(message, new RegExp(':'+port+'\\b'));
    return true;
  });
  await new Promise<void>(r=>control.close(()=>r()));
  const a=await f.carrier.forward('codex', {socket:f.unix}), b=await f.carrier.forward('opencode', {port:4567});
  for(const endpoint of [a,b]) { assert.ok('socket' in endpoint); assert.equal(dirname(endpoint.socket),f.paths.socketDirectory); assert.ok(Buffer.byteLength(endpoint.socket)+1<=104); assert.equal(await f.exchange(endpoint.socket),'proof'); }
  const receipt=JSON.parse(await readFile(join(f.host.directory,'master-control'),'utf8'));
  // Keep every native control-socket holder; do not assume each holder is the master.
  const holderSnapshot = (await promisify(execFile)('lsof',['-nP','-Fpn',f.paths.controlSocket],{env:fixtureEnvironment(f.root, process.env), timeout:3000})).stdout;
  let holder: number | undefined;
  for (const line of holderSnapshot.split('\n')) {
    if (line.startsWith('p')) { holder = Number(line.slice(1)); holderPaths.set(holder, []); }
    else if (line.startsWith('n') && holder !== undefined) holderPaths.get(holder)!.push(line.slice(1));
  }
  const native = [...holderPaths.keys()];
  assert.ok(native.length>0,JSON.stringify(receipt));
  const sources = new Map<number, string[]>([[process.pid, ['worker']]]);
  for (const pid of native) sources.set(pid, [...(sources.get(pid) ?? []), 'control-socket holder']);
  // Deterministically model lsof returning an unrelated worker as a candidate.
  sources.set(decoy.pid!, ['control-socket holder', 'unrelated decoy candidate']);
  await assertNoListeners(sources);
  await f.carrier.unforward('codex'); await f.carrier.unforward('opencode');
  for(const endpoint of [a,b]) if('socket' in endpoint) { await assert.rejects(stat(endpoint.socket),{code:'ENOENT'}); await assert.rejects(f.exchange(endpoint.socket)); }
  const rows=await f.argv(); assert.equal(rows.filter(a=>a.includes('cancel')).length,2);
});

test('C3 SIGKILL restores every retained forward and excludes cancelled sessions', {timeout:15000}, async t => {
  const f=await fixture(t);
  const a=await f.carrier.forward('codex',{socket:f.unix}), b=await f.carrier.forward('opencode',{port:4567});
  await f.carrier.forward('cancelled',{socket:f.unix}); await f.carrier.unforward('cancelled');
  const first=await f.generation();
  await hostControl('kill-master','one',f.env);
  await eventually('every retained forward answering after replacement',async()=>{
    if(f.carrier.status().state!=='up'||await f.generation()===first)return undefined;
    try { return await f.exchange(a.socket)==='proof' && await f.exchange(b.socket)==='proof' || undefined; } catch { return undefined; }
  },10000);
  assert.equal(await f.exchange(a.socket),'proof'); assert.equal(await f.exchange(b.socket),'proof');
  await assert.rejects(stat(f.paths.sessionSocket('cancelled')),{code:'ENOENT'});
});

test('C3 exhausted forward logs once and is forgotten on later replacement', {timeout:15000}, async t => {
  const f=await fixture(t), a=await f.carrier.forward('codex',{socket:f.unix});
  await f.carrier.forward('opencode',{port:4567});
  await writeFile(join(f.root,'fail'),'yes');
  const before=(await f.argv()).filter(a=>a.includes('forward')&&a.some(s=>s.endsWith(':4567'))).length;
  await hostControl('kill-master','one',f.env);
  await eventually('one terminal session failure log',()=>f.logs.some(s=>s.includes('opencode'))||undefined,10000);
  assert.equal(f.logs.filter(s=>s.includes('opencode')).length,1);
  assert.match(f.logs.find(s=>s.includes('opencode'))!,/3 attempts/);
  assert.equal((await f.argv()).filter(a=>a.includes('forward')&&a.some(s=>s.endsWith(':4567'))).length-before,3);
  await eventually('survivor restored after exhausted owner closes',async()=>{try{if(f.carrier.status().state!=='up'||f.carrier.status().reconnects<2)return undefined;return await f.exchange(a.socket)==='proof'||undefined;}catch{return undefined;}},10000);
  const previous=await f.generation();
  await hostControl('kill-master','one',f.env);
  await eventually('survivor answers on third replacement',async()=>{if(f.carrier.status().state!=='up'||await f.generation()===previous)return undefined;try{return await f.exchange(a.socket)==='proof'||undefined;}catch{return undefined;}},10000);
  assert.equal(f.logs.filter(s=>s.includes('opencode')).length,1);
  assert.equal((await f.argv()).filter(a=>a.includes('forward')&&a.some(s=>s.endsWith(':4567'))).length-before,3);
  assert.equal(await f.exchange(a.socket),'proof');
});

test('C2 acknowledged cancellation retains failed unlink for retry and stop without another cancel', {timeout:15000}, async t => {
  const f=await fixture(t), endpoint=await f.carrier.forward('retry',{socket:f.unix});
  f.blocked.add(endpoint.socket);
  await assert.rejects(f.carrier.unforward('retry'),/injected unlink refusal/);
  await assert.rejects(f.carrier.unforward('retry'),/injected unlink refusal/);
  assert.equal((await f.argv()).filter(a=>a.includes('cancel')).length,1);
  assert.equal(f.removals.filter(p=>p===endpoint.socket).length,2);
  await assert.rejects(f.carrier.stop(),/injected unlink refusal/);
  f.blocked.clear(); await f.carrier.stop();
  assert.equal(f.removals.filter(p=>p===endpoint.socket).length,4);
  await assert.rejects(stat(endpoint.socket),{code:'ENOENT'});
  await f.carrier.unforward('retry');
  assert.equal(f.removals.filter(p=>p===endpoint.socket).length,4);
});

test('C3 exhausted restore logs once and retains failed cleanup without reinstalling', {timeout:20000}, async t => {
  const f=await fixture(t), endpoint=await f.carrier.forward('abandoned',{port:4567});
  f.blocked.add(endpoint.socket); await writeFile(join(f.root,'fail'),'yes');
  await hostControl('kill-master','one',f.env);
  await eventually('abandonment has a terminal log despite removal failure',()=>f.logs.some(s=>s.includes('session abandoned'))||undefined,10000);
  const abandonedReceipt=await eventually('abandoned socket removal rejected',()=>f.removalFailures.find(r=>r.path===endpoint.socket),10000);
  const abandonedMaster=abandonedReceipt.master;
  // The collector was armed by fixture setup, before the master kill. Each
  // receipt identifies this socket's rejected removal and its captured master.
  const receipt=await eventually('this socket removal rejected on a later replacement',()=>f.removalFailures.find(r=>r.path===endpoint.socket&&r.master!==abandonedMaster),10000);
  assert.equal(receipt.path,endpoint.socket); assert.equal(receipt.code,'EACCES');
  assert.notEqual(receipt.master,abandonedMaster);
  await assert.rejects(f.carrier.unforward('abandoned'),/injected unlink refusal/);
  const attempts=(await f.argv()).filter(a=>a.includes('forward')&&a.some(s=>s.endsWith(':4567'))).length;
  assert.equal(attempts,4); // first successful install and exactly three failed restores
  f.blocked.clear(); await f.carrier.unforward('abandoned');
  await assert.rejects(stat(endpoint.socket),{code:'ENOENT'});
  await eventually('replacement ready after pending cleanup',()=>f.carrier.status().state==='up'||undefined,10000);
  assert.equal((await f.argv()).filter(a=>a.includes('forward')&&a.some(s=>s.endsWith(':4567'))).length,attempts);
  assert.equal((await f.argv()).filter(a=>a.includes('cancel')).length,0);
  assert.equal(f.logs.filter(s=>s.includes('session abandoned')).length,1);
});

test('failed initial installation retains socket cleanup until stop retry', {timeout:15000}, async t => {
  const f=await fixture(t), socket=f.paths.sessionSocket('initial');
  f.blocked.add(socket); await writeFile(join(f.root,'fail'),'yes');
  await assert.rejects(f.carrier.forward('initial',{port:4567}),/injected unlink refusal/);
  await assert.rejects(f.carrier.stop(),/injected unlink refusal/);
  f.blocked.clear(); await f.carrier.stop();
  assert.equal(f.removals.filter(p=>p===socket).length,3);
  assert.equal((await f.argv()).filter(a=>a.includes('forward')&&a.some(s=>s.endsWith(':4567'))).length,1);
  await assert.rejects(stat(socket),{code:'ENOENT'});
});


test('cleanup rejection still joins fixture and decoy before removing their roots', {timeout:20000}, async t => {
  const hooks: Array<() => Promise<void>> = [];
  const owner = {after: (hook: () => Promise<void>) => {hooks.push(hook);}} as unknown as import('node:test').TestContext;
  let attempted = 0;
  const finish = async () => { while (attempted < hooks.length) await hooks[attempted++]!(); };
  onCleanup(t, finish); // joins remaining owners if the expected-red assertion fails
  const failure = new Error('injected cleanup rejection');
  onCleanup(owner, () => {throw failure;});
  const f = await fixture(owner), decoy = await listenerDecoy(owner);
  await assert.rejects(finish(), error => error === failure);
  assert.deepEqual(decoy.receipt(), {code:0, signal:null}, 'decoy native close precedes outer completion');
  await assert.rejects(stat(f.root), {code:'ENOENT'});
  await assert.rejects(stat(decoy.root), {code:'ENOENT'});
});
