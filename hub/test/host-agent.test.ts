// T3: isolated Unix agent protocol and native detached processes; no hub or provider.
// Lifecycle: scratch HOME/Git env, joined server/client close, stopped children before root removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveAgent } from '../src/host/agent/server.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownProcess } from './process-cleanup.ts';
import { VERSION } from '../src/version.ts';
import { AgentClient } from '../src/host/agent-client.ts';

test('agent authenticates hello, negotiates protocol and retains connection after unknown op', { timeout: 15000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-'));
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(root, 'boot'), '11111111-1111-1111-1111-111111111111');
  const server = await serveAgent({ runDir: root, secret: 'synthetic-secret', version: 'test-version', env: { CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: join(root, 'boot') } });
  try {
    for (const secret of ['', 'other']) await assert.rejects(AgentClient.connect(server.socket, secret), /hello|secret/);
    const client = await AgentClient.connect(server.socket, 'synthetic-secret');
    try {
      assert.equal(client.hello.version, 'test-version');
      assert.equal(client.hello.pid, process.pid);
      assert.equal(client.hello.protocol, 1);
      assert.equal(client.hello.bootId, process.platform === 'linux' ? (await (await import('node:fs/promises')).readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim() : '11111111-1111-1111-1111-111111111111');
      await assert.rejects(client.request('unknown', {}), /unknown/);
      assert.equal((await client.request('hello', { protocol: 1, secret: 'synthetic-secret' }) as { pid: number }).pid, process.pid);
    } finally { await client.close(); }
  } finally { await server.close(); await rm(root, { recursive: true, force: true }); }
});

test('agent persists detached process identity and usage, fences stale signals and emits native exit', { timeout: 15000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-process-'));
  const { writeFile, readFile } = await import('node:fs/promises');
  const { eventually } = await import('./harness.ts');
  const boot = join(root, 'boot'); await writeFile(boot, '11111111-1111-1111-1111-111111111111');
  const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: boot, CLAND_HOST_SECRET: 'must-not-leak' });
  const options = { runDir: root, secret: 'secret', version: 'test', env, memoryIntervalMs: 20 };
  let server = await serveAgent(options);
  let client = await AgentClient.connect(server.socket, 'secret');
  let child: { pid: number; identity: string } | undefined;
  let independentCleanup = async () => {};
  try {
    const memory = new Promise<Record<string, any>>(resolve => client.on('event', frame => { if (frame.event === 'memory') resolve(frame); }));
    child = await client.request('spawn', { command: process.execPath, args: ['-e', "console.log(JSON.stringify({pid:process.pid,cwd:process.cwd(),marker:process.env.MARKER,secret:process.env.CLAND_HOST_SECRET})); setInterval(()=>{},1000)"], cwd: root, env: { ...env, MARKER: 'private-env' }, logFile: join(root, 'child.log') }) as typeof child;
    assert.ok(child); independentCleanup = ownProcess(undefined, child.pid); assert.match(child.identity, /^linux:[a-f0-9-]+:\d+$/);
    await eventually('child log receipt', async () => (await readFile(join(root, 'child.log'), 'utf8')).includes('private-env') || undefined);
    const log = JSON.parse((await readFile(join(root, 'child.log'), 'utf8')).trim());
    assert.equal(log.pid, child.pid); assert.equal(log.cwd, await (await import('node:fs/promises')).realpath(root)); assert.equal(log.secret, undefined);
    const wrong = { ...child, identity: child.identity + '0' };
    assert.equal(await client.request('signal', { ...wrong, signal: 'SIGKILL' }), false);
    assert.equal(await client.request('stop', wrong), false);
    assert.equal(await client.request('signal', { ...child, identity: child.identity.replace(/linux:[^:]+:/, 'linux:22222222-2222-2222-2222-222222222222:'), signal: 'SIGKILL' }), false);
    await client.close(); await server.close();
    server = await serveAgent(options); client = await AgentClient.connect(server.socket, 'secret');
    const rows = await client.request('processes', {}) as any[];
    const row = rows.find(r => r.pid === child!.pid);
    assert.equal(row.identity, child.identity);
    if (process.platform === 'linux') {
      const stat = await readFile(`/proc/${child.pid}/stat`, 'utf8');
      const ticks = stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/)[19];
      const bootId = (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim();
      assert.equal(child.identity, `linux:${bootId}:${ticks}`);
    } assert.equal(row.alive, true); assert.ok(row.rssBytes > 0); assert.ok(row.cpuPercent >= 0);
    const sample = await memory; assert.ok(sample.totalBytes > 0); assert.ok(sample.availableBytes >= 0);
    assert.equal(await client.request('stop', child), true);
    const exits: Array<{pid:number;identity:string;code:number|null}> = [];
    client.on('event', frame => { if (frame.event === 'process-exited') exits.push(frame); });
    const short = await client.request('spawn', { command: process.execPath, args: ['-e', 'setTimeout(()=>process.exit(7),100)'], cwd: root, env }) as {pid: number;identity:string};
    const receipt = await eventually('exact short-process exit receipt', () => exits.find(event => event.pid === short.pid && event.identity === short.identity)); assert.equal(receipt.pid, short.pid); assert.equal(receipt.identity, short.identity); assert.equal(receipt.code, 7);
  } finally {
    if (child) await client.request('stop', child).catch(() => {});
    await independentCleanup();
    await client.close(); await server.close(); await rm(root, { recursive: true, force: true });
  }
});

