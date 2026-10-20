// T1: retention and background tracker maintenance with scratch files, fake time and Git.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdir, readFile, readdir, symlink, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFLICT_RETENTION_MS, CONFLICT_PRUNE_INTERVAL_MS, pruneConflictCaptures } from '../src/tracker/conflict-captures.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject } from './harness.ts';
import { caseDeadlines } from './case-deadlines.ts';

const uuid = '00000000-0000-4000-8000-000000000000';
const file = 'T-1-example.md';
const capture = `${file}.${uuid}.conflict`;
const latest = async (path: string) => { const s = await lstat(path); return Math.max(s.mtimeMs, s.ctimeMs, s.birthtimeMs); };

test('retention deletes only expired finalized captures, preserving intents and item bytes', async t => {
  const root = await tempProject(t), dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, file), 'current item');
  await writeFile(join(dir, capture), 'concurrent editor bytes');
  const temporary = `${file}.${uuid}.tmp`, other = 'unrelated.conflict';
  const linked = `T-2-link.md.${uuid}.conflict`, directory = `T-3-directory.md.${uuid}.conflict`;
  await writeFile(join(dir, temporary), 'pending source');
  await writeFile(join(dir, other), 'other');
  await symlink(file, join(dir, linked));
  await mkdir(join(dir, directory));
  const now = await latest(join(dir, capture)) + CONFLICT_RETENTION_MS;
  assert.equal(await pruneConflictCaptures(dir, now), 0, 'exact bound is retained');
  const marker = join(dir, `.criterion-capture-${uuid}.json`);
  await writeFile(marker, JSON.stringify({ file, captured: capture }));
  assert.equal(await pruneConflictCaptures(dir, now + 1), 0, 'active recovery source is retained');
  await writeFile(marker, '{}');
  await assert.rejects(pruneConflictCaptures(dir, now + 1), /invalid capture intent/);
  assert.equal(await readFile(join(dir, capture), 'utf8'), 'concurrent editor bytes');
  await writeFile(marker, JSON.stringify({ file, captured: temporary }));
  assert.equal(await pruneConflictCaptures(dir, now + 1), 1);
  assert.equal(await readFile(join(dir, file), 'utf8'), 'current item');
  assert.deepEqual((await readdir(dir)).sort(), [file, temporary, other, linked, directory, `.criterion-capture-${uuid}.json`].sort());
});

test('an old mtime cannot expire a freshly captured inode and abort prevents deletion', async t => {
  const root = await tempProject(t), dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  const path = join(dir, capture);
  await writeFile(path, 'saved bytes');
  await utimes(path, 1, 1);
  const now = await latest(path);
  assert.equal(await pruneConflictCaptures(dir, now), 0);
  const abort = new AbortController();
  abort.abort();
  assert.equal(await pruneConflictCaptures(dir, now + CONFLICT_RETENTION_MS + 1, abort.signal), 0);
  assert.equal(await readFile(path, 'utf8'), 'saved bytes');
});

test('tracker prunes at startup and hourly while task writes preserve their canonical file', async t => {
  const run = caseDeadlines(t);
  const root = await tempProject(run.fixtures), dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  const old = join(dir, capture), recent = join(dir, `T-2-recent.md.${uuid}.conflict`);
  await writeFile(old, 'old capture');
  await writeFile(recent, 'recent capture');
  const now = Math.max(await latest(old), await latest(recent)) + CONFLICT_RETENTION_MS + 10;
  const recentAt = (now - CONFLICT_RETENTION_MS + CONFLICT_PRUNE_INTERVAL_MS / 2) / 1000;
  await utimes(recent, recentAt, recentAt);
  const clock = new FakeClock(now);
  let receipt = Promise.withResolvers<Record<string, unknown>>();
  const tracker = new Tracker({ root, db: ':memory:', clock, git: async () => null, readBase: async () => null,
    log: entry => { if (entry.event === 'task-conflict-pruned') receipt.resolve(entry); },
  });
  run.fixtures.after(() => tracker.stop());
  tracker.start();
  const made = await run.wait('concurrent task create', () => tracker.create({ id: 'human', name: 'human', role: null }, { size: 'S', title: 'Kept' }));
  await clock.advance(1);
  assert.equal((await run.wait('startup prune receipt', () => receipt.promise)).pruned, 1);
  assert.deepEqual((await readdir(dir)).filter(n => n.endsWith('.conflict')), [recent.split('/').at(-1)]);
  assert.equal((await readFile(join(root, made.path), 'utf8')).includes('title: Kept'), true);
  receipt = Promise.withResolvers<Record<string, unknown>>();
  await clock.advance(CONFLICT_PRUNE_INTERVAL_MS);
  assert.equal((await run.wait('hourly prune receipt', () => receipt.promise)).pruned, 1);
  assert.deepEqual((await readdir(dir)).filter(n => n.endsWith('.conflict')), []);
  assert.equal(tracker.view(made.id).title, 'Kept');
  await tracker.stop();
  await writeFile(old, 'after stop');
  await clock.advance(CONFLICT_PRUNE_INTERVAL_MS);
  assert.equal(await readFile(old, 'utf8'), 'after stop');
});
