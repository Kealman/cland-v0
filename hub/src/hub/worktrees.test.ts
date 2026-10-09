// A launch with an item never overwrites a claim another session took while the harness started (rev-cc on T-58): it
// is refused and the session it started is stopped. A real tracker, and a stand-in for the sessions whose launch lets
// another session claim the item meanwhile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Tracker } from '../tracker/tracker.ts';
import { TaskWorktrees } from './worktrees.ts';
import type { Sessions } from '../adapters/sessions.ts';
import type { HarnessProcessView } from '../protocol.ts';

test('a claim another session takes during the launch refuses it: the claim stays, the new session is stopped', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cland-worktrees-unit-'));
  const tracker = new Tracker({ root, db: join(root, 'hub.db') });
  t.after(async () => {
    tracker.stop();
    await rm(root, { recursive: true, force: true });
  });
  // no territory here: the launch goes to the project root, which is all this race needs
  tracker.create({ id: 'human', name: 'human', role: null }, { title: 'Contested', kind: 'task' });
  tracker.claim({ id: 'sess-coord', name: 'coord', role: 'coordinator' }, 'T-1');
  const process = { name: 'impl-1', role: 'implementer', sessionId: 'sess-impl-1', cwd: root, item: null } as HarnessProcessView;
  const stopped: string[] = [];
  const sessions = {
    launch: async () => {
      tracker.claim({ id: 'sess-impl-9', name: 'impl-9', role: 'implementer' }, 'T-1', { force: true });
      return process;
    },
    stop: async (name: string) => {
      stopped.push(name);
      return { ...process, status: 'stopped' };
    },
  } as unknown as Sessions;

  await assert.rejects(
    new TaskWorktrees({ tracker }).launch(sessions, { name: 'impl-1', role: 'implementer', item: 'T-1' }),
    /T-1 is claimed by impl-9 \(implementer\), taken while impl-1 started: launch refused, the claim stays with its holder; impl-1 was stopped/,
  );
  assert.deepEqual(stopped, ['impl-1']);
  assert.equal(tracker.view('T-1').claim?.session, 'impl-9');

  // the Coordinator's claim, still in place after the spawn, is taken over as before
  tracker.claim({ id: 'sess-coord', name: 'coord', role: 'coordinator' }, 'T-1', { force: true });
  const quiet = { launch: async () => process } as unknown as Sessions;
  const taken = await new TaskWorktrees({ tracker }).launch(quiet, { name: 'impl-1', role: 'implementer', item: 'T-1' });
  assert.equal(taken.claim?.session, 'impl-1');
});