test('agent refuses pre-hello ops, keeps malformed authenticated lines open and fences reboot identity', { timeout: 15000 }, async () => {
  const { writeFile } = await import('node:fs/promises');
  const { createConnection } = await import('node:net');
  const { createInterface } = await import('node:readline');
  const root = await mkdtemp(join(tmpdir(), 'agent-wire-'));
  await writeFile(join(root, 'boot'), '11111111-1111-1111-1111-111111111111');
  const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: join(root, 'boot') });
  const server = await serveAgent({ runDir: root, secret: 'secret', version: 'test', env });
  const socket = createConnection(server.socket); const lines = createInterface({ input: socket })[Symbol.asyncIterator]();
  try {
    const closed = new Promise(resolve => socket.once('close', resolve));
    socket.write(JSON.stringify({ id: '1', op: 'processes', args: {} }) + '\n');
    assert.equal(JSON.parse((await lines.next()).value!).ok, false); await closed;
    for (const args of [{ protocol: 1 }, { protocol: 0, secret: 'secret' }]) {
      const refused = createConnection(server.socket); const refusedLines = createInterface({ input: refused })[Symbol.asyncIterator]();
      const ended = new Promise(resolve => refused.once('close', resolve));
      refused.write(JSON.stringify({ id: 'no', op: 'hello', args }) + '\n');
      assert.equal(JSON.parse((await refusedLines.next()).value!).ok, false); await ended;
    }
    const wire = createConnection(server.socket); const replies = createInterface({ input: wire })[Symbol.asyncIterator]();
    try {
      wire.write(JSON.stringify({ id: '2', op: 'hello', args: { protocol: 1, secret: 'secret' } }) + '\n'); assert.equal(JSON.parse((await replies.next()).value!).ok, true);
      wire.write('not json\n'); assert.equal(JSON.parse((await replies.next()).value!).ok, false);
      wire.write(JSON.stringify({ id: '3', op: 'processes', args: {} }) + '\n'); assert.equal(JSON.parse((await replies.next()).value!).ok, true);
    } finally { const closed = new Promise(resolve => wire.once('close', resolve)); wire.destroy(); await closed; }
  } finally { socket.destroy(); await server.close(); await rm(root, { recursive: true, force: true }); }
});

test('detached child survives native agent death and is recovered by the CLI restart', { timeout: 20000 }, async t => {
  const { spawn, execFileSync } = await import('node:child_process');
  const { writeFile } = await import('node:fs/promises');
  const { eventually } = await import('./harness.ts');
  const root = await mkdtemp(join(tmpdir(), 'agent-cli-'));
  const boot = join(root, 'boot'); const bootId = '11111111-1111-1111-1111-111111111111'; await writeFile(boot, bootId);
  const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: boot, CLAND_HOST_RUN_DIR: root, CLAND_HOST_SECRET: 'synthetic' });
  const cli = new URL('../bin/cland.ts', import.meta.url);
  const start = () => {
    const native = spawn(process.execPath, [cli.pathname, 'host', 'serve'], { cwd: root, env: fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: boot, CLAND_HOST_RUN_DIR: root, CLAND_HOST_SECRET: 'synthetic' }), stdio: ['ignore', 'ignore', 'pipe'] });
    const state: { exit?: { code: number | null; signal: string | null }; tail: string } = { tail: '' };
    native.stderr?.on('data', chunk => { state.tail = (state.tail + String(chunk)).slice(-4096); });
    const closed = new Promise<void>(resolve => native.once('close', (code, signal) => { state.exit = { code, signal }; resolve(); })); return { native, closed, state };
  };
  let cleanupChild = async () => {};
  let agent = start(); let client: AgentClient | undefined; let child: { pid: number; identity: string } | undefined;
  try {
    client = await eventually('agent authenticated readiness', () => AgentClient.connect(join(root, 'agent.sock'), 'synthetic').catch(() => undefined));
    assert.equal(client.hello.version, VERSION);
    child = await client.request('spawn', { command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd: root, env }) as typeof child;
    assert.ok(child); cleanupChild = ownProcess(undefined, child.pid);
    const ps = execFileSync('ps', ['-p', String(child.pid), '-o', 'pgid=,command='], { env: fixtureEnvironment(root, process.env), encoding: 'utf8' });
    assert.equal(Number(ps.trim().split(/\s+/)[0]), child.pid); assert.ok(!ps.includes('synthetic'));
    agent.native.kill('SIGKILL'); await agent.closed; await client.close();
    agent = start(); client = await eventually('restarted agent authenticated readiness', () => AgentClient.connect(join(root, 'agent.sock'), 'synthetic').catch(() => undefined));
    assert.equal(await client.request('alive', child), true);
    if (process.platform !== 'linux') {
      await writeFile(boot, '22222222-2222-2222-2222-222222222222');
      await assert.rejects(client.request('signal', { ...child, signal: 'SIGKILL' }), /authority unknown/);
      await writeFile(boot, bootId);
      await assert.rejects(client.request('stop', child), /authority unknown/);
    } else assert.equal(await client.request('stop', child), true);
  } catch (error) { t.diagnostic(JSON.stringify({ incomplete: 'native agent CLI assertion', ...agent.state })); throw error; } finally {
    if (child && client) await client.request('stop', child).catch(() => {});
    await cleanupChild();
    await client?.close(); agent.native.kill('SIGTERM'); await agent.closed; await rm(root, { recursive: true, force: true });
  }
});

