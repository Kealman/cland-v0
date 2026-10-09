// The shared territory-operation seam: synchronous and overlapping async callers against the real lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withTerritoryLock, withTerritoryLockAsync } from '../src/territory.ts';
import { tempProject } from './harness.ts';

test('an async territory operation keeps overlapping callers out until its promise settles', async (t) => {
  const root = await tempProject(t);
  const pending = Promise.withResolvers<string>();
  const first = withTerritoryLock(root, async () => pending.promise);
  let secondEntered = false;
  try {
    await assert.rejects(async () => withTerritoryLock(root, async () => {
      secondEntered = true;
    }), /another territory operation holds the lock/);
    assert.equal(secondEntered, false);
  } finally {
    pending.resolve('finished');
    await first;
  }
  assert.equal(await first, 'finished');
  assert.equal(await withTerritoryLock(root, async () => 'next'), 'next');
  assert.equal(withTerritoryLock(root, () => 'synchronous'), 'synchronous');
});

test('a rejected async operation releases the territory lock and preserves its rejection', async (t) => {
  const root = await tempProject(t);
  const failure = new Error('operation failed');
  await assert.rejects(withTerritoryLock(root, async () => { throw failure; }), (err) => err === failure);
  assert.equal(withTerritoryLock(root, () => 42), 42);
});

test('the hub\'s non-blocking territory lock excludes the synchronous one both ways, breaks a stale lock and releases on rejection', async (t) => {
  const root = await tempProject(t);
  const pending = Promise.withResolvers<string>();
  const first = withTerritoryLockAsync(root, async () => pending.promise);
  // while the hub holds it (once its own start time is probed), init's synchronous lock and a second hub operation are refused
  await new Promise((r) => setTimeout(r, 100));
  assert.throws(() => withTerritoryLock(root, () => 'init'), /another territory operation holds the lock/);
  await assert.rejects(withTerritoryLockAsync(root, async () => 'second'), /another territory operation holds the lock/);
  pending.resolve('finished');
  assert.equal(await first, 'finished');
  // and the hub's is refused while the synchronous one is held
  const held = withTerritoryLock(root, async () => {
    await assert.rejects(withTerritoryLockAsync(root, async () => 'inside'), /another territory operation holds the lock/);
    return 'held';
  });
  assert.equal(await held, 'held');
  // a lock left by a process that is gone is broken
  await writeFile(join(root, '.cland', 'territory.lock'), `${JSON.stringify({ pid: 999_999, started: 'Thu Jan  1 00:00:00 1970' })}\n`);
  assert.equal(await withTerritoryLockAsync(root, async () => 'after stale'), 'after stale');
  const failure = new Error('operation failed');
  await assert.rejects(withTerritoryLockAsync(root, async () => { throw failure; }), (err) => err === failure);
  assert.equal(withTerritoryLock(root, () => 42), 42);
});

test('the guard keeps a second acquirer out while exclusive creation is deferred', async (t) => {
  const fs = (await import('node:fs/promises')).default;
  const root = await tempProject(t);
  const path = join(root, '.cland', 'territory.lock');
  const ready = Promise.withResolvers<void>();
  const proceed = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const link = fs.link;
  let creations = 0;
  t.mock.method(fs, 'link', async (source: string, destination: string) => {
    if (destination === path && ++creations === 1) { ready.resolve(); await proceed.promise; }
    return link(source, destination);
  });
  const first = withTerritoryLockAsync(root, async () => { entered.resolve(); await finish.promise; });
  await ready.promise;
  const second = withTerritoryLockAsync(root, async () => { assert.fail('second holder entered'); });
  const refused = assert.rejects(second, /another territory operation holds the lock/);
  proceed.resolve();
  await entered.promise;
  await refused;
  finish.resolve();
  await first;
  assert.equal(await withTerritoryLockAsync(root, async () => 'retry'), 'retry');
});

