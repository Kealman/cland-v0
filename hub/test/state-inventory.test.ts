// T2: embedded hub, scripted DigitalOcean transport and fake harness; no native children.
import test from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import nativeFs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve, relative, isAbsolute, dirname, basename } from 'node:path';
import { layout } from '../src/project.ts';
import { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';
import { projectHub, connectUi, tempProject } from './harness.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';
import { beforeDirectories } from './process-cleanup.ts';

const within = (root: string, path: string) => { const rel = relative(root, path); return rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel); };
for (const injectEscape of [false, true]) test(injectEscape
  ? 'inventory rejects a hub-owned outside-HOME write while ignoring a concurrent suite writer'
  : 'hub state writes stay in scratch HOME with a fake-provider lease and fake harness', { timeout: 30000 }, async t => {
  const sibling = await tempProject(t, 'inventory-sibling-');
  const f = await fixture(t, { machine: 'scripted' });
  await f.stop();
  const owner = new AsyncLocalStorage<boolean>();
  const unrelated = new Set<string>();
  const runtime = new Set<string>();
  const sockets = new Set([layout(f.root).socket, layout(f.root).spokeSocket]);
  let writes = new Set<string>();
  const databasePaths = new Set<string>();
  const streamPaths = new Set<string>();
  // Observe transient lock, migration and atomic-publication files as well as final files.
  const observe = (path: unknown) => {
    if (path instanceof URL) path = fileURLToPath(path);
    if (Buffer.isBuffer(path)) path = path.toString();
    if (typeof path === 'string' && path !== ':memory:') (owner.getStore() ? writes : unrelated).add(resolve(path));
  };
  const methods = ['writeFile', 'mkdir', 'rename', 'open', 'appendFile', 'link', 'symlink'] as const;
  for (const name of methods) {
    const original = fs[name];
    t.mock.method(fs, name, (...args: unknown[]) => {
      if (name !== 'open' || args[1] !== 'r') observe(args[0]);
      if (name === 'rename' || name === 'link' || name === 'symlink') observe(args[1]);
      return Reflect.apply(original, fs, args);
    });
  }
  for (const name of ['writeFileSync', 'mkdirSync', 'renameSync', 'openSync', 'appendFileSync', 'linkSync', 'symlinkSync'] as const) {
    const original = nativeFs[name];
    t.mock.method(nativeFs, name, (...args: unknown[]) => {
      if (name !== 'openSync' || args[1] !== 'r') observe(args[0]);
      if (name === 'renameSync' || name === 'linkSync' || name === 'symlinkSync') observe(args[1]);
      const result = Reflect.apply(original, nativeFs, args);
      // Only the observed publication to this hub's production-selected socket
      // authorizes its exact staging name and mkdir parent (not their children).
      if (owner.getStore() && name === 'renameSync' && typeof args[0] === 'string' && typeof args[1] === 'string'
        && sockets.has(resolve(args[1])) && dirname(resolve(args[0])) === dirname(resolve(args[1])) && /^\.h[a-f0-9]{6}$/.test(basename(args[0]))) {
        runtime.add(resolve(args[0])); runtime.add(resolve(args[1])); runtime.add(dirname(resolve(args[1])));
      }
      return result;
    });
  }
  const createWriteStream = nativeFs.createWriteStream;
  t.mock.method(nativeFs, 'createWriteStream', (...args: Parameters<typeof nativeFs.createWriteStream>) => {
    observe(args[0]);
    if (typeof args[0] === 'string') streamPaths.add(resolve(args[0]));
    return createWriteStream(...args);
  });
  const openDatabase = (path: string) => {
    observe(path);
    databasePaths.add(resolve(path));
    // SQLite owns these companion files; fence their destinations with the DB.
    observe(path + '-wal'); observe(path + '-shm'); observe(path + '-journal');
    return new DatabaseSync(path);
  };
  syncBuiltinESMExports();
  beforeDirectories(t, async () => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  // Positive controls live in another disposable allocation, outside both the
  // served project and HOME. Join both writers before switching the observer.
  await owner.run(true, async () => {
    const home = f.env.HOME!;
    const unexpected = (paths: Iterable<string>) => [...paths].filter(path => !within(f.root, path) && !within(home, path) && !runtime.has(path));
    const controlDb = join(f.territory, 'inventory-control.sqlite');
    const db = openDatabase(controlDb);
    try {
      db.exec("pragma journal_mode=WAL; create table control (value text); insert into control values ('positive');");
      assert.ok((await fs.stat(controlDb + '-wal')).isFile());
      assert.equal((db.prepare('select value from control').get() as { value: string }).value, 'positive');
    }
    finally { db.close(); }
    const controlStream = join(f.territory, 'inventory-control.log');
    const stream = nativeFs.createWriteStream(controlStream);
    const closed = finished(stream);
    stream.end('positive stream control');
    await closed;
    assert.ok(databasePaths.has(controlDb));
    assert.ok(streamPaths.has(controlStream));
    assert.ok((await fs.stat(controlDb)).isFile());
    assert.ok(unexpected(writes).includes(controlDb), 'SQLite escape control');
    assert.ok(unexpected(writes).includes(controlStream), 'stream escape control');
    assert.equal(await fs.readFile(controlStream, 'utf8'), 'positive stream control');
    writes = new Set(); databasePaths.clear(); streamPaths.clear();
    const siblingWrite = owner.exit(() => fs.writeFile(join(sibling, 'concurrent.txt'), 'unrelated suite writer'));
    beforeDirectories(t, () => siblingWrite);
    const stray = join(sibling, 'hub-stray.txt');
    const hubDatabase = (path: string) => {
      if (injectEscape && path === join(f.root, '.cland/hub.db')) nativeFs.writeFileSync(stray, 'hub-owned escape');
      return openDatabase(path);
    };
    const hub = await projectHub(t, f.root, f.env, { userState: true, clock: f.clock, droplet: f.dependencies, openDatabase: hubDatabase,
      syntheticProvider: { token: f.syntheticProvider.token, api: f.api.provider }, harnesses: 'fake', probes: 'fake' });
    await siblingWrite;
    assert.equal(await fs.readFile(join(sibling, 'concurrent.txt'), 'utf8'), 'unrelated suite writer');
    const ui = await connectUi(t, hub.discovery);
    const status = await ui.request({ type: 'executor.status' });
    assert.equal(status.ok, true, status.error);
    const spend = (status.value as { spend: { path: string } }).spend.path;
    assert.equal(spend, join(home, 'cland/spend.json'));
    const launched = await ui.request({ type: 'session.launch', name: 'inventory-session', harness: 'codex' });
    assert.equal(launched.ok, true, launched.error);
    const listed = await ui.request({ type: 'session.list' });
    assert.equal(listed.ok, true, listed.error);
    assert.ok((listed.value as { processes: Array<{ name: string; harnessId: string }> }).processes.some(row => row.name === 'inventory-session' && row.harnessId.startsWith('fake:')));
    // The same production lease implementation and injected provider used by the hub.
    const env = { ...f.env, HOME: home, XDG_STATE_HOME: home };
    delete (env as NodeJS.ProcessEnv).CLAND_EXECUTOR_STATE;
    const executor = new DropletExecutor(f.root, undefined, () => {}, env, undefined, f.dependencies);
    beforeDirectories(t, () => executor.close());
    const lease = await drive(f, executor.acquire({ id: 'inventory' }, new Date(f.clock.now().getTime() + 600000).toISOString()));
    assert.ok((await readLeases(f.root)).some(row => row.lease === lease.lease && row.state === 'active'));
    await drive(f, executor.release(lease));
    await executor.close();
    await hub.stop();
    assert.ok([...databasePaths].some(path => path === join(f.root, '.cland/hub.db')), 'positive hub SQLite open');
    const outside = [...writes].filter(path => !within(f.root, path));
    assert.ok(outside.includes(spend), 'positive ledger write control');
    assert.ok(outside.includes(spend + '.lock'), 'positive transient lock control');
    assert.ok(unrelated.has(join(sibling, 'concurrent.txt')), 'concurrent writer passed through the installed observer');
    assert.ok(!writes.has(join(sibling, 'concurrent.txt')), 'concurrent suite writer is not hub-owned');
    if (injectEscape) {
      assert.equal(await fs.readFile(stray, 'utf8'), 'hub-owned escape');
      assert.deepEqual(unexpected(writes), [stray]);
      assert.throws(() => assert.deepEqual(unexpected(writes), []), { code: 'ERR_ASSERTION' }, 'hub-owned escape fails the inventory assertion');
    } else assert.deepEqual(unexpected(writes), []);
  });
});