test('stop observes descendants after the root exits and kills a TERM-resistant child', { timeout: 20000 }, async () => {
  const { writeFile, readFile } = await import('node:fs/promises');
  const { eventually } = await import('./harness.ts');
  const root = await mkdtemp(join(tmpdir(), 'agent-tree-'));
  await writeFile(join(root, 'boot'), '11111111-1111-1111-1111-111111111111');
  const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: join(root, 'boot') });
  const script = join(root, 'parent.cjs'); const receipt = join(root, 'ready');
  await writeFile(script, `const {spawn}=require('node:child_process'); const fs=require('node:fs');
const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{}); require('node:fs').writeFileSync(process.argv[1],String(process.pid)); setInterval(()=>{},1000)",process.argv[2]],{env:process.env,stdio:'ignore'}); setInterval(()=>{},1000);`);
  const server = await serveAgent({ runDir: root, secret: 'secret', version: 'test', env });
  const client = await AgentClient.connect(server.socket, 'secret');
  let cleanRoot = async () => {}; let cleanChild = async () => {};
  try {
    const parent = await client.request('spawn', { command: process.execPath, args: [script, receipt], cwd: root, env }) as { pid: number; identity: string };
    cleanRoot = ownProcess(undefined, parent.pid);
    const pid = await eventually('descendant TERM handler ready receipt', async () => { try { return Number(await readFile(receipt, 'utf8')) || undefined; } catch { return undefined; } });
    cleanChild = ownProcess(undefined, pid);
    assert.equal(await client.request('stop', parent), true);
    // The captured child must be gone, not merely the root.
    assert.equal(await client.request('identity', { pid }), null);
  } finally { await cleanChild(); await cleanRoot(); await client.close(); await server.close(); await rm(root, { recursive: true, force: true }); }
});

import type { TestContext } from 'node:test';
import type { ProcessHooks } from '../src/host/agent/processes.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { eventually } from './harness.ts';
async function faultFixture(t: TestContext, hooks: ProcessHooks = {}, memoryIntervalMs = 5000) {
  const root = await mkdtemp(join(tmpdir(), 'agent-fault-'));
  await writeFile(join(root, 'boot'), '11111111-1111-1111-1111-111111111111');
  const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: join(root, 'boot') });
  const owned: Array<() => Promise<void>> = [];
  const server = await serveAgent({ runDir: root, secret: 'secret', version: 'test', env, memoryIntervalMs, processHooks: {
    ...hooks, afterSpawn: async (pid, directory) => { owned.push(ownProcess(undefined, pid)); await hooks.afterSpawn?.(pid, directory); },
  } });
  const client = await AgentClient.connect(server.socket, 'secret');
  t.after(async () => { for (const clean of owned) await clean(); await client.close(); await server.close(); await rm(root, { recursive: true, force: true }); });
  return { root, env, client, server, spawn: (args = ['-e', 'setInterval(()=>{},1000)']) => client.request('spawn', { command: process.execPath, args, cwd: root, env, logFile: join(root, 'log') }) as Promise<{pid:number;identity:string;warning?:string}> };
}
function deferred() { let reached = false; let resolve!: () => void; const promise = new Promise<void>(r => { resolve = () => { reached = true; r(); }; }); return { promise, resolve, reached: () => reached }; }

test('accepted spawn keeps its PID and exit ownership after log descriptor close failure', { timeout: 15000 }, async t => {
  const fixture = await faultFixture(t, { closeLog: async close => { await close(); throw new Error('synthetic close fault'); } });
  const child = await fixture.spawn();
  assert.equal(child.warning, 'log descriptor close failed'); assert.equal(await fixture.client.request('alive', child), true);
  const rows = await fixture.client.request('processes', {}) as Array<{pid:number}>; assert.ok(rows.some(row => row.pid === child.pid));
  assert.equal(await fixture.client.request('stop', child), true);
});

