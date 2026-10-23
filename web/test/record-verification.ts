// Manual recording refresh: sealed semantic executor fixture, no real provider.
// Run explicitly with node --test web/test/record-verification.ts; not suite discovery.
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import { suiteUnit } from '../../hub/test/suite-unit-fixture.ts';
import { projectHub, tempProject, connectUi } from '../../hub/test/harness.ts';
test('record queue and executor status for the web model', async t => {
  const f = await suiteUnit(t, { remoteBudget: 1, machineReceiptsOnly: true });
  const completed = await f.launch({ fresh: true });
  await f.suites.settled();
  await f.tick(9000);
  await f.finish(completed.id);
  const local = await f.launch({ fresh: true });
  await f.suites.settled();
  const remote = await f.launch({ executor: 'droplet', fresh: true });
  await f.machine.waits.run(f.when(() => f.status(remote.id)?.state === 'running' ? true : undefined));
  await f.machine.started(remote.id);
  await f.suites.settled();
  await f.launch({ executor: 'local', fresh: true });
  await f.tick(1000);
  await f.launch({ executor: 'droplet', fresh: true });
  await f.tick(2000);
  await f.suites.settled();
  const queue = f.suites.snapshot();
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const executor = await ui.request({ type: 'executor.status' });
  if (!executor.ok) throw new Error(executor.error);
  // Keep the complete queue, normalizing random ids and disposable paths only.
  let encoded = JSON.stringify({ queueFrame: { type: 'verification.queue', queue }, executorFrame: executor }, null, 2);
  encoded = encoded.replaceAll(f.root, '/scratch/queue').replaceAll(root, '/scratch/executor');
  for (const [i, id] of [local.id, remote.id, ...queue.waiters.map(w => w.id)].entries()) encoded = encoded.replaceAll(id, `recorded-run-${i + 1}`);
  encoded = encoded.replaceAll(completed.id, 'recorded-completed');
  await writeFile(new URL('./fixtures/verification.json', import.meta.url), encoded + '\n');
});
