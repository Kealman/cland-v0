import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, open, readFile, writeFile, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { within } from '../src/executor/droplet/deadline.ts';
import { serveProject } from '../src/hub/daemon.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { until } from './until.ts';
import { projectHub, tempProject } from './harness.ts';
import { afterCleanup, onCleanup, ownDirectory } from './process-cleanup.ts';

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


for (const failedFlush of [false, true]) test(`startup journal read failure drains injected logs before lock release (flush failure: ${failedFlush})`, { timeout: 5_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-journal-failure-'));
  // A directory is readable as a descriptor, but its journal read fails EISDIR.
  await mkdir(join(root, '.cland/journal.jsonl'), { recursive: true });
  const gate = Promise.withResolvers<void>();
  const flushFailure = new Error('controlled log flush failure');
  const receipt = join(root, 'log-drained');
  const entries: Record<string, unknown>[] = [];
  let entered = false, rejected = false;
  let starting: ReturnType<typeof serveProject> | undefined;
  let disposal: Promise<void> | undefined;
  const dispose = () => disposal ??= within((async () => {
    gate.resolve();
    // Own acquisition independently of the expected-failure observer. Even a
    // late unexpected success must be stopped and its completion joined.
    const daemon = await starting?.catch(() => undefined);
    if (daemon) { await daemon.stop(); await daemon.stopped; }
  })(), 2000, undefined, () => new Error('direct startup disposal incomplete; root retained'));
  onCleanup(t, dispose);
  ownDirectory(t, root, { beforeRemove: dispose });
  // Direct daemon seam is needed to hold its injected flush barrier: projectHub
  // owns that callback itself. No native harness, Git or process probe runs.
  starting = serveProject(root, {
    env: fixtureEnvironment(root, process.env),
    processes: { alive: () => true, started: () => null },
    log: entry => { entries.push(entry); },
    flushLog: async () => {
      entered = true;
      await gate.promise;
      await writeFile(receipt, JSON.stringify(entries));
      await access(join(root, '.cland/hub.lock'));
      if (failedFlush) throw flushFailure;
    },
  });
  let acquired = false;
  const result = starting.then(daemon => { acquired = true; return { daemon }; }, error => { rejected = true; return { error }; });
  await until(() => entered || rejected || acquired, { what: 'failed-read cleanup enters held log drain', timeoutMs: 2000 });
  assert.equal(entered, true, 'read failure must join injected log work');
  assert.equal(rejected, false, 'startup cannot reject before drainage');
  await access(join(root, '.cland/hub.lock'));
  gate.resolve();
  const outcome = await result;
  assert.ok('error' in outcome, 'expected native journal-read failure');
  const error: unknown = outcome.error;
  const drained = JSON.parse(await readFile(receipt, 'utf8')) as Record<string, unknown>[];
  assert.ok(drained.some(entry => entry.event === 'hub-startup-step' && entry.step === 'reading startup journal'));
  if (failedFlush) {
    assert.ok(error instanceof AggregateError);
    assert.equal((error.cause as NodeJS.ErrnoException).code, 'EISDIR');
    assert.equal(error.errors[0], error.cause);
    assert.equal(error.errors[1], flushFailure);
  } else assert.equal((error as NodeJS.ErrnoException).code, 'EISDIR');
  await assert.rejects(access(join(root, '.cland/hub.lock')), { code: 'ENOENT' });
});
