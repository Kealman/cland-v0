// T3: fake SSH subprocesses only; disposable homes and Unix sockets, no real SSH/network.
// Lifecycle: join every child and close every server before removing the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment } from './fixture-environment.ts';
const ssh = fileURLToPath(new URL('./fakes/fake-ssh.ts', import.meta.url));
for(const [harness,command] of [
 ['claude-code',"CLAUDE_CONFIG_DIR='/cland/auth/claude-code-work' claude auth login"],
 ['codex',"CODEX_HOME='/cland/auth/codex-work' codex login --device-auth"],
 ['opencode',"OPENCODE_DB='/cland/auth/opencode-work/opencode.db' opencode auth login"],
] as const) test(`terminal ${harness} sign-in stays inside the authenticated fake machine`,async t=>{
 const f=await forwardingFixture(t);
 const child=f.launch([...f.base,'-t','one',command],ssh,'synthetic-code\n');
 const result=await child.join();assert.equal(result.code,0,child.output());
 const login=JSON.parse(await readFile(join(f.host.directory,'cland/auth',`${harness}-work`,'login.json'),'utf8'));
 assert.equal(login.generation,0);assert.equal(typeof login.token,'string');
 assert.ok(!child.output().includes(login.token));
});
test('fake SSH refuses unrecognized login disk commands before local execution',async t=>{
 const f=await forwardingFixture(t);
 const child=f.launch([...f.base,'-t','one','cat /cland/auth/codex-work/login.json']);
 assert.equal((await child.join()).code,255);assert.match(child.output(),/unsupported login disk command/);
});
test('fake SSH terminal sign-in cannot execute a harness planted on PATH',async t=>{
 const f=await forwardingFixture(t);
 await writeFile(join(f.root,'bin/claude'),'#!/bin/sh\necho REAL-HARNESS-TRAP\nexit 91\n',{mode:0o700});
 const child=f.launch([...f.base,'-t','one',"CLAUDE_CONFIG_DIR='/cland/auth/claude-code-work' claude auth login"],ssh,'synthetic-code\n');
 assert.equal((await child.join()).code,0,child.output());assert.ok(!child.output().includes('REAL-HARNESS-TRAP'));
});
test('one-shot command uses fake host HOME and stdin', { timeout: 15000 }, async t => {
  const f = await forwardingFixture(t);
  const p = f.launch([...f.base, '-t', 'one', 'printf "%s:" "$HOME"; cat'], ssh, 'payload');
  assert.equal((await p.join()).code, 0);
  assert.equal(p.output(), `${f.host.home}:payload`);
});

test('scp writes exact bytes inside host home and refuses escape', { timeout: 15000 }, async t => {
  const f = await forwardingFixture(t);
  const bytes = Buffer.from([0, 255, 10, 13]);
  const source = join(f.root, 'source'); await writeFile(source, bytes);
  const scp = fileURLToPath(new URL('./fakes/fake-scp.ts', import.meta.url));
  const options = ['-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${f.host.knownHosts}`];
  const copied = f.launch([...options, source, 'one:~/copied'], scp);
  assert.equal((await copied.join()).code, 0);
  assert.deepEqual(await readFile(join(f.host.home, 'copied')), bytes);
  const escape = f.launch([...options, source, 'one:../../escape'], scp);
  assert.notEqual((await escape.join()).code, 0);
});

test('production binaries ignore either incomplete fake gate', async () => {
  const { sshBinaries } = await import('../src/host/ssh-binaries.ts');
  const override = { CLAND_SSH_BIN: '/fake/ssh', CLAND_SCP_BIN: '/fake/scp' };
  for (const gate of [{}, { CLAND_FAKE_HOSTS: 'one' }, { CLAND_FAKE_HOST_ROOT: '/fake' }, { CLAND_FAKE_HOSTS: '', CLAND_FAKE_HOST_ROOT: '/fake' }]) {
    assert.deepEqual(sshBinaries({ ...override, ...gate }), { ssh: 'ssh', scp: 'scp' });
  }
  assert.deepEqual(sshBinaries({ ...override, CLAND_FAKE_HOSTS: 'one', CLAND_FAKE_HOST_ROOT: '/fake' }), { ssh: '/fake/ssh', scp: '/fake/scp' });
});

import net from 'node:net';
import { writeFile, readFile, unlink, lstat } from 'node:fs/promises';
import { eventually } from './harness.ts';
import { createFakeHost } from './fakes/fake-host.ts';
import { ownProcess, ownDirectory, beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { realClock, type Clock, type ClockTimer } from '../src/hub/clock.ts';
import { FakeClock } from './fake-clock.ts';
type DeadlineClock = Pick<Clock, 'setTimeout' | 'clearTimeout'>;

async function bounded<T>(promise: Promise<T>, label: string, diagnostic: () => string, ms = 5000, clock: DeadlineClock = realClock): Promise<T> {
  let timer: ClockTimer | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = clock.setTimeout(() => reject(new Error(`${label} incomplete: ${diagnostic()}`)), ms); })]); }
  finally { clock.clearTimeout(timer); }
}

