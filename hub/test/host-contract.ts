// Reusable Host process contract; native cases are registered by the T3 wrapper.
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, realpath, mkdir, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ownProcess } from './process-cleanup.ts';
import { eventually } from './harness.ts';
import type { Host } from '../src/host/host.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

export function hostContract(factory: (env: NodeJS.ProcessEnv) => Host, register: (name: string, run: () => Promise<void>) => unknown, expected?: { name: string; limitPolls: boolean }): void {
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
      owned = null;
    } finally {
      if (owned) assert.equal(await host.stop(owned), true, 'fixture writers stopped before removal');
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