test('spawn release follows admission and native exit publishes exactly once after its own checkpoint', { timeout: 20000 }, async t => {
  const initialEntered = deferred(), initialRelease = deferred(), exitEntered = deferred(), exitRelease = deferred();
  const fixture = await faultFixture(t, { beforeCheckpoint: async phase => {
    if (phase === 'spawn') { initialEntered.resolve(); await initialRelease.promise; }
    if (phase === 'exit') { exitEntered.resolve(); await exitRelease.promise; }
  } });
  const events: Array<{event:string;pid:number;code:number}> = [];
  fixture.client.on('event', event => { if (event.event === 'process-exited') events.push(event); });
  const request = fixture.spawn(['-e', 'process.exit(3)']);
  try {
    await initialEntered.promise;
    assert.equal(events.length, 0);
    initialRelease.resolve(); const child = await request; await exitEntered.promise;
    assert.equal(events.length, 0);
    const before = JSON.parse(await readFile(join(fixture.root, 'processes.json'), 'utf8')) as Array<{pid:number;code?:number}>;
    assert.equal(before.find(row => row.pid === child.pid)?.code, undefined);
    exitRelease.resolve();
    await eventually('exact durable exit event', () => events.find(event => event.pid === child.pid));
    const after = JSON.parse(await readFile(join(fixture.root, 'processes.json'), 'utf8')) as Array<{pid:number;code:number}>;
    assert.equal(after.find(row => row.pid === child.pid)?.code, 3);
    await fixture.server.close(); assert.equal(events.length, 1);
  } finally { initialRelease.resolve(); exitRelease.resolve(); await request.catch(() => {}); }
});

test('socket mode failure drains acquisition and permits the same path to restart', { timeout: 15000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-acquire-')); await writeFile(join(root, 'boot'), '11111111-1111-1111-1111-111111111111');
  const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: join(root, 'boot') });
  try {
    await assert.rejects(serveAgent({ runDir: root, env, secret: 'secret', version: 'test', socketChmod: async () => { throw new Error('synthetic chmod'); } }), /synthetic chmod/);
    const server = await serveAgent({ runDir: root, env, secret: 'secret', version: 'test' });
    try { const client = await AgentClient.connect(server.socket, 'secret'); await client.close(); } finally { await server.close(); }
  } finally { await rm(root, {recursive:true,force:true}); }
});

test('failed protocol stop still joins independent native cleanup before fixture root deletion', { timeout: 15000 }, async t => {
  const fixture = await faultFixture(t); const child = await fixture.spawn();
  const clean = ownProcess(undefined, child.pid);
  assert.equal(await fixture.client.request('stop', { ...child, identity: child.identity + '0' }), false);
  await clean(); assert.equal(await fixture.client.request('identity', {pid:child.pid}), null);
});

test('confirmed closed recovery checkpoints bounded history and shares one observation pass', { timeout: 15000 }, async () => {
  const { AgentProcesses } = await import('../src/host/agent/processes.ts');
  const root = await mkdtemp(join(tmpdir(), 'agent-history-')); await writeFile(join(root, 'boot'), '11111111-1111-1111-1111-111111111111');
  const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: join(root, 'boot') });
  const rows = Array.from({length:600}, (_, i) => ({pid: 10000000 + i, identity: 'linux:11111111-1111-1111-1111-111111111111:1', ended: true, code: null}));
  await writeFile(join(root, 'processes.json'), JSON.stringify(rows));
  const observations: number[] = []; const owner = new AgentProcesses(root, env, () => {}, { observed: count => observations.push(count) });
  try {
    await owner.load(); await Promise.all([owner.reconcile(),owner.reconcile(),owner.reconcile()]);
    const compact = await readFile(join(root, 'processes.json'), 'utf8');
    const stored = JSON.parse(compact) as Array<{ended:boolean;code:null}>;
    assert.equal(stored.length,256); assert.ok(stored.every(row => row.ended && row.code === null)); assert.ok(Buffer.byteLength(compact)<65536);
    assert.deepEqual(observations,[0]);
    await owner.drain();
    const counts: number[]=[]; const restarted = new AgentProcesses(root,env,()=>{}, {observed: count=>counts.push(count)});
    try { await restarted.load(); await restarted.reconcile(); assert.deepEqual(counts,[0]); } finally { await restarted.drain(); }
  } finally { await owner.drain(); await rm(root,{recursive:true,force:true}); }
});