async function forwardingFixture(t: import('node:test').TestContext, setup?: (root:string)=>Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'fs-'));
  ownDirectory(t,root);
  const children: Array<{ stop: () => Promise<void> }> = [];
  const servers: net.Server[] = [];
  const sockets = new Set<net.Socket>();
  let drained=false;
  guardDirectoryRemoval(root,()=>{if(!drained)throw Error('fake SSH owners not drained; root retained');});
  beforeDirectories(t,async()=>{
    const errors:unknown[]=[];
    for(const child of children)try{await child.stop();}catch(error){errors.push(error);}
    const closes=[...sockets].map(socket=>new Promise<void>(resolve=>{socket.once('close',()=>resolve());socket.destroy();}));
    await Promise.all(closes);
    for(const server of servers)try{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}catch(error){errors.push(error);}
    drained=errors.length===0;
    if(errors.length)throw new AggregateError(errors,'fake SSH fixture cleanup incomplete');
  });
  await setup?.(root);
  const host = await createFakeHost(root, 'one');
  const bin=join(root,'bin');await mkdir(bin);
  await symlink(process.execPath,join(bin,'node'));
  for(const [name,path] of [['claude','claude-code/claude'],['codex','codex/codex'],['opencode','opencode/opencode']]) await writeFile(join(bin,name!),`#!/bin/sh\nexec '${fileURLToPath(new URL('./fakes/'+path,import.meta.url))}' "$@"\n`,{mode:0o700});
  const env = fixtureEnvironment(root, process.env, { PATH:bin+':/usr/bin:/bin', CLAND_FAKE_HOSTS: 'one,two', CLAND_FAKE_HOST_ROOT: root });
  const base = ['-a', '-x', '-F', '/dev/null', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${host.knownHosts}`, '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4'];
  const guard = join(root, 'unix-only.mjs');
  await writeFile(guard, `import net from 'node:net'; import {syncBuiltinESMExports} from 'node:module';
const connect = net.createConnection; net.createConnection = (...args) => { if (!args[0]?.path) throw new Error('TCP connect forbidden'); return connect(...args); };
const listen = net.Server.prototype.listen; net.Server.prototype.listen = function(...args) { if (typeof args[0] !== 'string') throw new Error('TCP listen forbidden'); return listen.apply(this,args); }; syncBuiltinESMExports();`);
  function launch(args: string[], binary = ssh, input = '', signal = t.signal, closeClock: DeadlineClock = realClock) {
    const child = spawn(process.execPath, ['--import', guard, binary, ...args], { env, cwd: root, detached: true });
    let output = '';
    const capture = (data: Buffer) => { output = (output + data.toString()).slice(-4096); };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    const nativeClose = new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
    const cleanup = ownProcess(undefined, child.pid);
    const diagnostic = () => `exit ${child.exitCode}; signal ${child.signalCode}; tail ${output}`;
    let stopping: Promise<void> | undefined;
    const stop = () => stopping ??= bounded((async () => { await cleanup(); await nativeClose; })(), 'child cleanup', diagnostic);
    children.push({ stop });
    const abort = () => { void stop().catch(() => { /* t.after joins this same cleanup and preserves root on failure. */ }); };
    signal.addEventListener('abort', abort, { once: true });
    void nativeClose.finally(() => signal.removeEventListener('abort', abort)).catch(() => {});
    if (signal.aborted) abort();
    child.stdin.end(input);
    // Capture close immediately; a long-lived master has no termination deadline yet.
    const join = () => bounded(nativeClose, 'child close', diagnostic, 5000, closeClock);
    return { child, join, stop, output: () => output };
  }
  async function command(args: string[]) { const p = launch(args); const receipt = await p.join(); return { ...receipt, output: p.output() }; }
  async function echo(path: string) {
    const server = net.createServer({ allowHalfOpen: true }, s => { sockets.add(s); s.once('close', () => sockets.delete(s)); s.pipe(s); }); servers.push(server);
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(path, resolve); });
  }
  async function exchange(path: string) {
    return new Promise<string>((resolve, reject) => {
      const s = net.createConnection({ path, allowHalfOpen: true }); sockets.add(s); s.once('close', () => sockets.delete(s));
      let bytes = ''; s.setTimeout(2000, () => s.destroy(new Error('relay timeout'))); s.once('error', reject);
      s.on('connect', () => s.end('relay bytes')); s.on('data', data => { bytes += data; }); s.on('end', () => { s.destroy(); resolve(bytes); });
    });
  }
  async function openStream(path: string) {
    const socket = net.createConnection({ path }); sockets.add(socket);
    const closed = new Promise<void>(resolve => socket.once('close', () => { sockets.delete(socket); resolve(); }));
    socket.setTimeout(3000, () => socket.destroy(new Error('active stream timeout')));
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject); socket.once('connect', () => socket.write('still live'));
      let received = '';
      socket.on('data', bytes => { received += bytes.toString(); if (received.length >= 'still live'.length) { assert.equal(received, 'still live'); resolve(); } });
    });
    return { socket, closed };
  }
  const control = join(root, 'ctl');
  const ready = async () => eventually('master control receipt after forwards persisted', async () => {
    const p = launch([...base, '-S', control, '-O', 'check', 'one']);
    const receipt = await p.join(); return receipt.code === 0 || undefined;
  });
  return { root, host, base, control, launch, command, echo, exchange, ready, openStream };
}

test('fake SSH setup rejection disposes its root before any bin or host setup',async t=>{
 let root='';
 await t.test('planted setup rejection',async child=>{
  await assert.rejects(forwardingFixture(child,async path=>{root=path;throw Error('planted setup rejection');}),/planted setup rejection/);
 });
 assert.ok(root);await assert.rejects(stat(root),{code:'ENOENT'});
});

test('master relays both Unix directions, dynamic forward/cancel, exit leaves stale control', { timeout: 15000 }, async t => {
  const f = await forwardingFixture(t);
  const target = join(f.root, 'echo'); await f.echo(target);
  const remoteTarget = join(f.host.run, 'agent'); await f.echo(remoteTarget);
  const local = join(f.root, 'local'); const reverse = join(f.host.run, 'hub');
  const master = f.launch([...f.base, '-o', 'ControlMaster=yes', '-S', f.control, '-N', '-L', `${local}:${remoteTarget}`, '-R', `${reverse}:${target}`, 'one']);
  await f.ready();
  assert.equal((await lstat(local)).mode & 0o777, 0o600);
  assert.equal(await f.exchange(local), 'relay bytes'); assert.equal(await f.exchange(reverse), 'relay bytes');
  const dynamic = join(f.root, 'dynamic');
  assert.equal((await f.command([...f.base, '-S', f.control, '-O', 'forward', '-L', `${dynamic}:${remoteTarget}`, 'one'])).code, 0);
  assert.equal(await f.exchange(dynamic), 'relay bytes');
  const held = await f.openStream(dynamic);
  assert.equal((await f.command([...f.base, '-S', f.control, '-O', 'cancel', '-L', `${dynamic}:${remoteTarget}`, 'one'])).code, 0);
  await held.closed;
  assert.equal(held.socket.destroyed, true);
  await assert.rejects(f.exchange(dynamic));
  assert.equal((await f.command([...f.base, '-S', f.control, '-O', 'exit', 'one'])).code, 0);
  assert.equal((await master.join()).code, 0);
  assert.ok(await lstat(f.control)); await assert.rejects(f.exchange(local)); await assert.rejects(f.exchange(reverse));
});

test('master SIGKILL closes forwards; gone refuses later connections', { timeout: 15000 }, async t => {
  const f = await forwardingFixture(t); const target = join(f.host.run, 'target'); await f.echo(target);
  const local = join(f.root, 'local');
  const master = f.launch([...f.base, '-S', f.control, '-N', '-L', `${local}:${target}`, 'one']); await f.ready();
  assert.equal((await lstat(local)).mode & 0o777, 0o600);
  assert.equal(await f.exchange(local), 'relay bytes');
  const cli = fileURLToPath(new URL('./fakes/fake-host.ts', import.meta.url));
  const held = await f.openStream(local);
  const kill = f.launch(['kill-master', 'one'], cli); assert.equal((await kill.join()).code, 0);
  assert.equal((await master.join()).signal, 'SIGKILL'); await held.closed; assert.equal(held.socket.destroyed, true); assert.ok(await lstat(f.control)); await assert.rejects(f.exchange(local));
  assert.equal((await f.launch(['gone', 'one'], cli).join()).code, 0);
  const result = await f.command([...f.base, 'one', 'true']); assert.notEqual(result.code, 0); assert.match(result.output, /unreachable/);
});

test('rejects missing/wrong pins, occupied forwards and TCP listen; loopback destination uses Unix map', { timeout: 15000 }, async t => {
  const f = await forwardingFixture(t);
  assert.notEqual((await f.command(['one', 'true'])).code, 0);
  const wrong = join(f.root, 'wrong'); await writeFile(wrong, 'one ssh-ed25519 wrong\n');
  assert.notEqual((await f.command(['-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${wrong}`, 'one', 'true'])).code, 0);
  const target = join(f.host.run, 'echo'); await f.echo(target);
  const occupied = join(f.root, 'occupied'); await f.echo(occupied);
  assert.notEqual((await f.command([...f.base, '-S', f.control, '-N', '-L', `${occupied}:${target}`, 'one'])).code, 0);
  for (const direction of ['-L', '-R']) {
    const result = await f.command([...f.base, '-S', f.control, '-N', direction, '8123:localhost:9000', 'one']);
    assert.notEqual(result.code, 0); assert.match(result.output, /TCP listen/);
  }
  await writeFile(join(f.host.directory, 'ports.json'), JSON.stringify({ '9000': target }));
  const local = join(f.root, 'local'); const master = f.launch([...f.base, '-S', f.control, '-N', '-L', `${local}:localhost:9000`, 'one']); await f.ready();
  assert.equal((await lstat(local)).mode & 0o777, 0o600);
  assert.equal(await f.exchange(local), 'relay bytes');
  assert.equal((await f.command([...f.base, '-S', f.control, '-O', 'exit', 'one'])).code, 0); await master.join();
});

