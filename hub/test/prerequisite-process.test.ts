// T3: native smoke setup cancellation, TERM resistance and pipe-close/root ordering.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureProcess } from './process-cleanup.ts';
import { cliSmokeOwner } from './prerequisite-process.ts';

test('omitted smoke readiness stops the native writer before removing its root', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-smoke-omitted-'));
  const owner = cliSmokeOwner(root, { t, setupMs: 500 });
  const result = await owner.run(['-e', 'setInterval(()=>{},1000)']);
  t.diagnostic(JSON.stringify(result));
  assert.match(result.incomplete ?? '', /setup/);
  assert.equal(result.closed, true);
  assert.equal(result.rootPresent, true);
  await owner.remove();
  await assert.rejects(stat(root), {code:'ENOENT'});
});

test('aborted smoke acquisition prevents a late spawn and drains its observer', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-smoke-aborted-'));
  const gate = Promise.withResolvers<void>();
  const abort = new AbortController();
  const owner = cliSmokeOwner(root, { t, signal: abort.signal, beforeSpawn: gate.promise });
  const work = owner.run(['-e', 'setInterval(()=>{},1000)']);
  abort.abort(new Error('intentional setup abort'));
  gate.resolve();
  const result = await work;
  t.diagnostic(JSON.stringify(result));
  assert.match(result.incomplete ?? '', /abort/);
  assert.equal(result.pid, undefined);
  assert.equal(result.started, false);
  await owner.remove();
  await assert.rejects(stat(root), {code:'ENOENT'});
});

test('TERM-resistant smoke escalates and joins native close before root removal', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-smoke-resistant-'));
  const owner = cliSmokeOwner(root, { t, runMs: 500, stopMs: 500 });
  const result = await owner.run(['-e', "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000); process.send({type:'smoke-ready'});"]);
  t.diagnostic(JSON.stringify(result));
  assert.match(result.incomplete ?? '', /run/);
  assert.equal(result.forced, true);
  assert.equal(result.signal, 'SIGKILL');
  assert.equal(result.closed, true);
  assert.equal(result.rootPresent, true);
  await owner.remove();
  await assert.rejects(stat(root), {code:'ENOENT'});
});

for (const failure of ['missing', 'throws'] as const) test(`smoke ${failure} ownership capture fences root release after native close`, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-smoke-capture-'));
  const owner = cliSmokeOwner(root, { t, capture: () => { if (failure === 'throws') throw new Error('planted native capture failure'); return null; } });
  const result = await owner.run(['-e', "process.send({type:'smoke-ready'});"]);
  t.diagnostic(JSON.stringify(result));
  assert.equal(result.ownership, 'missing');
  assert.equal(result.gateObserved, true);
  assert.equal(result.admitted, false);
  assert.equal(result.closed, true);
  assert.equal(result.rootPresent, true);
  assert.match(result.incomplete ?? '', /ownership/);
  await assert.rejects(owner.remove(), /ownership/);
  assert.ok((await stat(root)).isDirectory());
  await owner.reconcileUnstarted();
  await owner.remove();
  await assert.rejects(stat(root), { code: 'ENOENT' });
});

test('captured fast smoke parent settles its detached-stdio writer before root release', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-smoke-descendant-'));
  const owner = cliSmokeOwner(root, { t });
  const builder = new URL('./fixture-environment.ts', import.meta.url).pathname;
  const writer = "require('node:fs').writeFileSync('writer.json',JSON.stringify({pid:process.pid})); process.send('writer-ready'); setInterval(()=>{},1000);";
  const result = await owner.run(['-e', `
    const {spawn}=require('node:child_process');
    const {fixtureEnvironment}=require(${JSON.stringify(builder)});
    const writer=spawn(process.execPath,['-e',${JSON.stringify(writer)}],{cwd:${JSON.stringify(root)},env:fixtureEnvironment(${JSON.stringify(root)},process.env),stdio:['ignore','ignore','ignore','ipc']});
    writer.once('message',()=>{writer.disconnect();writer.unref();process.send({type:'smoke-ready'});process.disconnect();});
  `]);
  const receipt = JSON.parse(await readFile(join(root, 'writer.json'), 'utf8')) as {pid: number};
  t.diagnostic(JSON.stringify({ ...result, writerPid: receipt.pid }));
  assert.equal(result.code, 0);
  assert.equal(result.closed, true);
  assert.equal(result.rootPresent, true);
  assert.equal(result.ownership, 'settled');
  assert.equal(captureProcess(receipt.pid), null);
  await owner.remove();
  await assert.rejects(stat(root), { code: 'ENOENT' });
});
