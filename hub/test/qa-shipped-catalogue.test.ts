// T1: the shipped QA catalogue layout, using repository files only.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = readFileSync(resolve(root, 'nvim/test/qa-shipped.test.ts'), 'utf8');
// The one case per line list, read from the walk's own CATALOGUE source.
const listed = /const CATALOGUE = \[([\s\S]*?)\n\];/.exec(source)?.[1] ?? '';
const catalogue = [...listed.matchAll(/'([A-Z]+-\d+)'/g)].map((match) => match[1]!);

test('the shipped catalogue lists one case per line and every case file is there', () => {
  assert.ok(catalogue.length > 0, 'the walk keeps a CATALOGUE list');
  assert.equal(new Set(catalogue).size, catalogue.length, 'each case is listed once');
  for (const name of catalogue) {
    assert.ok(new RegExp(`^\\s*'${name}',[ \\t]*$`, 'm').test(source), `${name} is alone on its own catalogue line`);
    assert.ok(existsSync(resolve(root, 'qa/cases', `${name}.lua`)), `${name}.lua is a case file`);
  }
});

test('the walk registers every case through the catalogue loop', () => {
  assert.match(source, /for \(const name of CATALOGUE\) \{/, 'the walk loops over CATALOGUE');
  assert.doesNotMatch(source, /test\('[A-Z]+-\d+ passes through/, 'no case is registered beside the loop');
});
