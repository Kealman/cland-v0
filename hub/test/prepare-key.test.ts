// T1: snapshot key compatibility and optional-part comparisons are pure rules.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { keyHash, sameKey, staleParts, type PrepareKey, type Snapshot } from '../src/executor/droplet/prepare.ts';

const full = { node: 'v24.13.0', nvim: { tag: 'v0.12.5', digest: 'bce0f56eda1f1b1db6eee8f4133d7a38813ea07933837dd1777411ca384c6875' }, lock: 'b'.repeat(64), base: 'c'.repeat(40) };

test('prepared Ubuntu images install the Headless Shell Linux libraries before runner setup', async () => {
  // T1: inspect the root cloud-init plan; never execute apt or a provider call.
  const provision = await readFile(new URL('../src/executor/droplet/provision.sh', import.meta.url), 'utf8');
  const rootPlan = provision.slice(0, provision.indexOf('useradd --create-home'));
  const packages = rootPlan.match(/retry "\$\{APT\[@\]\}" install --no-install-recommends ([^\n]+)/g)?.join(' ') ?? '';
  // Playwright's pinned Ubuntu 24.04 Chromium dependency list, including t64 names.
  for (const name of ['libasound2t64', 'libatk-bridge2.0-0t64', 'libatk1.0-0t64', 'libatspi2.0-0t64',
    'libcairo2', 'libcups2t64', 'libdbus-1-3', 'libdrm2', 'libgbm1', 'libglib2.0-0t64', 'libnspr4',
    'libnss3', 'libpango-1.0-0', 'libx11-6', 'libxcb1', 'libxcomposite1', 'libxdamage1', 'libxext6',
    'libxfixes3', 'libxkbcommon0', 'libxrandr2']) assert.ok(packages.split(/\s+/).includes(name), `root prepare installs ${name}`);
});

test('four-part prepare keys retain the existing snapshot hash', () => {
  // Recorded from the pre-T-669 implementation; existing snapshots must stay current.
  assert.equal(keyHash(full), '7599b8d463c5');
  assert.equal(sameKey(full, structuredClone(full)), true);
  assert.deepEqual(staleParts({ key: full } as Snapshot, structuredClone(full)), []);
});

test('a lock-only change invalidates the prepared browser snapshot', () => {
  const changed = { ...full, lock: 'd'.repeat(64) };
  assert.equal(sameKey(full, changed), false);
  assert.notEqual(keyHash(full), keyHash(changed));
  assert.deepEqual(staleParts({ key: full } as Snapshot, changed), ['lock']);
});

test('snapshot dependency installation includes the lockfile-pinned Headless Shell', async () => {
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.prepare, /\bnpm run test:web:install\b/);
  assert.equal(pkg.scripts['test:web:install'], 'node web/test/install-browser.ts');
  const install = await readFile(new URL('../../web/test/install-browser.ts', import.meta.url), 'utf8');
  assert.match(install, /node_modules\/playwright-core\/cli\.js/);
  assert.match(install, /'install', 'chromium', '--only-shell'/);
});

test('absent prepare parts compare as none and become stale only when added or removed', () => {
  const bare: PrepareKey = { node: full.node, base: full.base };
  assert.equal(sameKey(bare, { ...bare }), true);
  assert.deepEqual(staleParts({ key: bare } as Snapshot, { ...bare }), []);
  assert.equal(sameKey(bare, full), false);
  assert.equal(sameKey(full, bare), false);
  assert.deepEqual(staleParts({ key: bare } as Snapshot, full), ['lock', 'nvim']);
  assert.deepEqual(staleParts({ key: full } as Snapshot, bare), ['lock', 'nvim']);
});
