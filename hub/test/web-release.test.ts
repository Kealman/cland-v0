// T1: public release selection shared by Tree, Board and Graph; no browser or hub needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExplorerSummary } from '../../shared/wire/index.ts';
import { currentRelease, compareReleases } from '../../web/src/current-release.ts';

const release = (id: string, version?: string, rank?: number): ExplorerSummary => ({
  id, kind: 'release', title: id, state: 'open',
  ...(version === undefined ? {} : { version }), ...(rank === undefined ? {} : { rank }),
  parent: null, labels: [], blocked_by: [], open_blockers: [], claim: null, holds: [],
  criteria: { total: 0, done: 0, verified: 0, stale: 0, failed: 0 },
  updated: '2026-10-22T00:00:00Z', verdicts: [],
});

test('current release uses semver precedence before unversioned rank and id', () => {
  // Deliberately scrambled: numeric core, numeric/text prerelease identifiers,
  // shorter prerelease lists, build metadata ties and unversioned rank/id ties.
  const items = [
    release('R-1100'), release('R-12', '1.10.0'), release('R-10', '1.2.0'),
    release('R-8', '1.2.0-beta.11'), release('R-6', '1.2.0-beta'),
    release('R-4', '1.2.0-alpha.beta'), release('R-2', '1.2.0-alpha.2'),
    release('R-1', '1.2.0-alpha'), release('R-3', '1.2.0-alpha.10'),
    release('R-5', '1.2.0-rc.1'), release('R-7', '1.2.0-beta.2'),
    release('R-9', '1.2.0+build', 1), release('R-11', '2.0.0'),
    release('R-20', undefined, 2), release('R-19', '', 2), release('R-21', undefined, 1),
  ];
  const expected = ['R-1', 'R-2', 'R-3', 'R-4', 'R-6', 'R-7', 'R-8', 'R-5',
    'R-9', 'R-10', 'R-12', 'R-11', 'R-21', 'R-19', 'R-20', 'R-1100'];
  assert.deepEqual([...items].sort(compareReleases).map(item => item.id), expected);
  let remaining = items;
  for (const id of expected) {
    assert.equal(currentRelease(remaining)?.id, id);
    remaining = remaining.filter(item => item.id !== id);
  }
  assert.equal(currentRelease(remaining), undefined);
});

test('selected open release overrides defaults while closed and other kinds are excluded', () => {
  const items = [release('R-1', '0.1.0'), release('R-2', '0.2.0'), release('R-3'),
    { ...release('R-4', '0.0.1'), state: 'closed' as const },
    { ...release('E-5', '0.0.2'), kind: 'epic' }];
  for (const id of ['R-2', 'R-3']) {
    assert.equal(currentRelease(items, 'release', id)?.id, id);
  }
  for (const id of ['R-4', 'E-5', 'R-404']) assert.equal(currentRelease(items, 'release', id)?.id, 'R-1');
  assert.equal(currentRelease(items, 'epic')?.id, 'E-5', 'custom top level remains supported');
});