test('the async territory lock refuses symlinks and concurrent stale takeover admits one holder', async (t) => {
  const fs = (await import('node:fs/promises')).default;
  const root = await tempProject(t);
  const path = join(root, '.cland', 'territory.lock');
  const target = join(root, 'target');
  await fs.mkdir(join(root, '.cland'));
  await fs.writeFile(target, 'preserved');
  await fs.symlink(target, path);
  await assert.rejects(withTerritoryLockAsync(root, async () => 'bad'), /refusing symlink/);
  assert.equal(await fs.readFile(target, 'utf8'), 'preserved');
  await fs.rm(path);
  await fs.writeFile(path, JSON.stringify({ pid: 999_999, started: null }));
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const acquire = () => withTerritoryLockAsync(root, async () => { entered.resolve(); await finish.promise; });
  const first = acquire();
  const second = acquire();
  const outcomes = Promise.allSettled([first, second]);
  await entered.promise;
  assert.match(String(await Promise.race([first.catch(err => err), second.catch(err => err)])), /another territory operation holds the lock/);
  finish.resolve();
  assert.equal((await outcomes).filter(r => r.status === 'fulfilled').length, 1);
});

test('a holder exiting after EEXIST cannot let an absent snapshot unlink a fresh acquisition', async t => {
  const fs = (await import('node:fs/promises')).default;
  const { acquireLockAsync } = await import('../src/hub/lock.ts');
  const root = await tempProject(t);
  await fs.mkdir(join(root, '.cland'));
  const path = join(root, '.cland', 'territory.lock');
  await fs.writeFile(path, JSON.stringify({ pid: process.pid, started: null }));
  const link = fs.link, read = fs.readFile;
  let conflict = true, absentRead = true;
  const ready = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
  t.mock.method(fs, 'link', async (source: string, destination: string) => {
    try { return await link(source, destination); }
    catch (err) { if (destination === path && conflict) { conflict = false; await fs.rm(path); } throw err; }
  });
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    try { return await read(...args); }
    catch (err) { if (args[0] === path && absentRead) { absentRead = false; ready.resolve(); await proceed.promise; } throw err; }
  });
  const first = acquireLockAsync(path);
  await ready.promise;
  const second = acquireLockAsync(path);
  const outcomes = Promise.allSettled([first, second]);
  proceed.resolve();
  const winner = await Promise.any([first, second]);
  const loser = await Promise.race([first.catch(err => err), second.catch(err => err)].map(p => p.then(value => value instanceof Error ? value : new Promise<never>(() => {}))));
  assert.match(String(loser), /another hub holds/);
  assert.equal((await outcomes).filter(r => r.status === 'fulfilled').length, 1);
  await winner.release();
});

test('stale main removal excludes a fresh acquirer and two simultaneous recoverers', async t => {
  const fs = (await import('node:fs/promises')).default;
  const { acquireLockAsync } = await import('../src/hub/lock.ts');
  const root = await tempProject(t);
  await fs.mkdir(join(root, '.cland'));
  const path = join(root, '.cland', 'territory.lock');
  await fs.writeFile(path, JSON.stringify({ pid: 999_999, started: 'old start', token: 'old' }));
  const rm = fs.rm;
  const ready = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
  let pause = true;
  t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    if (args[0] === path && pause) { pause = false; ready.resolve(); await proceed.promise; }
    return rm(...args);
  });
  const first = acquireLockAsync(path);
  await ready.promise;
  const second = acquireLockAsync(path), third = acquireLockAsync(path);
  const all = [first, second, third];
  const outcomes = Promise.allSettled(all);
  proceed.resolve();
  const winner = await Promise.any(all);
  const results = await outcomes;
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  for (const result of results) if (result.status === 'rejected') assert.match(String(result.reason), /another hub holds/);
  await winner.release();
});

