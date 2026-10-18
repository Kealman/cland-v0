// T2 component: manual stop classification across the grace boundary on a FakeClock.
// Real Git merge stops and native signal handling stay in session-stop-races.test.ts (T3).
import test from 'node:test';
import { FakeClock } from './fake-clock.ts';
import { projectHub, tempProject } from './harness.ts';
import { stopClassification, STOP_GRACE_MS } from './stop-classification-fixture.ts';

test('manual stops remain stopped across graceful and forced completion', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const hub = await projectHub(t, root, { CLAND_STOP_GRACE_MS: String(STOP_GRACE_MS) }, { clock });
  await stopClassification(t, 'manual', { root, clock, ...hub });
});
