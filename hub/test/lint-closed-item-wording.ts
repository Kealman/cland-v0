// T0 static gate: fixture tracker and Markdown diagnostics, with no test worker.
import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, matchesGlob } from 'node:path';
import { findings, documentPatterns, type Document } from '../src/closed-item-wording.ts';

const tracker = [
  '---\nid: T-90001\nstate: closed\n---\n',
  '---\nid: T-90002\nstate: open\n---\n',
];
const documents = [{ path: 'README.md', text: [
  '# Fixture',
  'A stand-in remains (T-90001).',
  'Wait until T-90001 lands.',
  'T-90001 is pending.',
  'This is a later ticket: T-90001.',
  'Wait until T-90002 lands.',
  'Pending T-90003 is unknown.',
  'T-90001 already landed.',
].join('\n') }, { path: 'docs/nested/guide.md', text: 'Pending: T-90001, T-90001.\r\n' }];
assert.deepEqual(findings(documents, tracker), [
  'README.md:2: closed item T-90001 with stand-in wording',
  'README.md:3: closed item T-90001 with until wording',
  'README.md:4: closed item T-90001 with pending wording',
  'README.md:5: closed item T-90001 with later ticket wording',
  'docs/nested/guide.md:1: closed item T-90001 with pending wording',
]);

assert.deepEqual(findings([{ path: 'README.md', text: [
  '<!-- cland-allow-closed-wording: pending is runtime state -->',
  'T-90001 keeps a pending request.',
  'A stand-in human answers (T-90001). <!-- cland-allow-closed-wording: names a person -->',
].join('\n') }], tracker), []);
assert.equal(findings([{ path: 'README.md', text: 'Pending T-90001. <!-- cland-allow-closed-wording: -->' }], tracker).length, 1);
assert.deepEqual(findings([{ path: 'README.md', text: [
  'Pending T-90001. <!-- cland-allow-closed-wording: runtime request -->',
  'Pending T-90001.',
].join('\n') }], tracker), ['README.md:2: closed item T-90001 with pending wording']);

assert.deepEqual(findings([{ path: 'README.md', text: 'PENDING e-90004 and T-90004; A-90004 is an artifact.' }], [
  '---\nid: E-90004\nkind: epic\nstate: closed\n---\n',
]), [
  'README.md:1: closed item E-90004 with pending wording',
  'README.md:1: closed item T-90004 with pending wording',
]);
const mdxFixture = { path: 'site/src/content/docs/docs/fixture.mdx', text: 'Wait until T-90001 lands.' };
assert.deepEqual(findings([mdxFixture].filter(document => documentPatterns.some(pattern => matchesGlob(document.path, pattern))), tracker), [
  'site/src/content/docs/docs/fixture.mdx:1: closed item T-90001 with until wording',
]);
assert.deepEqual(findings([{ path: mdxFixture.path, text: [
  '---',
  'title: Pending T-90001',
  '---',
  'import Pending from "T-90001"; // Pending T-90001',
  'export const pending = "T-90001";',
  '```jsx',
  'Pending T-90001',
  '```',
  '<Screenshot title="Pending T-90001" />',
  '<Aside title="Pending T-90001">Wait until T-90001 lands.</Aside>',
  '<Screenshot',
  ' title="Pending T-90001"',
  '/> Pending T-90001.',
  'Pending `T-90001`.',
].join('\n') }], tracker), [
  `${mdxFixture.path}:10: closed item T-90001 with until wording`,
  `${mdxFixture.path}:13: closed item T-90001 with pending wording`,
  `${mdxFixture.path}:14: closed item T-90001 with pending wording`,
]);
assert.deepEqual(findings([{ path: mdxFixture.path, text: [
  'import {',
  '  pending as T90001, // Pending T-90001',
  '} from "./components";',
  'export const example = {',
  '  label: "Pending T-90001",',
  '};',
  'export const other = {',
  '  label: "Pending T-90001"',
  '}',
  'Wait until T-90001 lands.',
].join('\n') }], tracker), [`${mdxFixture.path}:10: closed item T-90001 with until wording`]);
console.log('closed-item wording lint: fixture diagnostics passed');

if (process.argv.includes('--help')) {
  console.log('Usage: node hub/test/lint-closed-item-wording.ts [--help | --self-test]\nScan README*.md throughout the repository, docs/**/*.md and site/src/content/docs/**/*.{md,mdx} against .cland/tasks. MDX ignores front matter, fenced code, complete import/export statements and JSX tags/attributes while retaining child prose and line numbers. Report same-line closed item references with until, stand-in, pending or later ticket wording (default tracker prefixes and T-n aliases). A same/previous-line <!-- cland-allow-closed-wording: reason --> exempts historical records or unrelated runtime wording. Unknown/open ids are ignored. In-memory fixture controls always run. --self-test skips repository reads.');
} else if (!process.argv.includes('--self-test')) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const paths = new Set<string>();
  for await (const path of glob(documentPatterns, {
    cwd: root, exclude: ['**/node_modules/**', '**/.git/**', '**/.cland/**'],
  })) paths.add(path);
  const documents: Document[] = [];
  for (const path of [...paths].sort()) documents.push({ path, text: await readFile(join(root, path), 'utf8') });
  const tracker: string[] = [];
  for await (const path of glob('.cland/tasks/*.md', { cwd: root })) tracker.push(await readFile(join(root, path), 'utf8'));
  assert.ok(tracker.length > 0, 'closed-item wording lint: tracker must not be empty');
  assert.ok(documents.length > 0, 'closed-item wording lint: documents must not be empty');
  const failures = findings(documents, tracker);
  for (const failure of failures) console.error(failure);
  console.log(`closed-item wording lint: ${documents.length} documents, ${tracker.length} tracker items, ${failures.length} findings`);
  if (failures.length > 0) process.exitCode = 1;
}
