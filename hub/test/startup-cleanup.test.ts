import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { access, open, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, tempProject } from './harness.ts';
import { afterCleanup, onCleanup } from './process-cleanup.ts';

function journalOwner(t: TestContext) {
  const handles: FileHandle[] = [];
  const openings: Promise<FileHandle>[] = [];
  onCleanup(t, async () => {
    const opened = await Promise.allSettled(openings);
    const closed = await Promise.allSettled(handles.map(file => file.close()));
    const failures = [...opened, ...closed].filter(result => result.status === 'rejected');
    if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'journal fixture cleanup failed');
  });
  return { handles, openings, open(path: string) {
    const opening = open(path, 'a+').then(file => { handles.push(file); return file; });
    openings.push(opening);
    return opening;
  } };
}

// T2: embedded project startup, real journal descriptors, injected SQLite failure.
test('database open failure closes startup journal handles before rejecting', { timeout: 5_000 }, async t => {
  const root = await tempProject(t);
  const owner = journalOwner(t);
  const { handles, openings } = owner;
  const failure = new Error('controlled database open failure');
  let descriptorsAtRejection: number[] = [];
  await assert.rejects(projectHub(t, root, {}, {
    journalOpen: owner.open,
    openDatabase: () => { throw failure; },
  }), error => {
    descriptorsAtRejection = handles.map(file => file.fd);
    return error === failure;
  });
  await Promise.all(openings);
  assert.equal(handles.length, 1, 'startup opened the domain journal');
  assert.deepEqual(descriptorsAtRejection, [-1], 'startup rejection must join journal closure');
  await assert.rejects(access(join(root, '.cland/hub.lock')), { code: 'ENOENT' });
  const successor = await projectHub(t, root);
  await successor.stop();
});

test('abandoned journal observation closes acquired handles before fixture root removal', { timeout: 5_000 }, async t => {
  const root = await tempProject(t);
  const owner = journalOwner(t);
  // Deliberately omit observing setup: the fallback must join both native opens.
  void owner.open(join(root, 'first.jsonl'));
  void owner.open(join(root, 'second.jsonl'));
  onCleanup(t, async () => {
    await access(root);
    assert.deepEqual(owner.handles.map(file => file.fd), [-1, -1]);
  });
  afterCleanup(t, async () => {
    await assert.rejects(access(root), { code: 'ENOENT' });
    assert.deepEqual(owner.handles.map(file => file.fd), [-1, -1]);
  });
});
