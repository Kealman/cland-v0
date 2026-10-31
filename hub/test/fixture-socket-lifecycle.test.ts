// T3: killed native listeners and failed fixture drainage retain or remove private
// socket owners through native close receipts; all children and roots are disposable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname } from 'node:path';
import { lstat, stat, writeFile } from 'node:fs/promises';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { tempProject } from './harness.ts';
import { afterCleanup, beforeDirectories, captureProcess } from './process-cleanup.ts';

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
