// Report-only, isolated synthetic startup work probe. No live state or child processes.
import test from 'node:test';
import { Store } from '../src/hub/store.ts';
import { Suites } from '../src/hub/suites.ts';
import { tempProject } from '../test/harness.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { FakeClock } from '../test/fake-clock.ts';

if (process.argv.includes('--help')) console.log('Usage: node hub/scripts/measure-suite-history.ts\nReport-only synthetic suite history startup memory; 3000 finished records in a disposable project. No live data or browser. Approximately 10 seconds. Live-scale evidence uses the T-1467 measure-memory probe under a Coordinator slot.');
else test('synthetic suite history startup measurement', async t => {
  const root = await tempProject(t, 'suite-memory-');
  const store = new Store();
  const large = 'x'.repeat(100_000);
  for (let n = 0; n < 3000; n++) store.setMeta(`suite-job:${n}`, JSON.stringify({ position: n, job: { id: String(n), state: 'finished', reported: true, cleaned: true, executor: 'local', outcome: { code: 0, cause: '' }, mode: 'auto', head: '', branch: '', to: [], actor: null, tierPlan: [large] } }));
  const before = process.memoryUsage();
  const suites = new Suites(store, root, async () => {}, { clock: new FakeClock(), env: fixtureEnvironment(root, process.env) });
  try { console.log(JSON.stringify({ platform: `${process.platform}/${process.arch}`, before, after: process.memoryUsage(), rows: suites.status(false).length, note: 'Synthetic startup only; includes seeded in-process allocator state; no GC, browser, live history or suite evidence. Report mode.' })); }
  finally { await suites.close(); store.close(); }
});