test('agent death before first process checkpoint recovers gated admission and fast completion', { timeout: 25000 }, async t => {
  const { spawn } = await import('node:child_process');
  const root = await mkdtemp(join(tmpdir(),'agent-admission-')); const boot=join(root,'boot'), hold=join(root,'held');
  await writeFile(boot,'11111111-1111-1111-1111-111111111111');
  const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'1',CLAND_HOST_BOOT_ID_FILE:boot,CLAND_HOST_RUN_DIR:root,CLAND_HOST_SECRET:'synthetic',CLAND_HOST_TEST_HOLD_SPAWN:hold});
  const entry=new URL('../bin/cland.ts',import.meta.url).pathname;
  const start=()=>{
    const child=spawn(process.execPath,[entry,'host','serve'],{cwd:root,env:fixtureEnvironment(root,env,{CLAND_FAKE_HOSTS:'1',CLAND_HOST_BOOT_ID_FILE:boot,CLAND_HOST_RUN_DIR:root,CLAND_HOST_SECRET:'synthetic',CLAND_HOST_TEST_HOLD_SPAWN:hold}),stdio:['ignore','ignore','pipe']});
    let tail=''; child.stderr.on('data',chunk=>{tail=(tail+String(chunk)).slice(-4096);});
    const closed=new Promise<void>(resolve=>child.once('close',()=>resolve())); return {child,closed,tail:()=>tail};
  };
  let agent=start(), client:AgentClient|undefined, clean=async()=>{}; let request:Promise<unknown>|undefined;
  const completed=join(root,'completed');
  try {
    client=await eventually('admission agent hello',()=>AgentClient.connect(join(root,'agent.sock'),'synthetic').catch(()=>undefined));
    request=client.request('spawn',{command:process.execPath,args:['-e',"require('node:fs').writeFileSync(process.argv[1],'completed')",completed],cwd:root,env}); void request.catch(()=>{});
    const receipt=await eventually('native launch gate receipt',async()=>{try{return JSON.parse(await readFile(hold,'utf8')) as {pid:number;directory:string};}catch{return undefined;}});
    clean=ownProcess(undefined,receipt.pid);
    const birth=await eventually('bootstrap durable birth receipt',async()=>{try{return JSON.parse(await readFile(join(receipt.directory,'birth.json'),'utf8')) as {pid:number;identity:string};}catch{return undefined;}});
    assert.equal(birth.pid,receipt.pid);
    const before=JSON.parse(await readFile(join(root,'processes.json'),'utf8')) as Array<{pid:number}>;
    assert.ok(!before.some(row=>row.pid===birth.pid));
    agent.child.kill('SIGKILL'); await agent.closed; await client.close(); await assert.rejects(request,/closed/);
    agent=start(); client=await eventually('recovery agent hello',()=>AgentClient.connect(join(root,'agent.sock'),'synthetic').catch(()=>undefined));
    const rows=await client.request('processes',{}) as Array<{pid:number;identity:string}>;
    assert.ok(rows.some(row=>row.pid===birth.pid&&row.identity===birth.identity));
    await eventually('admitted command completed after recovery release',async()=>{try{return await readFile(completed,'utf8')==='completed'||undefined;}catch{return undefined;}});
    await eventually('recovered original process positively ended',async()=>await client!.request('identity',{pid:birth.pid})===null||undefined);
    const terminal=await client.request('processes',{}) as Array<{pid:number;authority:string;code:null}>;
    assert.ok(terminal.some(row=>row.pid===birth.pid&&row.authority==='unknown'&&row.code===null));
  } catch(error){t.diagnostic(JSON.stringify({incomplete:'admission recovery',tail:agent.tail()}));throw error;}
  finally {await clean(); await client?.close(); agent.child.kill('SIGTERM'); await agent.closed; await request?.catch(()=>{}); await rm(root,{recursive:true,force:true});}
});

test('signal excludes a newly arrived group member and refuses changed native birth before any target', { timeout:20000 }, async t=>{
  let fixture:Awaited<ReturnType<typeof faultFixture>>; let mode:'arrival'|'birth'='arrival'; let added:number|undefined; let cleanAdded=async()=>{};
  const receipt=()=>join(fixture.root,'added'); const handled=()=>join(fixture.root,'handled');
  fixture=await faultFixture(t,{beforeSignals:async targets=>{
    if(mode==='arrival'){
      process.kill(targets[0]!.pid,'SIGUSR1');
      added=await eventually('new member ready receipt',async()=>{try{return Number(await readFile(receipt(),'utf8'))||undefined;}catch{return undefined;}});
      cleanAdded=ownProcess(undefined,added);
    }else if(process.platform!=='linux') await writeFile(join(fixture.root,'boot'),'22222222-2222-2222-2222-222222222222');
  }});
  const script=join(fixture.root,'signal.cjs');
  await writeFile(script,`const fs=require('node:fs');const {spawn}=require('node:child_process');
process.on('SIGUSR1',()=>spawn(process.execPath,['-e',"require('node:fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)",process.argv[2]],{env:process.env,stdio:'ignore'}));
process.on('SIGUSR2',()=>fs.writeFileSync(process.argv[3],'handled'));fs.writeFileSync(process.argv[4],'ready');setInterval(()=>{},1000);`);
  let root:{pid:number;identity:string}|undefined;
  try{
    root=await fixture.spawn([script,receipt(),handled(),join(fixture.root,'ready')]);
    await eventually('root handlers installed',async()=>{try{return await readFile(join(fixture.root,'ready'),'utf8')==='ready'||undefined;}catch{return undefined;}});
    assert.equal(await fixture.client.request('signal',{...root,signal:'SIGUSR2'}),true);
    await eventually('root signal delivery receipt',async()=>{try{return await readFile(handled(),'utf8')==='handled'||undefined;}catch{return undefined;}});
    assert.ok(await fixture.client.request('identity',{pid:added}));
    mode='birth';
    if(process.platform!=='linux'){
      assert.equal(await fixture.client.request('signal',{...root,signal:'SIGKILL'}),false);
      await writeFile(join(fixture.root,'boot'),'11111111-1111-1111-1111-111111111111');
      assert.equal(await fixture.client.request('alive',root),true);
    }
  }finally{await writeFile(join(fixture.root,'boot'),'11111111-1111-1111-1111-111111111111');await cleanAdded();}
});

