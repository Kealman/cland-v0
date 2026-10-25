// T1: the site and docs say who commits the onboarding's work at the root.
// Rule: a generated Codex Aide runs workspace-write and cannot commit at the
// project root, so the Coordinator commits there (T-1222, human 2026-10-24).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const site = fileURLToPath(new URL('..', import.meta.url));
const repo = resolve(site, '..');
const read = (path: string) => readFileSync(resolve(repo, path), 'utf8');

// A line where the Aide commits passes only when the Aide's own clause says it
// cannot commit at the root, or makes the commit conditional on a harness that
// can write the root. A token such as `workspace-write`, `Coordinator`, `no
// extra writable roots` or a later clause about root commits excuses nothing.
const noRootCommit = /\bAide\b[^.;\n]{0,80}\b(?:cannot|can't|can not) commit at the (?:project )?root/i;
const capableHarness = /\bAide\b[^.;\n]{0,80}\bharness[^.;\n]{0,40}\bcan write the (?:project )?root/i;
// `commits` as a noun ("root commits cannot", "Git commits need") is not a claim.
const aideCommitVerb = /\bAide\b[^.;\n]{0,80}\bcommits?\b(?!\s+(?:cannot|can't|need|needs|remain|remains|are|is|stay|stays)\b)/i;

/** A line that has the Aide committing at the root is stale unless the Aide's
 * own clause states the generated policy that keeps it out of it. */
export function aideCommitClaims(text: string): string[] {
  return text.split('\n').map(line => line.trim())
    .filter(line => aideCommitVerb.test(line) && !noRootCommit.test(line) && !capableHarness.test(line));
}

function textFiles(dir: string, extensions: Set<string>): string[] {
  return (readdirSync(resolve(repo, dir), { recursive: true, withFileTypes: false }) as string[])
    .map(name => `${dir}/${name}`)
    .filter(path => extensions.has(extname(path)))
    .sort();
}

const surfaces = [
  ...textFiles('site/src', new Set(['.md', '.mdx', '.astro'])),
  ...textFiles('docs', new Set(['.md', '.mdx'])),
];

// Closed-release specs record the decision they shipped; T-1222 supersedes
// their onboarding commit for the generated defaults. They are not current
// claims, and this item changes only the publishable site and brand paths.
const historicalRecords = new Set(['docs/spec/v0.1.3.md', 'docs/spec/v0.1.4.md']);

test('an unconditional Aide commit claim is detected', () => {
  assert.equal(aideCommitClaims('8. **The commit.** The Aide commits everything `cland init` and the onboarding wrote, on `dev`.').length, 1);
  assert.equal(aideCommitClaims('The Aide commits the onboarding on dev.').length, 1);
  assert.equal(aideCommitClaims('The Aide commits everything on dev; the Coordinator reviews it.').length, 1);
  assert.equal(aideCommitClaims('The Aide commits everything on dev, and the Coordinator reviews it.').length, 1);
  assert.equal(aideCommitClaims('The workspace-write Aide commits everything on dev.').length, 1);
  assert.equal(aideCommitClaims('The workspace-write Aide has no extra writable roots and commits on dev.').length, 1);
  assert.equal(aideCommitClaims('The Aide commits the onboarding on dev; root commits remain blocked for it.').length, 1);
  assert.deepEqual(aideCommitClaims('A Codex Aide runs in the generated `workspace-write` sandbox and cannot commit at the project root.'), []);
  assert.deepEqual(aideCommitClaims('The Aide cannot commit at the root; the Coordinator commits everything else.'), []);
  assert.deepEqual(aideCommitClaims('The Coordinator commits everything the Aide wrote, on `dev`.'), []);
  assert.deepEqual(aideCommitClaims('The Aide commits everything on dev when its harness can write the project root.'), []);
  assert.deepEqual(aideCommitClaims('An Aide whose harness can write the root commits and publishes that work itself.'), []);
  assert.deepEqual(aideCommitClaims('An Aide on workspace-write has no extra roots; root-level Git commits need another policy.'), []);
  assert.deepEqual(aideCommitClaims('The workspace-write Aide has no extra roots, so root commits cannot write `.git/index.lock`.'), []);
});

test('the site and docs agree on who commits the onboarding at the root', () => {
  assert.ok(surfaces.length > 30, `expected the site and docs surfaces, found ${surfaces.length} files`);
  for (const path of surfaces) {
    if (historicalRecords.has(path)) continue;
    assert.deepEqual(aideCommitClaims(read(path)), [], `${path}: the workspace-write Aide cannot commit at the root; the Coordinator commits there`);
  }

  const quickstart = read('site/src/content/docs/docs/quickstart.md');
  assert.match(quickstart, /workspace-write/, 'quickstart names the generated sandbox');
  assert.match(quickstart, /cannot commit at the (?:project )?root/, 'quickstart states the Aide cannot commit at the root');
  assert.match(quickstart, /Coordinator commits everything/, 'quickstart names the role that commits');
});
