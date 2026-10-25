// T1: install claims in the site, docs and READMEs; repository files only.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const BREW = 'brew install kealman/tap/cland';
const SCRIPT = 'curl -fsSL https://cland.app/install.sh | sh';
const SOURCE = ['git clone https://github.com/Kealman/cland-v0 cland', 'npm ci', 'npm link'];
const TAP = 'Kealman/homebrew-tap';

const installSurfaces = [
  'site/src/content/docs/docs/install.md',
  'site/src/content/docs/docs/quickstart.md',
  'site/src/pages/index.astro',
];

/** A tap described as unpublished is a stale install claim. Runtime "pending"
 * states and UI "tap" gestures stay legitimate, so the words must be near each
 * other on one line. */
export function staleTapClaims(text: string): string[] {
  const stale = /(?:\bHomebrew\b[^.\n]{0,60}\bpending\b|\bpending\b[^.\n]{0,60}\bHomebrew\b|\btap\b[^.\n]{0,40}\bpending\b|\bpending\b[^.\n]{0,40}\btap\b)/i;
  return text.split('\n').map(line => line.trim()).filter(line => stale.test(line));
}

/** A release named as the current or latest one is a pin; a dated record may
 * still quote an older version. */
export function currentReleaseClaims(text: string): string[] {
  const pinned = /(?:\b(?:latest|current|newest)\b[^.\n]{0,40}v0\.2\.0\b|\bv0\.2\.0\b[^.\n]{0,40}\b(?:latest|current|newest)\b)/i;
  return text.split('\n').map(line => line.trim()).filter(line => pinned.test(line));
}

/** The pinned-version example is a current install command when it names the
 * previous release. */
export function pinnedOldRelease(text: string): string[] {
  return text.split('\n').map(line => line.trim()).filter(line => /\bCLAND_VERSION=v0\.2\.0\b/.test(line));
}

function textFiles(dir: string, extensions: Set<string>): string[] {
  return (readdirSync(resolve(root, dir), { recursive: true, withFileTypes: false }) as string[])
    .map(name => `${dir}/${name}`)
    .filter(path => extensions.has(extname(path)))
    .sort();
}

const siteFiles = [...textFiles('site/src', new Set(['.md', '.mdx', '.astro', '.ts'])),
  ...textFiles('site/public', new Set(['.sh']))];
const docsFiles = textFiles('docs', new Set(['.md', '.mdx']));
const readmes = ['README.md', 'hub/README.md'];

// The audit quotes the v0.2.0-era install command it recorded on 2026-10-24.
// It is a dated historical record, not a current install claim.
const historicalVersionRecords = new Set(['docs/brand/launch-claims-audit-T-783.md']);

test('install page, quickstart and landing give the same Homebrew, install-script and source paths', () => {
  for (const path of installSurfaces) {
    const text = read(path);
    assert.ok(text.includes(BREW), `${path}: ${BREW}`);
    assert.ok(text.includes(SCRIPT), `${path}: ${SCRIPT}`);
    for (const command of SOURCE) assert.ok(text.includes(command), `${path}: ${command}`);
  }
  for (const path of readmes) {
    const text = read(path);
    assert.ok(text.includes(BREW), `${path}: ${BREW}`);
    assert.ok(text.includes(SCRIPT), `${path}: ${SCRIPT}`);
  }
  for (const path of ['site/src/content/docs/docs/install.md', 'README.md', 'hub/README.md']) {
    assert.ok(read(path).includes(TAP), `${path}: name the published tap ${TAP}`);
  }
});

test('no install page, doc or README describes the tap as pending or pins the previous release', () => {
  // Positive controls keep the zero-match scan meaningful.
  assert.equal(staleTapClaims('The Homebrew tap is pending publication.').length, 1);
  assert.equal(staleTapClaims('macOS · Homebrew (pending)').length, 1);
  assert.equal(staleTapClaims('Homebrew tap pending publication. Install from source.').length, 1);
  assert.deepEqual(staleTapClaims('A pending approval waits for the human.\n\nThe log tap records each event.'), []);
  assert.equal(currentReleaseClaims('The latest release is v0.2.0.').length, 1);
  assert.equal(currentReleaseClaims('v0.2.0 is the current version.').length, 1);
  assert.deepEqual(currentReleaseClaims('The audit ran against a dev newer than the public v0.2.0 tag.'), []);

  const scanned = [...siteFiles, ...docsFiles, ...readmes];
  assert.ok(scanned.length > 40, `expected to scan the site, docs and READMEs, found ${scanned.length} files`);
  for (const path of scanned) {
    const text = read(path);
    assert.deepEqual(staleTapClaims(text), [], `${path}: the tap is published`);
    assert.deepEqual(currentReleaseClaims(text), [], `${path}: no current-release pin`);
  }
  for (const path of [...siteFiles, ...docsFiles, ...readmes]) {
    if (historicalVersionRecords.has(path)) continue;
    assert.deepEqual(pinnedOldRelease(read(path)), [], `${path}: CLAND_VERSION follows the latest release`);
  }
});

test('the install page describes the install script it ships', () => {
  const install = read('site/src/content/docs/docs/install.md');
  for (const fact of [
    'cland-web.tar.gz', 'cland-web.tar.gz.sha256', 'SHA-256',
    'packaging/build-install.sh', 'git ls-remote', '24.13.0 <25', 'mktemp', 'readlink',
  ]) assert.ok(install.includes(fact), `install.md must state ${fact}`);
  assert.match(install, /source\s+stamp/, 'install.md must state the source stamp check');
  assert.match(install, /legacy/i, 'install.md must name the fallback for tags without the shared helper');
});
