import { LOCAL_MOD_DIR } from '../src/host/launch-layout.ts';
// Reusable Host process contract; native cases are registered by the T3 wrapper.
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, realpath, mkdir, symlink, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ownProcess } from './process-cleanup.ts';
import { eventually } from './harness.ts';
import type { Host } from '../src/host/host.ts';
import { existsSync } from 'node:fs';
import { fixtureEnvironment } from './fixture-environment.ts';

async function hostCompletion(child: Awaited<ReturnType<Host['spawn']>>) {
  let receipt: { code: number | null; signal: string | null } | undefined;
  void child.exited.then(value => { receipt = value; });
  return eventually('native Host completion receipt', () => receipt);
}

export function hostContract(factory: (env: NodeJS.ProcessEnv) => Host, register: (name: string, run: () => Promise<void>) => unknown, expected?: { name: string; limitPolls: boolean; endpoints?: Parameters<Host['forward']>[1][]; forward?: (endpoint: Awaited<ReturnType<Host['forward']>>) => void; layout?: ReturnType<Host['layout']> }, faults?: { failLogClose(path: string): () => Promise<void>; diagnostics: Record<string, unknown>[] }): void {
  register('Host login disks preserve optional absence and refuse invalid paths', async()=>{
    const root=await mkdtemp(join(tmpdir(),'host-login-contract-'));
    try {
      const host=factory(fixtureEnvironment(root,process.env));
      await optionalLoginDiskHostContract(host,host.loginDisk?{input:{op:'mount',volume:'volume',path:'/tmp/invalid-login'},code:host.name==='local'?'wrong-volume':'bad-argument'}:undefined);
    } finally {await rm(root,{recursive:true,force:true});}
  });
  register('Host optional branch flush preserves local absence and names unregistered worktrees', async () => {
    const root=await mkdtemp(join(tmpdir(),'host-flush-contract-'));
    try{
      const host=factory(fixtureEnvironment(root,process.env));
      await optionalFlushHostContract(host,host.name==='local'?undefined:{path:join(root,'absent'),branch:'t/contract',refusal:/watch .*push unconfirmed/});
    }finally{await rm(root,{recursive:true,force:true});}
  });

  register('Host writes exact bytes and mode, truncates, makes and removes only owned paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-writes-'));
    try {
      const host = factory(fixtureEnvironment(root, process.env));
      const dir = join(root, 'owned');
      await host.makeDirectory(dir, 0o700);
      assert.equal((await stat(dir)).mode & 0o777, 0o700);
      const path = join(dir, 'bytes');
      const bytes = Buffer.from([0, 255, 10, 13]);
      assert.equal(await host.publishFile(path, bytes, {mode: 0o640}), true);
      assert.equal(await host.publishFile(path, Buffer.from('ignored')), false);
      assert.deepEqual(await readFile(path), bytes);
      assert.equal(await host.publishFile(path, Buffer.from('replace'), {replace: true}), true);
      await host.appendFile(path, Buffer.from('tail'));
      assert.equal(await readFile(path, 'utf8'), 'replacetail');
      assert.equal((await host.stat(path)).size, 11);
      await host.writeFile(path, bytes, { mode: 0o600 });
      assert.deepEqual(await readFile(path), bytes);
      assert.equal((await stat(path)).mode & 0o777, 0o600);
      const { LaunchFiles } = await import('../src/adapters/launch-files.ts');
      const transaction = new LaunchFiles(undefined, host);
      await transaction.write(path, Buffer.from('overwritten'), 0o640);
      await transaction.rollback();
      assert.deepEqual(await host.readFile(path), bytes);
      assert.equal((await host.stat(path)).mode & 0o777, 0o600);
      await host.writeFile(path, new Uint8Array(), { truncate: 2 });
      assert.deepEqual(await readFile(path), bytes.subarray(0, 2));
      await assert.rejects(host.removePath(dir, { directory: true }));
      const link = join(root, 'link');
      await symlink(dir, link);
      await host.removePath(link);
      assert.deepEqual(await readFile(path), bytes.subarray(0, 2));
      await host.removePath(path);
      await host.removePath(dir, { directory: true });
      assert.equal(existsSync(dir), false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  register('Host freePort releases a bindable IPv4 loopback port', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-port-'));
    const server = createServer();
    try {
      const host = factory(fixtureEnvironment(root, process.env));
      const port = await host.freePort();
      assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
      });
      assert.equal((server.address() as import('node:net').AddressInfo).port, port);
    } finally {
      if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await rm(root, { recursive: true, force: true });
    }
  });

  register('Host local forwards preserve both endpoints and launch layout preserves current paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-layout-'));
    try {
      const host = factory(fixtureEnvironment(root, process.env));
      for (const endpoint of expected?.endpoints ?? [{ socket: join(root, 'session.sock') }, { port: 12345 }]) {
        const forwarded = await host.forward('session-id', endpoint);
        if (expected?.forward) expected.forward(forwarded);
        else assert.deepEqual(forwarded, endpoint);
        await host.unforward('session-id');
      }
      const input = { discoveryFile: join(root, '.cland', 'hub.json'), node: '/node', cli: '/cli', spoke: '/spoke' };
      const paths = host.layout(input);
      assert.deepEqual(paths, expected?.layout ?? { ...input, modDir: LOCAL_MOD_DIR, runDirectory: join(root, '.cland', 'run'), logDirectory: join(root, '.cland', 'log') });
      assert.ok(Object.isFrozen(paths));
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  register('Host file operations preserve cwd refusals, identity, paths, bytes and folder safety', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-files-'));
    try {
      const host = factory(fixtureEnvironment(root, process.env));
      const file = join(root, 'bytes');
      const missing = join(root, 'missing');
      const dir = join(root, 'folder');
      await mkdir(dir);
      await mkdir(join(dir, 'nested'));
      await writeFile(file, Buffer.from([0, 255, 13, 10]));
      await writeFile(join(dir, 'z'), 'z');
      await writeFile(join(dir, 'nested', 'a'), 'a');
      assert.deepEqual(await host.statDirectory(missing), { refusal: `session cwd ${missing} no longer exists`, identity: null });
      assert.deepEqual(await host.statDirectory(file), { refusal: `session cwd ${file} is not a directory`, identity: null });
      const info = await stat(dir);
      assert.deepEqual(await host.statDirectory(dir), { refusal: null, identity: { dev: info.dev, ino: info.ino } });
      await symlink(dir, join(root, 'alias'), 'dir');
      assert.equal(await host.realpath(join(root, 'alias')), await realpath(dir));
      assert.equal(await host.realpath(missing), missing);
      assert.deepEqual(Array.from(await host.readFile(file)), [0, 255, 13, 10]);
      await assert.rejects(() => host.readFile(dir));
      await assert.rejects(() => host.readFile(missing));
      assert.deepEqual(await host.listFolder(dir), ['nested/a', 'z']);
      await symlink(file, join(dir, 'link'));
      await assert.rejects(() => host.listFolder(dir), /symbolic links/);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  register('Host fileType does not follow symlinks and reports absent paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-types-'));
    try {
      const host = factory(fixtureEnvironment(root, process.env));
      await writeFile(join(root, 'file'), 'bytes');
      await symlink(join(root, 'file'), join(root, 'link'));
      assert.equal(await host.fileType(root), 'directory');
      assert.equal(await host.fileType(join(root, 'file')), 'file');
      assert.equal(await host.fileType(join(root, 'link')), 'symlink');
      assert.equal(await host.fileType(join(root, 'missing')), 'missing');
      assert.equal(await host.fileType(join(root, 'file', 'child')), 'missing');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  register('Host worktrees add the given branch, share installs, warn and refuse dirty removal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-worktree-'));
    const env = fixtureEnvironment(root, process.env);
    const host = factory(env);
    const path = join(root, 'checkout');
    const git = async (...args: string[]) => {
      const result = await host.run({ command: 'git', args: ['-c', 'gc.auto=0', ...args], cwd: root, env });
      assert.equal(result.code, 0, result.stderr);
      return result.stdout.trim();
    };
    try {
      await git('init');
      await writeFile(join(root, '.gitignore'), 'node_modules\ncheckout/\n');
      await writeFile(join(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/example': { version: '2' } } }));
      await git('add', '.');
      await git('commit', '-m', 'fixture');
      await git('branch', 'task');
      await mkdir(join(root, 'node_modules'));
      const added = await host.worktreeAdd({ root, path, branch: 'task' });
      assert.match(added.warning!, /stale worktree install/);
      assert.equal(await realpath(join(path, 'node_modules')), await realpath(join(root, 'node_modules')));
      assert.equal(await git('-C', path, 'branch', '--show-current'), 'task');
      await writeFile(join(path, 'dirty'), 'keep');
      await assert.rejects(() => host.worktreeRemove({ root, path }), /modified|untracked|changes/);
      assert.equal(await readFile(join(path, 'dirty'), 'utf8'), 'keep');
      await rm(join(path, 'dirty'));
      await host.worktreeRemove({ root, path });
      await assert.rejects(() => stat(path), { code: 'ENOENT' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  register('Host occupants resolve aliases and separate sibling prefixes and expose Host polling policy', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-occupants-'));
    try {
      const host = factory(fixtureEnvironment(root, process.env));
      const path = join(root, 'tree');
      await mkdir(join(path, 'nested'), { recursive: true });
      await mkdir(join(root, 'tree-other'));
      await symlink(path, join(root, 'alias'), 'dir');
      assert.deepEqual(await host.occupants(path, [
        { name: 'root', cwd: path }, { name: 'child', cwd: join(path, 'nested') },
        { name: 'alias', cwd: join(root, 'alias', 'nested') },
        { name: 'outside', cwd: join(root, 'tree-other') },
      ]), ['root', 'child', 'alias']);
      assert.equal(typeof host.limitPolls, 'boolean');
      assert.ok(host.name.length > 0);
      if (expected) {
        assert.equal(host.limitPolls, expected.limitPolls);
        assert.equal(host.name, expected.name);
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  register('Host spawn appends both output streams and publishes native exit and signal receipts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-output-'));
    const env = fixtureEnvironment(root, process.env);
    const host = factory(env);
    let pending: Awaited<ReturnType<Host['spawn']>> | undefined;
    try {
      const logFile = join(root, 'serve.log');
      await writeFile(logFile, 'before\n');
      pending = await host.spawn({ command: process.execPath, args: ['-e', "console.log('stdout'); console.error('stderr'); process.exitCode=7"], cwd: root, env, logFile });
      assert.ok(pending.exited, 'spawn carries a native completion receipt');
      assert.deepEqual(await hostCompletion(pending), { code: 7, signal: null });
      assert.equal(await readFile(logFile, 'utf8'), 'before\nstdout\nstderr\n');
      pending = await host.spawn({ command: process.execPath, args: ['-e', "process.kill(process.pid, 'SIGTERM')"], cwd: root, env });
      assert.deepEqual(await hostCompletion(pending), { code: null, signal: 'SIGTERM' });
      await assert.rejects(host.spawn({ command: join(root, 'missing-binary'), args: [], cwd: root, env, logFile }));
    } finally {
      if (pending) { await host.stop(await host.identity(pending.pid) ?? { pid: pending.pid }, { allowReused: true }); await hostCompletion(pending); }
      await rm(root, { recursive: true, force: true });
    }
  });
  register('Host spawn checks final authority after opening its log and refuses without launching', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-authority-'));
    const env = fixtureEnvironment(root, process.env);
    const host = factory(env);
    let accepted: Awaited<ReturnType<Host['spawn']>> | undefined;
    try {
      const logFile = join(root, 'serve.log');
      const marker = join(root, 'launches');
      const command = { command: process.execPath, args: ['-e', "require('fs').appendFileSync('launches','spawned\\n')"], cwd: root, env, logFile };
      let checked = false;
      await assert.rejects(async () => {
        accepted = await host.spawn(command, { authorize: () => { checked = true; assert.equal(existsSync(logFile), true); throw new Error('authority declined'); } });
      }, /authority declined/);
      assert.equal(checked, true);
      accepted = await host.spawn(command, { authorize: () => { assert.equal(existsSync(logFile), true); } });
      let receipt: unknown;
      void accepted.exited.then(value => { receipt = value; });
      await eventually('authorized child completion', () => receipt);
      assert.deepEqual(await hostCompletion(accepted), { code: 0, signal: null });
      assert.equal(await readFile(marker, 'utf8'), 'spawned\n');
    } finally {
      if (accepted) { await host.stop(await host.identity(accepted.pid) ?? { pid: accepted.pid }, { allowReused: true }); await hostCompletion(accepted); }
      await rm(root, { recursive: true, force: true });
    }
  });
  if (faults) register('Host spawn retains accepted PID and completion when log descriptor close fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-close-fault-'));
    const env = fixtureEnvironment(root, process.env);
    const host = factory(env);
    const logFile = join(root, 'serve.log');
    const restore = faults.failLogClose(logFile);
    let accepted: Awaited<ReturnType<Host['spawn']>> | undefined;
    let owned: Awaited<ReturnType<Host['identity']>>;
    try {
      accepted = await host.spawn({ command: process.execPath, args: ['-e', "require('fs').writeFileSync('ready','ready');setInterval(()=>{},1000)"], cwd: root, env, logFile });
      owned = await eventually('accepted fault child birth', async () => await host.identity(accepted!.pid) ?? undefined);
      await eventually('accepted fault child durable launch', async () => (await readFile(join(root, 'ready'), 'utf8').catch(() => '')) || undefined);
      assert.equal(await host.alive(owned), true);
      assert.ok(faults.diagnostics.some(entry => entry.event === 'host-spawn-log-close-failed' && entry.pid === accepted!.pid));
      assert.equal(await host.stop(owned), true);
      let receipt: unknown;
      void accepted.exited.then(value => { receipt = value; });
      await eventually('fault child completion', () => receipt);
      assert.deepEqual(await hostCompletion(accepted), { code: null, signal: 'SIGTERM' });
    } finally {
      await restore();
      if (accepted) { await host.stop(await host.identity(accepted.pid) ?? { pid: accepted.pid }, { allowReused: true }); await hostCompletion(accepted); }
      await rm(root, { recursive: true, force: true });
    }
  });
  register('Host run returns output and exit status with the supplied cwd and environment', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-contract-'));
    try {
      const env = fixtureEnvironment(root, process.env, { HOST_CONTRACT_VALUE: 'synthetic-value' });
      const host = factory(env);
      const result = await host.run({ command: process.execPath, args: ['-e', 'console.log(process.cwd()); console.error(process.env.HOST_CONTRACT_VALUE); process.exitCode = 7'], cwd: root, env });
      assert.equal(result.code, 7);
      assert.equal(result.stdout.trim(), await realpath(root));
      assert.equal(result.stderr.trim(), 'synthetic-value');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  register('Host spawn detaches its session and group, preserves env/cwd, identity fences liveness and stop', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-contract-'));
    const env = fixtureEnvironment(root, process.env, { HOST_CONTRACT_VALUE: 'synthetic-private-value' });
    const host = factory(env);
    let cleanup: (() => Promise<void>) | undefined;
    let owned: Awaited<ReturnType<Host['identity']>> = null;
    try {
      const script = join(root, 'child.cjs');
      await writeFile(script, `require('fs').writeFileSync('ready.json', JSON.stringify({pid:process.pid,cwd:process.cwd(),value:process.env.HOST_CONTRACT_VALUE,argv:process.argv})); setInterval(()=>{},1000);`);
      const { pid } = await host.spawn({ command: process.execPath, args: [script], cwd: root, env });
      cleanup = ownProcess(undefined, pid);
      owned = await eventually('native birth captured', async () => await host.identity(pid) ?? undefined);
      assert.equal(owned.pid, pid);
      assert.ok(owned.pidIdentity);
      const receipt = await eventually('spawn readiness file', async () => {
        try { return JSON.parse(await readFile(join(root, 'ready.json'), 'utf8')); } catch { return undefined; }
      });
      assert.equal(receipt.cwd, await realpath(root));
      assert.equal(receipt.value, env.HOST_CONTRACT_VALUE);
      assert.ok(!receipt.argv.join(' ').includes('synthetic-private-value'));
      const ps = await host.run({ command: 'ps', args: ['-p', `${pid},${process.pid}`, '-o', 'pid=,pgid=,sess=,command='], cwd: root, env });
      assert.equal(ps.code, 0, ps.stderr);
      const rows = ps.stdout.trim().split('\n').map(line => line.trim().split(/\s+/));
      const child = rows.find(row => Number(row[0]) === pid)!;
      const caller = rows.find(row => Number(row[0]) === process.pid)!;
      assert.equal(Number(child[1]), pid);
      if (process.platform === 'darwin') {
        // Darwin ps masks session pointers to zero. SYS_getsid=310 in sys/syscall.h.
        const session = await host.run({ command: '/usr/bin/perl', args: ['-e', 'print syscall(310, 0+$ARGV[0])', String(pid)], cwd: root, env });
        assert.equal(session.code, 0, session.stderr);
        assert.equal(Number(session.stdout), pid, 'child leads its native session');
      } else assert.notEqual(child[2], caller[2], 'separate native session');
      assert.ok(!ps.stdout.includes('synthetic-private-value'));
      assert.equal(await host.alive(owned), true, 'no child handle retained by caller');
      assert.equal(await host.alive({ pid }), true, 'bare PID observes existence only');
      const reused = { ...owned, pidIdentity: owned.pidIdentity + ':different-birth' };
      assert.equal(await host.alive(reused), false);
      assert.equal(await host.stop(reused), false);
      assert.equal(await host.alive(owned), true, 'mismatched birth never signalled');
      const legacy = { pid, pidStarted: owned.pidStarted ?? null };
      assert.equal(await host.alive(legacy), true);
      assert.equal(await host.alive({ pid, pidStarted: 'different-start' }), false);
      assert.equal(await host.stop(legacy), false, 'legacy timestamp grants no signal authority');
      assert.equal(await host.stop(owned), true);
      assert.equal(await host.alive(owned), false);
      assert.equal(await host.identity(pid), null);
      assert.equal(await host.alive({ pid }), false, 'reaped PID is absent even without recorded proof');
      assert.equal(await host.stop(owned), true, 'an absent process is already stopped');
      owned = null;
    } finally {
      if (owned) assert.equal(await host.stop(owned), true, 'fixture writers stopped before removal');
      await cleanup?.();
      await rm(root, { recursive: true, force: true });
    }
  });

  // T-1547: hub-side stop callbacks remain transport-neutral and preserve the owner logger.
  register('Host stop captures births before callbacks, refuses declined authority and retains the owner logger', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-stop-'));
    const env = fixtureEnvironment(root, process.env);
    const host = factory(env);
    let owned: Awaited<ReturnType<Host['identity']>> = null;
    let cleanup: (() => Promise<void>) | undefined;
    try {
      const script = join(root, 'child.cjs');
      await writeFile(script, `require('child_process').spawn(process.execPath, ['-e', "require('fs').writeFileSync('child-ready', String(process.pid)); setInterval(()=>{},1000)"], {stdio:'ignore'}); require('fs').writeFileSync('ready', 'ready'); setInterval(()=>{},1000);`);
      const { pid } = await host.spawn({ command: process.execPath, args: [script], cwd: root, env });
      cleanup = ownProcess(undefined, pid);
      owned = await eventually('stop callback native birth', async () => await host.identity(pid) ?? undefined);
      await eventually('stop callback readiness', async () => { try { return await readFile(join(root, 'ready'), 'utf8') === 'ready' ? true : undefined; } catch { return undefined; } });
      const childPid = await eventually('stop callback descendant readiness', async () => { try { return Number(await readFile(join(root, 'child-ready'), 'utf8')) || undefined; } catch { return undefined; } });
      const child = await host.identity(childPid);
      assert.ok(child?.pidIdentity);
      let attempted = false;
      await assert.rejects(host.stop(owned, {
        authorize: tree => { assert.deepEqual(tree.find(p => p.pid === pid), owned); throw new Error('declined authority'); },
        beforeSignal: async () => { attempted = true; },
      }), /declined authority/);
      assert.equal(attempted, false);
      assert.equal(await host.alive(owned), true, 'declined authority sends no signal');
      const events: string[] = [];
      assert.equal(await host.stop(owned, {
        graceMs: 50, allowReused: false,
        authorize: tree => { assert.ok(tree.some(p => p.pid === pid && p.pidIdentity === owned!.pidIdentity)); events.push('authorize'); },
        beforeSignal: async tree => { assert.deepEqual(tree.find(p => p.pid === pid), owned); assert.deepEqual(tree.find(p => p.pid === childPid), child); assert.equal(await host.alive(owned!), true); events.push('beforeSignal'); },
        log: entry => { if (entry.event === 'harness-ended') events.push('ended'); },
      }), true);
      assert.ok(events.indexOf('authorize') < events.indexOf('beforeSignal'));
      assert.equal(events.at(-1), 'ended');
      assert.equal(await host.alive(child!), false, 'captured descendant is also gone');
      assert.equal(await host.alive(owned), false);
      owned = null;
    } finally {
      if (owned) assert.equal(await host.stop(owned), true);
      await cleanup?.();
      await rm(root, { recursive: true, force: true });
    }
  });

  register('Host processes reports resident bytes and CPU percent for the whole parent-child tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'host-contract-'));
    const env = fixtureEnvironment(root, process.env);
    const host = factory(env);
    let cleanup: (() => Promise<void>) | undefined;
    let owned: Awaited<ReturnType<Host['identity']>> = null;
    try {
      const script = join(root, 'tree.cjs');
      await writeFile(script, `
        const fs = require('fs');
        if (process.argv[2] === 'child') {
          global.bytes = Buffer.alloc(16*1024*1024, 1);
          const start = process.hrtime.bigint();
          while (process.hrtime.bigint() - start < 40000000n) {}
          process.send({pid:process.pid,rss:process.memoryUsage().rss});
          setInterval(()=>{ const start=process.hrtime.bigint(); while(process.hrtime.bigint()-start<10000000n) {} },100);
        } else {
          const child = require('child_process').fork(__filename, ['child'], {stdio:['ignore','ignore','ignore','ipc']});
          child.once('message', data => fs.writeFileSync('tree.json', JSON.stringify({child:data,parentRss:process.memoryUsage().rss})));
          process.on('SIGTERM', () => { child.once('exit', () => process.exit(0)); child.kill(); });
          setInterval(()=>{},1000);
        }
      `);
      const { pid } = await host.spawn({ command: process.execPath, args: [script], cwd: root, env });
      cleanup = ownProcess(undefined, pid);
      owned = await eventually('tree native birth', async () => await host.identity(pid) ?? undefined);
      const receipt = await eventually('tree child readiness', async () => {
        try { return JSON.parse(await readFile(join(root, 'tree.json'), 'utf8')); } catch { return undefined; }
      });
      const rows = await eventually('native child CPU sample', async () => {
        const rows = await host.processes();
        return rows.find(row => row.pid === receipt.child.pid)?.cpuPercent ? rows : undefined;
      }, 5000);
      const parent = rows.find(row => row.pid === pid)!;
      const child = rows.find(row => row.pid === receipt.child.pid)!;
      assert.ok(parent && child);
      assert.equal(child.parent, pid);
      assert.ok(child.rssBytes >= 16*1024*1024, 'touched child allocation is resident');
      assert.ok(parent.rssBytes >= child.rssBytes + 8*1024*1024, 'parent includes its own resident memory too');
      assert.ok(parent.rssBytes >= receipt.parentRss + receipt.child.rss - 8*1024*1024, 'independent native memory receipts');
      assert.ok(child.cpuPercent > 0, 'bounded child work is visible');
      assert.ok(parent.cpuPercent >= child.cpuPercent, 'child CPU included in parent tree');
      assert.equal(await host.stop(owned), true);
      assert.equal(await host.alive({pid:receipt.child.pid}), false, 'stop drains descendants');
      owned = null;
    } finally {
      if (owned) assert.equal(await host.stop(owned), true);
      await cleanup?.();
      await rm(root, { recursive: true, force: true });
    }
  });

}

/** Optional native-launch seam inventory: local Hosts deliberately provide neither member. */
export async function optionalLoginDiskHostContract(host:Pick<Host,'loginDisk'>, expected?:{input:import('../src/host/host.ts').LoginDisk;code?:string}):Promise<void> {
  if(!expected){assert.equal(host.loginDisk,undefined);return;}
  assert.equal(typeof host.loginDisk,'function');
  if(expected.code)await assert.rejects(host.loginDisk!(expected.input),{code:expected.code});
  else await host.loginDisk!(expected.input);
}

export function optionalClaudeHostContract(host: Host): void {
  assert.equal(typeof host.launchClaude, 'undefined');
  assert.equal(typeof host.adopt, 'undefined');
}

/** A terminal printer is optional; an admitted one must render the requested session. */
export function optionalTerminalHostContract(host: Host, expected?: string): void {
  if (expected === undefined) assert.equal(host.terminalAttachCommand, undefined);
  else {
    assert.equal(typeof host.terminalAttachCommand, 'function');
    assert.equal(host.terminalAttachCommand?.('worker'), expected);
  }
}

/** Optional locally; an admitted remote operation must settle or provide its explicit refusal. */
export async function optionalFlushHostContract(host:Pick<Host,'flushBranch'>,expected?:{path:string;branch:string;refusal?:RegExp}):Promise<void>{
  if(!expected){assert.equal(host.flushBranch,undefined);return;}
  assert.equal(typeof host.flushBranch,'function');
  if(expected.refusal)await assert.rejects(host.flushBranch!(expected.path,expected.branch),expected.refusal);
  else await host.flushBranch!(expected.path,expected.branch);
}

/** Optional locally; reports reach a live subscriber and cease after unsubscribe. */
export async function optionalCapacityHostContract(host: Pick<Host, 'onCapacityChanged'>, source?: {
  publish: (availableBytes: number) => void | Promise<void>;
  observed: (condition: () => boolean, what: string) => void | Promise<void>;
}): Promise<void> {
  if (!source) { assert.equal(host.onCapacityChanged, undefined); return; }
  assert.equal(typeof host.onCapacityChanged, 'function');
  const first = 1_200_000_111, second = 1_200_000_222;
  const samples: number[] = [], later: number[] = [];
  const unsubscribe = host.onCapacityChanged!(bytes => samples.push(bytes));
  let active = true, unsubscribeLater: (() => void) | undefined;
  try {
    await source.publish(first);
    await source.observed(() => samples.includes(first), 'first capacity report');
    assert.ok(samples.includes(first), 'first capacity report preserves available bytes');
    unsubscribe(); active = false;
    const before = samples.length;
    // The second subscriber is a positive delivery receipt after the first unsubscribes.
    unsubscribeLater = host.onCapacityChanged!(bytes => later.push(bytes));
    await source.publish(second);
    await source.observed(() => later.includes(second), 'later capacity report');
    assert.ok(later.includes(second), 'later capacity report preserves available bytes');
    assert.equal(samples.length, before, 'unsubscribed capacity listener received a later report');
  } finally { try { if (active) unsubscribe(); } finally { unsubscribeLater?.(); } }
}

/** Optional synchronous transport observation, without mutating or waiting. */
export function optionalLoginDiskReachabilityContract(host:Pick<Host,'loginDiskReachable'>,expected?:boolean):void {
 if(expected===undefined)assert.equal(host.loginDiskReachable,undefined);
 else {assert.equal(typeof host.loginDiskReachable,'function');assert.equal(host.loginDiskReachable!(),expected);}
}
