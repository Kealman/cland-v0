// T1: controlled filesystem checkpoints; no native processes, timers or transport.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkpoint, checkpointRecovery, type CheckpointIO } from '../src/host/agent/storage.ts';
import { testSetupWaitMs } from './until.ts';

test('overlapping checkpoints publish complete snapshots in rename completion order', {timeout:testSetupWaitMs()}, async () => {
  const files = new Map<string, string>();
  const firstSynced = Promise.withResolvers<void>(), releaseFirst = Promise.withResolvers<void>();
  let opens = 0;
  const io: CheckpointIO = {
    async open(path, flags, mode) {
      assert.equal(mode, 0o600);
      if (flags === 'wx' && files.has(path)) throw Object.assign(Error('exists'), {code:'EEXIST'});
      const first = opens++ === 0;
      files.set(path, '');
      return {
        async writeFile(value) { files.set(path, value); },
        async sync() { if (first) { firstSynced.resolve(); await releaseFirst.promise; } },
        async close() {},
      };
    },
    async rename(from, to) {
      if (!files.has(from)) throw Object.assign(Error('missing rename source'), {code:'ENOENT'});
      files.set(to, files.get(from)!); files.delete(from);
    },
    async unlink(path) { files.delete(path); },
  };
  const first = checkpoint('/run/processes.json', {generation:1}, io);
  try {
    await firstSynced.promise;
    await checkpoint('/run/processes.json', {generation:2}, io);
    assert.deepEqual(JSON.parse(files.get('/run/processes.json')!), {generation:2});
  } finally { releaseFirst.resolve(); }
  await first;
  assert.deepEqual(JSON.parse(files.get('/run/processes.json')!), {generation:1});
  assert.deepEqual([...files.keys()], ['/run/processes.json']);
});

test('checkpoint reports a released parent without recreating storage', async () => {
  const missing = Object.assign(Error('parent released'), {code:'ENOENT'});
  let opens = 0;
  await assert.rejects(checkpoint('/released/processes.json', [], {
    async open() { opens++; throw missing; },
    async rename() { assert.fail('no publication after failed open'); },
    async unlink() { assert.fail('no temp acquired'); },
  }), error => error === missing);
  assert.equal(opens, 1);
});

test('background recovery removes orphan temps and preserves active or unknown writers and committed data', async () => {
  const suffix = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const names = [`processes.json.new-123-${suffix}`, `launches/id/birth.json.new-124-${suffix}`, `ref-watches.json.new-125-${suffix}`, 'processes.json', 'processes.json.new'];
  const removed:string[] = [];
  const recovery = checkpointRecovery([{directory:'/run'}], async pids => {
    assert.deepEqual(pids, [123,124,125]);
    return new Set([123]); // 124 alive, 125 unknown; neither permits deletion.
  }, {async *entries() { for(const name of names)yield {name,directory:false}; }, async unlink(path) { removed.push(path); }, async pause() {}});
  recovery.start(); await recovery.finished(); await recovery.close();
  assert.deepEqual(removed, [`/run/processes.json.new-123-${suffix}`]);
});

test('recovery yields after bounded retained entries and close joins the suspended scan', {timeout:testSetupWaitMs()}, async () => {
  const scheduled=Promise.withResolvers<void>(), release=Promise.withResolvers<void>(), batch=Promise.withResolvers<void>();
  let reads=0,pauses=0,closed=false;
  const recovery=checkpointRecovery([{directory:'/run'}],async()=>{assert.fail('retained JSON requires no native observation');},{
    async *entries() { try { for(let i=0;i<10000;i++){reads++;yield {name:`result-${i}.json`,directory:false};} } finally { closed=true; } },
    async unlink() { assert.fail('retained data is untouched'); },
    async pause() { if(pauses++===0)await scheduled.promise;else {batch.resolve();await release.promise;} },
  });
  recovery.start();assert.equal(reads,0,'start does no history work before its scheduled continuation');
  scheduled.resolve();
  try { await batch.promise; assert.equal(reads,32,'one turn reads at most 32 retained entries'); }
  finally { const closing=recovery.close();assert.equal(closed,false,'close joins the outstanding scan');release.resolve();await closing; }
  assert.equal(closed,true);assert.equal(reads,32,'close admits no next history entry');
});

test('recovery cleans exact external checkpoint basenames without traversing code generations', async () => {
  const suffix='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const removed:string[]=[],visited:string[]=[];
  const recovery=checkpointRecovery([{directory:'/code',basenames:['applied.json','restart-result.json']}],async()=>new Set([123]),{
    async *entries(directory) { visited.push(directory);for(const name of ['applied.json','restart-result.json','other.json'])yield {name:`${name}.new-123-${suffix}`,directory:false};yield {name:'V1',directory:true}; },
    async unlink(path) { removed.push(path); },async pause() {},
  });
  recovery.start();await recovery.finished();await recovery.close();
  assert.deepEqual(visited,['/code']);
  assert.deepEqual(removed,[`/code/applied.json.new-123-${suffix}`,`/code/restart-result.json.new-123-${suffix}`]);
});

test('failed checkpoint closes and removes its own temporary without replacing the snapshot', async () => {
  const failure = Error('sync failed');
  let closed = false, temporary = '';
  const removed:string[] = [];
  await assert.rejects(checkpoint('/run/processes.json', [], {
    async open(path) { temporary = path; return {async writeFile() {}, async sync() { throw failure; }, async close() { closed = true; }}; },
    async rename() { assert.fail('failed sync cannot publish'); },
    async unlink(path) { assert.equal(closed, true); removed.push(path); },
  }), error => error === failure);
  assert.match(temporary, /processes\.json\.new-\d+-[a-f0-9-]{36}$/);
  assert.deepEqual(removed, [temporary]);
});