test('kill-master refuses copied and stale ownership; failed bind preserves live receipt', { timeout: 20000 }, async t => {
  const f = await forwardingFixture(t);
  const two = await createFakeHost(f.root, 'two');
  const baseTwo = f.base.map(value => value === `UserKnownHostsFile=${f.host.knownHosts}` ? `UserKnownHostsFile=${two.knownHosts}` : value);
  const controlTwo = join(f.root, 'ctl-two');
  const a = f.launch([...f.base, '-S', f.control, '-N', 'one']); await f.ready();
  const b = f.launch([...baseTwo, '-S', controlTwo, '-N', 'two']);
  await eventually('second live master', async () => (await f.command([...baseTwo, '-S', controlTwo, '-O', 'check', 'two'])).code === 0 || undefined);
  const record = join(f.host.directory, 'master-control');
  const original = await readFile(record, 'utf8');
  const cli = fileURLToPath(new URL('./fakes/fake-host.ts', import.meta.url));
  await writeFile(record, await readFile(join(two.directory, 'master-control'), 'utf8'));
  assert.notEqual((await f.launch(['kill-master', 'one'], cli).join()).code, 0);
  assert.equal((await f.command([...baseTwo, '-S', controlTwo, '-O', 'check', 'two'])).code, 0);
  await writeFile(record, original);
  assert.notEqual((await f.command([...f.base, '-S', f.control, '-N', 'one'])).code, 0);
  assert.equal(await readFile(record, 'utf8'), original);
  assert.equal((await f.command([...f.base, '-S', f.control, '-O', 'exit', 'one'])).code, 0); await a.join();
  await unlink(f.control);
  const replacement = f.launch([...f.base, '-S', f.control, '-N', 'one']); await f.ready();
  const fresh = await readFile(record, 'utf8');
  await writeFile(record, original);
  assert.notEqual((await f.launch(['kill-master', 'one'], cli).join()).code, 0);
  assert.equal((await f.command([...f.base, '-S', f.control, '-O', 'check', 'one'])).code, 0);
  await writeFile(record, fresh);
  assert.equal((await f.launch(['kill-master', 'one'], cli).join()).code, 0);
  assert.equal((await replacement.join()).signal, 'SIGKILL');
  assert.equal((await f.command([...baseTwo, '-S', controlTwo, '-O', 'check', 'two'])).code, 0);
  assert.equal((await f.command([...baseTwo, '-S', controlTwo, '-O', 'exit', 'two'])).code, 0); await b.join();
});


