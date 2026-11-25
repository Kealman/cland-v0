import test from 'node:test';
import assert from 'node:assert/strict';
import { graphImports } from '../src/suite-import-parser.ts';

test('repeated and concurrent admission scans share source analysis without sharing mutable results', async () => {
  let loads = 0;
  const load = async () => { loads++; return import('typescript'); };
  const source = "import './admission-cache-fixture.ts';";
  const [first, second] = await Promise.all([graphImports(source, 'cache-control.ts', load), graphImports(source, 'cache-control.ts', load)]);
  assert.equal(loads, 1, 'unchanged sources must be parsed once across concurrent admission scans');
  first[0]!.specifier = 'mutated';
  assert.equal(second[0]!.specifier, './admission-cache-fixture.ts');
  assert.deepEqual(await graphImports(source, 'cache-control.ts', load), second);
  assert.equal(loads, 1);
  assert.deepEqual(await graphImports("import './changed.ts';", 'cache-control.ts', load), [{specifier:'./changed.ts'}]);
  assert.equal(loads, 2, 'dirty source changes must be analyzed');
});

test('failed parser acquisition remains retryable and cannot reuse another parser backend', async () => {
  const source = "import './retry-control.ts';";
  let attempts = 0;
  const load = async () => { if (++attempts === 1) throw new Error('unavailable'); return import('typescript'); };
  await assert.rejects(graphImports(source, 'retry-control.ts', load), /parser unavailable/);
  assert.deepEqual(await graphImports(source, 'retry-control.ts', load), [{specifier:'./retry-control.ts'}]);
  await assert.rejects(graphImports(source, 'retry-control.ts', async () => { throw new Error('other backend'); }), /parser unavailable/);
});
