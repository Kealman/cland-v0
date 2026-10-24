// T1: documentation links and legacy anchors, using repository files only.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { assertTestDocIndex } from './test-docs-index.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const guide = read('docs/agents/tests.md');
const folder = 'docs/agents/tests';
const slug = (heading: string) => heading.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /g, '-');
const anchors = (text: string) => new Set([...text.matchAll(/^#{1,6} (.+)$/gm)].map(match => slug(match[1]!)));

test('the per-test index links every document to its existing test file', () => {
  const index = read(`${folder}/index.md`);
  assert.match(guide, /\]\(tests\/index\.md\)/);
  const documents = readdirSync(resolve(root, folder)).filter(name => name !== 'index.md').sort();
  assertTestDocIndex(index, documents);
  for (const document of documents) {
    const content = read(`${folder}/${document}`);
    const path = /^# (.+\.test\.ts)$/m.exec(content)?.[1];
    assert.ok(path, `${document}: test file heading`);
    assert.equal(document, `${path.replaceAll('/', '-')}.md`);
    assert.ok(statSync(resolve(root, path)).isFile(), `${document}: existing test`);
    assert.ok(index.includes(`| [\`${path}\`](../../../${path}) | [Notes](${document}) |`));
    for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      const link = match[1]!;
      if (/^[a-z]+:|^\//i.test(link)) continue;
      const [target, anchor] = link.split('#');
      const destination = resolve(root, folder, target || document);
      assert.ok(statSync(destination).isFile(), `${document}: ${link}`);
      if (anchor) assert.ok(anchors(readFileSync(destination, 'utf8')).has(anchor), `${document}: ${link}`);
    }
  }
});

test('historical tests.md anchors and references from skills, briefs, READMEs and roles still resolve', () => {
  const historical = [
    'running-tests', 'this-repositorys-verification-commands', 'tiers-and-the-merge-queue',
    'project-commands', 'test-levels-d53', 'periodic-dev-t2t3-and-release-gate', 'nightly-soak',
    'test-placement-and-review', 'queued-merge-batches', 'named-t3-scenarios',
    'neovim-workbench-startup-budget-t-1010', 'test-lint-reports', 'neovim-recorded-frames',
    'runtime-tier-resource-report', 'in-process-harnesses', 'human-kinds-and-queued-withdrawal',
    'waiting-for-an-observable-condition', 'real-binary-adapter-contract-checklist', 'fixtures',
    'cover-quiet', 'droplet-storage-health-and-fixture-filesystem-t-755',
    'legacy-spend-retirement-fixtures', 'rendered-artifact-checks', 'browser-sign-in-fixtures',
    'readme-startup-and-reference-contracts', 'https-tunnel-guide-contract', 'thread-history-pages',
    'implementer-test-selection', 'web-phase', 'phone-notificationstestts', 'web-notificationstestts',
    'phone-composertestts', 'phone-sessionstestts', 'phone-disconnectedtestts', 'paused-page-clocks',
    'human-marks-fixtures', 'connection-snapshots', 'startup-reply-byte-budgets-t-1038',
  ];
  const available = anchors(guide);
  for (const anchor of historical) assert.ok(available.has(anchor), anchor);
  const files = (path: string): string[] => statSync(resolve(root, path)).isDirectory()
    ? readdirSync(resolve(root, path)).flatMap(name => files(`${path}/${name}`)) : [path];
  const consumers = ['.agents/skills', 'skills', 'qa/briefs', 'docs', 'hub/src/roles',
    '.cland/roles.toml', 'README.md', 'hub/README.md', 'web/README.md', 'nvim/README.md'].flatMap(files);
  for (const path of consumers.filter(path => /\.(md|ts|toml)$/.test(path))) {
    for (const match of read(path).matchAll(/tests\.md#([a-z0-9-]+)/g)) {
      assert.ok(available.has(match[1]!), `${path}: ${match[0]}`);
    }
  }
});

test('index membership rejects missing, duplicate and dangling entries but accepts either order', () => {
  const row = (name: string) => `[Notes](${name})`;
  const documents = ['first.md', 'second.md'];
  assert.doesNotThrow(() => assertTestDocIndex(documents.map(row).join('\n'), documents));
  assert.doesNotThrow(() => assertTestDocIndex([...documents].reverse().map(row).join('\n'), documents));
  assert.throws(() => assertTestDocIndex(row('first.md'), documents));
  assert.throws(() => assertTestDocIndex(['first.md', 'second.md', 'first.md'].map(row).join('\n'), documents));
  assert.throws(() => assertTestDocIndex(['first.md', 'absent.md'].map(row).join('\n'), documents));
});
