// T2: held filesystem work proves fixture interruption ordering without native processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathFixture } from './executable-path-fixture.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { realClock } from '../src/hub/clock.ts';
import { testWaitMs } from './until.ts';

test('closing a PATH fixture joins held filesystem work and fences its next operation before removal', async t => {
  const entered = Promise.withResolvers<string>(), release = Promise.withResolvers<void>();
  let fixture: ReturnType<typeof pathFixture> | undefined, sequence: Promise<void> | undefined;
  beforeDirectories(t, async () => {
    const closing = fixture?.close();
    release.resolve(); // Failed assertions cannot strand an admitted writer.
    await sequence?.catch(() => {});
    await closing;
  });
  fixture = pathFixture(t, 'cland-path-held-work-');
  let heldWriteCompleted = false, laterAdmitted = false;
  sequence = fixture.run(async (root, step) => {
    await step(async () => {
      entered.resolve(root);
      await release.promise;
      await writeFile(join(root, 'held-receipt'), 'complete\n');
      heldWriteCompleted = true;
    });
    await step(async () => {
      laterAdmitted = true;
      await writeFile(join(root, 'late-write'), 'must not run\n');
    });
  });
  const rejected = assert.rejects(sequence, /fixture work admission closed/);
  void rejected.catch(() => {}); // Early assertion failure still owns the rejection.
  const root = await within(entered.promise, testWaitMs(1000), realClock, () => new Error('held filesystem step receipt missing'));
  const closing = fixture.close();
  assert.equal((await stat(root)).isDirectory(), true, 'root remains while admitted filesystem work is held');
  release.resolve();
  await within(closing, testWaitMs(1000), realClock, () => new Error('whole-sequence cleanup receipt missing'));
  await rejected;
  assert.equal(heldWriteCompleted, true, 'admitted write settled before removal');
  assert.equal(laterAdmitted, false, 'next filesystem admission was fenced');
  await assert.rejects(stat(root), { code: 'ENOENT' }, 'root removal follows the joined sequence');
});