test('a fresh nonempty guard installed in a dead-owner removal gap survives the recoverer’s rmdir', async t => {
  const fs = (await import('node:fs/promises')).default;
  const { acquireLockAsync } = await import('../src/hub/lock.ts');
  const root = await tempProject(t);
  await fs.mkdir(join(root, '.cland'));
  const path = join(root, '.cland', 'territory.lock'), guard = `${path}.break`;
  await fs.mkdir(guard);
  const owner = join(guard, 'dead.owner');
  await fs.writeFile(owner, JSON.stringify({ pid: 999_999, started: null }));
  const rm = fs.rm, link = fs.link, rmdir = fs.rmdir;
  const removed = Promise.withResolvers<void>(), resumeRemoval = Promise.withResolvers<void>();
  const installed = Promise.withResolvers<void>(), resumeCreation = Promise.withResolvers<void>();
  const preserved = Promise.withResolvers<void>();
  t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    const result = await rm(...args);
    if (args[0] === owner) { removed.resolve(); await resumeRemoval.promise; }
    return result;
  });
  t.mock.method(fs, 'link', async (source: string, destination: string) => {
    if (destination === path) { installed.resolve(); await resumeCreation.promise; }
    return link(source, destination);
  });
  t.mock.method(fs, 'rmdir', async (...args: Parameters<typeof fs.rmdir>) => {
    try { return await rmdir(...args); }
    catch (err) { if (args[0] === guard && (err as NodeJS.ErrnoException).code === 'ENOTEMPTY') preserved.resolve(); throw err; }
  });
  const first = acquireLockAsync(path);
  await removed.promise;
  const second = acquireLockAsync(path);
  const refusal = assert.rejects(first, /another hub holds/);
  await installed.promise;
  resumeRemoval.resolve();
  await preserved.promise;
  assert.equal((await fs.readdir(guard)).length, 1);
  resumeCreation.resolve();
  const winner = await second;
  await refusal;
  await winner.release();
});

test('guard crash recovery uses pid/start proof, preserves live legacy owners, and reads legacy/current main locks', async t => {
  const fs = (await import('node:fs/promises')).default;
  const { acquireLockAsync, acquireLock } = await import('../src/hub/lock.ts');
  const root = await tempProject(t);
  await fs.mkdir(join(root, '.cland'));
  const path = join(root, '.cland', 'territory.lock'), guard = `${path}.break`;
  for (const record of [{ pid: 999_999 }, { pid: 999_999, started: 'old', token: 'old' }]) {
    await fs.writeFile(path, JSON.stringify(record));
    await fs.mkdir(guard);
    await fs.writeFile(join(guard, 'dead.owner'), JSON.stringify({ pid: process.pid, started: 'different process start' }));
    const lock = await acquireLockAsync(path);
    await lock.release();
    await fs.writeFile(path, JSON.stringify(record));
    await fs.mkdir(guard);
    await fs.writeFile(join(guard, 'dead.owner'), JSON.stringify({ pid: 999_999 }));
    const sync = acquireLock(path);
    sync.release();
  }
  await fs.mkdir(guard);
  const owner = join(guard, 'cafe.owner');
  const bytes = JSON.stringify({ pid: process.pid }); // legacy unknown start means preserve a live pid
  await fs.writeFile(owner, bytes);
  const rename = fs.rename;
  const ready = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
  let calls = 0;
  t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    if (args[1] === guard && ++calls === 2) { ready.resolve(); await proceed.promise; }
    return rename(...args);
  });
  const waiting = acquireLockAsync(path);
  await ready.promise;
  assert.equal(await fs.readFile(owner, 'utf8'), bytes);
  await fs.rm(owner); await fs.rmdir(guard); // orderly live-owner release
  proceed.resolve();
  const lock = await waiting;
  await lock.release();
});

test('a failed main-lock read is preserved as failure, never absence or stale ownership', async t => {
  const fs = (await import('node:fs/promises')).default;
  const { acquireLockAsync } = await import('../src/hub/lock.ts');
  const root = await tempProject(t);
  await fs.mkdir(join(root, '.cland'));
  const path = join(root, '.cland', 'territory.lock');
  const bytes = JSON.stringify({ pid: 999_999, started: null });
  await fs.writeFile(path, bytes);
  const read = fs.readFile;
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    if (args[0] === path) throw Object.assign(new Error('main lock read unavailable'), { code: 'EACCES' });
    return read(...args);
  });
  await assert.rejects(acquireLockAsync(path), /main lock read unavailable/);
  assert.equal(await read(path, 'utf8'), bytes);
});