test('recovery never inherits signal authority from a stale serialized birth', {timeout:15000}, async t=>{
  const fixture=await faultFixture(t); const child=await fixture.spawn();
  await fixture.client.close(); await fixture.server.close();
  const rows=JSON.parse(await readFile(join(fixture.root,'processes.json'),'utf8')) as Array<{pid:number;identity:string}>;
  const stale=rows.find(row=>row.pid===child.pid)!; stale.identity+='0';
  await writeFile(join(fixture.root,'processes.json'),JSON.stringify(rows));
  const {AgentProcesses}=await import('../src/host/agent/processes.ts');
  const recovered=new AgentProcesses(fixture.root,fixture.env,()=>{});
  try{
    await recovered.load(); await recovered.reconcile();
    await assert.rejects(recovered.signal({...stale,signal:'SIGKILL'}), /authority unknown/);
    assert.equal(await recovered.identity(child.pid),child.identity);
  }finally{await recovered.drain();}
});

test('recovery observation cannot replace a concurrently checkpointed native exit code', {timeout:20000}, async t=>{
  const captured=deferred(), release=deferred(); let hold=false;
  const fixture=await faultFixture(t,{beforeRecoveryObservation:async()=>{if(hold){captured.resolve();await release.promise;}}});
  const trigger=join(fixture.root,'exit');
  const exits:Array<{pid:number;code:number|null}>=[]; fixture.client.on('event',event=>{if(event.event==='process-exited')exits.push(event);});
  const child=await fixture.spawn(['-e',"const fs=require('node:fs');setInterval(()=>{if(fs.existsSync(process.argv[1]))process.exit(19)},10)",trigger]);
  hold=true;
  const request=fixture.client.request('processes',{});
  try{
    await eventually('recovery observation setup receipt', () => captured.reached() || undefined, 3000);
    await writeFile(trigger,'exit');
    await eventually('native code 19 durable event',()=>exits.find(event=>event.pid===child.pid&&event.code===19));
    release.resolve(); await request;
    const final=JSON.parse(await readFile(join(fixture.root,'processes.json'),'utf8')) as Array<{pid:number;code:number}>;
    assert.equal(final.find(row=>row.pid===child.pid)?.code,19);
    assert.equal(exits.filter(event=>event.pid===child.pid).length,1);
  }finally{hold=false;release.resolve();await request.catch(()=>{});}
});

test('live root close retains descendant births through restart and permits later complete stop', {timeout:20000}, async t=>{
  const fixture=await faultFixture(t); const ready=join(fixture.root,'descendant');
  const script=join(fixture.root,'parent.cjs');
  await writeFile(script,`const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',"require('node:fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)",process.argv[2]],{env:process.env,stdio:'ignore'});child.once('spawn',()=>process.exit(23));`);
  const exits:Array<{pid:number;code:number;authority:string;ended:boolean}>=[];
  fixture.client.on('event',event=>{if(event.event==='process-exited')exits.push(event);});
  const parent=await fixture.spawn([script,ready]);
  let clean=async()=>{};let server:Awaited<ReturnType<typeof serveAgent>>|undefined,client:AgentClient|undefined;
  try{
    const pid=await eventually('orphan writer ready receipt',async()=>{try{return Number(await readFile(ready,'utf8'))||undefined;}catch{return undefined;}});clean=ownProcess(undefined,pid);
    const rootExit=await eventually('root 23 native event with retained ownership',()=>exits.find(event=>event.pid===parent.pid));
    assert.equal(rootExit.code,23);assert.equal(rootExit.authority,'owned');assert.equal(rootExit.ended,false);
    const rows=JSON.parse(await readFile(join(fixture.root,'processes.json'),'utf8')) as Array<{pid:number;launchId:string;targets:Array<{pid:number}>}>;
    const owned=rows.find(row=>row.pid===parent.pid)!;assert.ok(owned.targets.some(target=>target.pid===pid));
    await readFile(join(fixture.root,'launches',owned.launchId,'admission.json'),'utf8');
    await fixture.client.close();await fixture.server.close();
    server=await serveAgent({runDir:fixture.root,env:fixture.env,secret:'secret',version:'test'});client=await AgentClient.connect(server.socket,'secret');
    const recovered=await client.request('processes',{}) as Array<{pid:number;authority:string;ended:boolean}>;
    assert.ok(recovered.some(row=>row.pid===parent.pid&&row.authority==='owned'&&!row.ended));
    assert.equal(await client.request('stop',parent),true);
    await eventually('descendant native absence',async()=>await client!.request('identity',{pid})===null||undefined);
    const final=await client.request('processes',{}) as Array<{pid:number;authority:string;ended:boolean;code:number}>;
    assert.ok(final.some(row=>row.pid===parent.pid&&row.authority==='closed'&&row.ended&&row.code===23));
    await assert.rejects(readFile(join(fixture.root,'launches',owned.launchId,'admission.json'),'utf8'),{code:'ENOENT'});
  }finally{await clean();await client?.close();await server?.close();}
});