test('held one-shot cancellation joins its writer before fixture removal', { timeout: 15000 }, async t => {
  const f = await forwardingFixture(t);
  const script = join(f.root, 'held.cjs');
  const receipt = join(f.host.home, 'writer-ready');
  await writeFile(script, `const fs = require('node:fs'); fs.writeFileSync('writer-ready', String(process.pid)); setInterval(() => fs.appendFileSync('writes', 'x'), 10);`);
  const controller = new AbortController();
  const held = f.launch([...f.base, 'one', `node '${script}'`], ssh, '', controller.signal);
  const writer = await eventually('writer durable setup receipt', async () => readFile(receipt, 'utf8').catch(() => undefined));
  assert.ok(Number(writer) > 0);
  controller.abort();
  await held.stop();
  const closed = await held.join();
  assert.ok(closed.signal || closed.code !== 0);
  assert.throws(() => process.kill(Number(writer), 0), (error: NodeJS.ErrnoException) => error.code === 'ESRCH');
});

test('master remains usable beyond the former launch close deadline', { timeout: 15000 }, async t => {
  const f = await forwardingFixture(t);
  // Inject only deadline scheduling: subprocess clocks and all native I/O remain real.
  const clock = new FakeClock(Date.now());
  const master = f.launch([...f.base, '-S', f.control, '-N', 'one'], ssh, '', t.signal, clock);
  await f.ready();
  await clock.advance(5500);
  assert.equal((await f.command([...f.base, '-S', f.control, '-O', 'check', 'one'])).code, 0);
  // Positive timer control: an explicitly requested join does expire while the
  // master is still live; observe that rejection, then retain the native close check.
  const expired = assert.rejects(master.join(), /child close incomplete: exit null; signal null/);
  await clock.advance(5000);
  await expired;
  assert.equal((await f.command([...f.base, '-S', f.control, '-O', 'check', 'one'])).code, 0);
  assert.equal((await f.command([...f.base, '-S', f.control, '-O', 'exit', 'one'])).code, 0);
  assert.equal((await master.join()).code, 0);
});