test('synchronous stale removal and an async acquirer in another process share the same guard', async t => {
  const fs = (await import('node:fs/promises')).default;
  const { spawn } = await import('node:child_process');
  const { acquireLockAsync } = await import('../src/hub/lock.ts');
  const root = await tempProject(t);
  await fs.mkdir(join(root, '.cland'));
  const path = join(root, '.cland', 'territory.lock'), proceed = join(root, 'proceed');
  await fs.writeFile(path, JSON.stringify({ pid: 999_999, started: null }));
  const script = `
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const path = ${JSON.stringify(path)}, proceed = ${JSON.stringify(proceed)};
    const remove = fs.rmSync;
    let deferred = true;
    fs.rmSync = (...args) => {
      if (args[0] === path && deferred) {
        deferred = false;
        process.stdout.write('ready\\n');
        while (!fs.existsSync(proceed)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      }
      return remove(...args);
    };
    syncBuiltinESMExports();
    const { acquireLock } = await import(${JSON.stringify(new URL('../src/hub/lock.ts', import.meta.url).href)});
    try {
      const lock = acquireLock(path);
      process.stdout.write('acquired\\n');
      process.stdin.once('data', () => { lock.release(); process.exit(0); });
    } catch (err) { process.stdout.write('refused:' + String(err) + '\\n'); process.exit(1); }
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const ready = Promise.withResolvers<void>(), childResult = Promise.withResolvers<string>();
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    output += chunk;
    if (output.includes('ready\n')) ready.resolve();
    if (output.includes('acquired\n')) childResult.resolve('acquired');
    if (output.includes('refused:')) childResult.resolve(output);
  });
  child.on('error', err => { ready.reject(err); childResult.reject(err); });
  await ready.promise;
  const other = acquireLockAsync(path).then(holder => ({ holder }), error => ({ error }));
  await fs.writeFile(proceed, 'continue');
  const first = await Promise.race([childResult.promise.then(child => ({ child })), other]);
  if ('child' in first && first.child === 'acquired') {
    const result = await other;
    assert.ok('error' in result);
    assert.match(String(result.error), /another hub holds/);
    child.stdin.write('release');
  } else {
    const result = await other;
    assert.ok('holder' in result);
    assert.match(await childResult.promise, /another hub holds/);
    await result.holder.release();
  }
});

test('both lock releases are no-ops for an absent file, deleted directory, and repeated obsolete release; no guard is created', async t => {
  const fs = (await import('node:fs/promises')).default;
  const syncFs = (await import('node:fs')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const { acquireLock, acquireLockAsync } = await import('../src/hub/lock.ts');
  const root = await tempProject(t);
  for (const asynchronous of [false, true]) for (const state of ['absent file', 'deleted directory', 'double release', 'successor']) {
    const dir = join(root, `${asynchronous}-${state}`), path = join(dir, 'lock');
    await fs.mkdir(dir);
    const lock = asynchronous ? await acquireLockAsync(path) : acquireLock(path);
    let successor: typeof lock | undefined;
    if (state === 'absent file') await fs.rm(path);
    if (state === 'deleted directory') await fs.rm(dir, { recursive: true });
    if (state === 'double release' || state === 'successor') await lock.release();
    if (state === 'successor') successor = asynchronous ? await acquireLockAsync(path) : acquireLock(path);
    let guards = 0;
    const mkdir = fs.mkdir, mkdirSync = syncFs.mkdirSync;
    const asyncMock = t.mock.method(fs, 'mkdir', (...args: Parameters<typeof fs.mkdir>) => { guards++; return mkdir(...args); });
    const syncMock = t.mock.method(syncFs, 'mkdirSync', (...args: Parameters<typeof syncFs.mkdirSync>) => { guards++; return mkdirSync(...args); });
    syncBuiltinESMExports();
    try {
      await lock.release();
      assert.equal(guards, 0, `${asynchronous ? 'async' : 'sync'}: ${state}`);
      if (successor) assert.equal(JSON.parse(await fs.readFile(path, 'utf8')).token, successor.holder.token);
      else await assert.rejects(fs.stat(path), { code: 'ENOENT' });
    } finally {
      asyncMock.mock.restore(); syncMock.mock.restore(); syncBuiltinESMExports();
    }
    await successor?.release();
  }
});

test('release handles a directory deleted between its ownership check and guard creation in both APIs', async t => {
  const fs = (await import('node:fs/promises')).default;
  const syncFs = (await import('node:fs')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const { acquireLock, acquireLockAsync } = await import('../src/hub/lock.ts');
  const root = await tempProject(t);
  for (const asynchronous of [false, true]) {
    const dir = join(root, String(asynchronous)), path = join(dir, 'lock');
    await fs.mkdir(dir);
    const lock = asynchronous ? await acquireLockAsync(path) : acquireLock(path);
    const mkdir = fs.mkdir, mkdirSync = syncFs.mkdirSync;
    const asyncMock = t.mock.method(fs, 'mkdir', async (...args: Parameters<typeof fs.mkdir>) => {
      await fs.rm(dir, { recursive: true }); return mkdir(...args);
    });
    const syncMock = t.mock.method(syncFs, 'mkdirSync', (...args: Parameters<typeof syncFs.mkdirSync>) => {
      syncFs.rmSync(dir, { recursive: true }); return mkdirSync(...args);
    });
    syncBuiltinESMExports();
    try { await lock.release(); await assert.rejects(fs.stat(dir), { code: 'ENOENT' }); }
    finally { asyncMock.mock.restore(); syncMock.mock.restore(); syncBuiltinESMExports(); }
  }
});

test('a hub stops successfully twice after its project directory is deleted', async t => {
  const fs = (await import('node:fs/promises')).default;
  const { serveProject } = await import('../src/hub/daemon.ts');
  const root = await tempProject(t);
  const daemon = await serveProject(root, { log: () => {} });
  t.after(() => daemon.stop());
  await fs.rm(root, { recursive: true });
  await daemon.stop();
  await daemon.stop();
  await daemon.stopped;
  await assert.rejects(fs.stat(root), { code: 'ENOENT' });
});

test('both territory wrappers preserve the primary typed failure when release fails too', async t => {
  const fs = (await import('node:fs/promises')).default;
  const syncFs = (await import('node:fs')).default;
  const { PushError } = await import('../src/territory-push.ts');
  const root = await tempProject(t);
  const path = join(root, '.cland', 'territory.lock');
  for (const mode of ['sync', 'sync promise', 'async']) {
    const primary = new PushError('push-outcome-unknown', 'verify territory dev and retry cland push');
    const operation = () => {
      // A directory at the lock path makes the cleanup ownership read fail with EISDIR.
      syncFs.rmSync(path); syncFs.mkdirSync(path);
      if (mode === 'sync promise') return Promise.reject(primary);
      throw primary;
    };
    const check = (err: unknown) => {
      assert.equal(err, primary);
      assert.equal(primary.code, 'push-outcome-unknown');
      assert.match(primary.message, /retry cland push; cleanup failed:.*EISDIR/);
      return true;
    };
    if (mode === 'sync') assert.throws(() => withTerritoryLock(root, operation), check);
    else await assert.rejects(mode === 'async' ? withTerritoryLockAsync(root, async () => operation()) : withTerritoryLock(root, operation), check);
    await fs.rm(path, { recursive: true });
  }
});

test('failed exclusive creation retains its original error if temporary-file cleanup and guard cleanup also fail', async t => {
  const fs = (await import('node:fs/promises')).default;
  const { acquireLockAsync } = await import('../src/hub/lock.ts');
  const root = await tempProject(t);
  const path = join(root, 'lock');
  const primary = Object.assign(new Error('exclusive create unavailable'), { code: 'EACCES' });
  const link = fs.link, rm = fs.rm;
  t.mock.method(fs, 'link', async (source: string, destination: string) => {
    if (destination === path) throw primary;
    return link(source, destination);
  });
  t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    const target = String(args[0]);
    if ((target.startsWith(`${path}.`) && !target.startsWith(`${path}.break`) && target.endsWith('.tmp')) || (target.startsWith(`${path}.break/`) && target.endsWith('.owner'))) throw new Error('cleanup unavailable');
    return rm(...args);
  });
  await assert.rejects(acquireLockAsync(path), err => {
    assert.equal(err, primary);
    assert.equal(primary.code, 'EACCES');
    assert.match(primary.message, /^exclusive create unavailable; cleanup failed: cleanup unavailable; cleanup failed: cleanup unavailable$/);
    return true;
  });
});