test('root exit missed while agent is down retains unknown authority and refuses stop without signals', {timeout:25000}, async t=>{
  const {spawn}=await import('node:child_process');const {observeProcesses}=await import('../src/host/agent/native.ts');
  const root=await mkdtemp(join(tmpdir(),'agent-unknown-'));const boot=join(root,'boot'),ready=join(root,'descendant'),trigger=join(root,'exit');
  await writeFile(boot,'11111111-1111-1111-1111-111111111111');
  const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'1',CLAND_HOST_BOOT_ID_FILE:boot,CLAND_HOST_RUN_DIR:root,CLAND_HOST_SECRET:'synthetic'});
  const script=join(root,'parent.cjs');await writeFile(script,`const fs=require('node:fs');const {spawn}=require('node:child_process');spawn(process.execPath,['-e',"require('node:fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)",process.argv[2]],{env:process.env,stdio:'ignore'});setInterval(()=>{if(fs.existsSync(process.argv[3]))process.exit(29)},10);`);
  const start=()=>{const native=spawn(process.execPath,[new URL('../bin/cland.ts',import.meta.url).pathname,'host','serve'],{cwd:root,env:fixtureEnvironment(root,env,{CLAND_FAKE_HOSTS:'1',CLAND_HOST_BOOT_ID_FILE:boot,CLAND_HOST_RUN_DIR:root,CLAND_HOST_SECRET:'synthetic'}),stdio:['ignore','ignore','pipe']});
    let tail='';native.stderr.on('data',chunk=>{tail=(tail+String(chunk)).slice(-4096);});const closed=new Promise<void>(resolve=>native.once('close',()=>resolve()));return{native,closed,tail:()=>tail};};
  let agent=start(),client:AgentClient|undefined,cleanRoot=async()=>{},cleanChild=async()=>{};
  try{
    client=await eventually('unknown fixture agent hello',()=>AgentClient.connect(join(root,'agent.sock'),'synthetic').catch(()=>undefined));
    const parent=await client.request('spawn',{command:process.execPath,args:[script,ready,trigger],cwd:root,env}) as {pid:number;identity:string};cleanRoot=ownProcess(undefined,parent.pid);
    const pid=await eventually('downtime descendant ready',async()=>{try{return Number(await readFile(ready,'utf8'))||undefined;}catch{return undefined;}});cleanChild=ownProcess(undefined,pid);
    const before=(await observeProcesses([pid],env)).get(pid)!.identity;
    agent.native.kill('SIGKILL');await agent.closed;await client.close();await writeFile(trigger,'exit');
    await eventually('missed root native absence',async()=>(await observeProcesses([parent.pid],env)).get(parent.pid)?.ended||undefined);
    agent=start();client=await eventually('unknown recovery agent hello',()=>AgentClient.connect(join(root,'agent.sock'),'synthetic').catch(()=>undefined));
    const rows=await client.request('processes',{}) as Array<{pid:number;authority:string;ended:boolean;launchId:string;code:null}>;
    const row=rows.find(row=>row.pid===parent.pid)!;assert.equal(row.authority,'unknown');assert.equal(row.ended,false);assert.equal(row.code,null);
    await readFile(join(root,'launches',row.launchId,'admission.json'),'utf8');
    await assert.rejects(client.request('stop',parent),/process authority unknown.*reboot or recycling/);
    assert.equal((await observeProcesses([pid],env)).get(pid)?.identity,before);
  }catch(error){t.diagnostic(JSON.stringify({incomplete:'unknown authority fixture',tail:agent.tail()}));throw error;}
  finally{await cleanChild();await cleanRoot();await client?.close();agent.native.kill('SIGTERM');await agent.closed;await rm(root,{recursive:true,force:true});}
});

