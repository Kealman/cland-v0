import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceAnalysisCache } from '../src/source-analysis-cache.ts';

test('analysis cache bounds retained keys and evicts least recently used facts', async () => {
  const cache = new SourceAnalysisCache<number>(2, 4);
  let computations = 0;
  const read = (key: string) => cache.read(key, async () => ++computations);
  assert.equal(await read('aa'), 1);
  assert.equal(await read('b'), 2);
  assert.equal(await read('aa'), 1);
  assert.equal(await read('c'), 3);
  assert.equal(await read('b'), 4);
  assert.equal(await read('oversized'), 5);
  assert.equal(await read('oversized'), 6);
  assert.equal(await read('b'), 4, 'oversized inputs do not displace bounded entries');
});

test('analysis cache retries rejected work and returns independent facts', async () => {
  const cache = new SourceAnalysisCache<{ files: string[] }>();
  await assert.rejects(cache.read('failure', async () => { throw new Error('analysis failed'); }), /analysis failed/);
  const value = await cache.read('failure', async () => ({files:['original']}));
  value.files.push('mutation');
  assert.deepEqual(await cache.read('failure', async () => { throw new Error('unexpected computation'); }), {files:['original']});
});

test('analysis cache character budget evicts even below its entry limit', async () => {
  const cache = new SourceAnalysisCache<number>(100, 4);
  let computations = 0;
  const read = (key: string) => cache.read(key, async () => ++computations);
  assert.equal(await read('aaa'), 1);
  assert.equal(await read('bb'), 2);
  assert.equal(await read('aaa'), 3);
});