test('detached descendant captured before reparenting stays owned; uncaptured escape is never signalled', {timeout:25000}, async t=>{
  const {observeProcesses}=await import('../src/host/agent/native.ts');
  for(const capture of [true,false]){
    const fixture=await faultFixture(t,{},60000);
    const ready=join(fixture.root,'detached'),trigger=join(fixture.root,'exit'),script=join(fixture.root,'parent.cjs');
    await writeFile(script,`const fs=require('node:fs');const {spawn}=require('node:child_process');spawn(process.execPath,['-e',"require('node:fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)",process.argv[2]],{detached:true,env:process.env,stdio:'ignore'}).unref();setInterval(()=>{if(fs.existsSync(process.argv[3]))process.exit(31)},10);`);
    const exits:Array<{pid:number;authority:string;ended:boolean}>=[];fixture.client.on('event',event=>{if(event.event==='process-exited')exits.push(event);});
    const parent=await fixture.spawn([script,ready,trigger]);let clean=async()=>{};
    try{
      const pid=await eventually('detached writer ready before parent exit',async()=>{try{return Number(await readFile(ready,'utf8'))||undefined;}catch{return undefined;}});clean=ownProcess(undefined,pid);
      const identity=(await observeProcesses([pid],fixture.env)).get(pid)!.identity;
      if(capture){
        const rows=await fixture.client.request('processes',{}) as Array<{pid:number;targets:Array<{pid:number;identity:string}>}>;
        assert.ok(rows.find(row=>row.pid===parent.pid)?.targets.some(target=>target.pid===pid&&target.identity===identity),'durable ancestry capture receipt');
      }
      await writeFile(trigger,'exit');
      const event=await eventually('natural root exit with boundary classification',()=>exits.find(event=>event.pid===parent.pid));
      if(capture){
        assert.equal(event.authority,'owned');assert.equal(event.ended,false);
        assert.equal(await fixture.client.request('stop',parent),true);
        await eventually('captured detached descendant absence',async()=>(await observeProcesses([pid],fixture.env)).get(pid)?.ended||undefined);
      }else{
        assert.equal(event.authority,'closed');assert.equal(event.ended,true);
        assert.equal(await fixture.client.request('stop',parent),false);
        assert.equal((await observeProcesses([pid],fixture.env)).get(pid)?.identity,identity);
      }
    }finally{await clean();}
  }
  const sentence='A descendant that escaped before any capture is outside cland’s authority on both Hosts and is never signalled; host recycling clears it.';
  assert.ok((await readFile(new URL('../../docs/agents/host-agent.md',import.meta.url),'utf8')).includes(sentence));
  assert.ok((await readFile(new URL('../README.md',import.meta.url),'utf8')).includes(sentence));
});

test('live-root resource samples retain a captured reparented writer and count each PID once', {timeout:25000}, async t=>{
  const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const native=promisify(execFile);
  const fixture=await faultFixture(t,{},60000);const ready=join(fixture.root,'ready'),reparent=join(fixture.root,'reparent');
  const middle=join(fixture.root,'middle.cjs'),parentScript=join(fixture.root,'parent.cjs');
  await writeFile(middle,`const fs=require('node:fs');const {spawn}=require('node:child_process');
spawn(process.execPath,['-e',"global.keep=Buffer.alloc(64*1024*1024,1);require('node:fs').writeFileSync(process.argv[1],JSON.stringify({pid:process.pid,middle:process.ppid}));setInterval(()=>{},1000)",process.argv[2]],{detached:true,env:process.env,stdio:'ignore'}).unref();setInterval(()=>{if(fs.existsSync(process.argv[3]))process.exit(0)},10);`);
  await writeFile(parentScript,`const {spawn}=require('node:child_process');spawn(process.execPath,[process.argv[2],process.argv[3],process.argv[4]],{env:process.env,stdio:'ignore'});setInterval(()=>{},1000);`);
  const parent=await fixture.spawn([parentScript,middle,ready,reparent]);let clean=async()=>{};
  type Sample={pid:number;alive:boolean;rssBytes:number|null;cpuPercent:number|null;targets:Array<{pid:number;identity:string}>};
  try{
    const writer=await eventually('retained writer allocation and native ready receipt',async()=>{try{return JSON.parse(await readFile(ready,'utf8')) as {pid:number;middle:number};}catch{return undefined;}});clean=ownProcess(undefined,writer.pid);
    const captured=(await fixture.client.request('processes',{}) as Sample[]).find(row=>row.pid===parent.pid)!;
    assert.ok(captured.targets.some(target=>target.pid===writer.pid));
    const all=await native('ps',['-p',[parent.pid,writer.middle,writer.pid].join(','),'-o','rss='],{env:fixtureEnvironment(fixture.root,process.env),timeout:3000});
    const total=all.stdout.trim().split(/\s+/).reduce((sum,kb)=>sum+Number(kb)*1024,0);
    assert.ok(captured.rssBytes!==null&&captured.rssBytes<=total+16*1024*1024,'captured ancestry has no duplicate PID accounting');
    await writeFile(reparent,'exit intermediate');
    await eventually('writer native reparenting while root remains alive',async()=>{
      const result=await native('ps',['-p',String(writer.pid),'-o','ppid='],{env:fixtureEnvironment(fixture.root,process.env),timeout:3000});
      return Number(result.stdout.trim())!==writer.middle||undefined;
    },3000);
    const retained=(await fixture.client.request('processes',{}) as Sample[]).find(row=>row.pid===parent.pid)!;
    assert.equal(retained.alive,true);assert.ok(retained.targets.some(target=>target.pid===writer.pid));
    const usage=await native('ps',['-p',String(writer.pid),'-o','rss='],{env:fixtureEnvironment(fixture.root,process.env),timeout:3000});
    const writerRss=Number(usage.stdout.trim())*1024;assert.ok(writerRss>=64*1024*1024);
    assert.ok(retained.rssBytes!==null&&retained.rssBytes>=writerRss,'live-root total includes retained writer resident bytes');
    assert.ok(retained.cpuPercent!==null&&Number.isFinite(retained.cpuPercent)&&retained.cpuPercent>=0);
    assert.equal(await fixture.client.request('stop',parent),true);
    await eventually('retained writer native absence',async()=>await fixture.client.request('identity',{pid:writer.pid})===null||undefined);
  }finally{await clean();}
});
