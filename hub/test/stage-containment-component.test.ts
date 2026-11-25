// T2: tracker stage containment with injected Git and disposable storage; no native processes.
import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {writeFile, readFile, unlink} from 'node:fs/promises';
import {serializeItem, parseItem} from '../src/tracker/item.ts';
import {withPlan} from '../src/tracker/plan.ts';
import {ownedTracker} from './owned-tracker.ts';
import {trackerFileCase} from './tip-churn-file-fixture.ts';
import {eventually} from './harness.ts';
import {until, testDeadlineMs} from './until.ts';
const containmentBatch = await containmentFixture();
test('restored stage covers and a landing defer containment and visit only affected stage members', t => containmentBatch.run(t));

async function containmentFixture() {
  const head = 'a'.repeat(40), tree = 'b'.repeat(40);
  let visits: string[] = [];
  let snapshotVisits: string[] = [];
  let notify: (file: string) => void = () => assert.fail('watcher not started');
  const file = await trackerFileCase(async ({owner, root, step}) => {
    const tracker = ownedTracker(owner, { root, db: ':memory:',
      git: async args => args[0] === 'for-each-ref' ? `${head} refs/heads/dev` : args[0] === 'rev-parse' ? args.at(-1)!.replace(/\^\{commit\}$/, '') : '',
      readBase: async () => 'dev', stageTree: async () => tree,
      scheduleTips: () => ({ poke() {}, stop() {} }), watch: (_directory, callbacks) => { notify = callbacks.changed; return {close() {}}; },
      log: entry => {
        if (entry.event === 'stage-containment-visit') visits.push(String(entry.landing));
        if (entry.event === 'stage-snapshot-member-visit') snapshotVisits.push(String(entry.item));
      },
    });
    const at = new Date().toISOString();
    for (let n = 1; n <= 2002; n++) {
      const epic = n <= 2;
      await step(() => writeFile(join(root, `.cland/tasks/${epic ? 'E' : 'T'}-${n}-fixture.md`), serializeItem({
        fm: { id: `${epic ? 'E' : 'T'}-${n}`, kind: epic ? 'epic' : 'task', title: `Fixture ${n}`, state: epic ? 'open' : 'closed', ...(!epic ? {status: 'done' as const, size: 'S' as const} : {}),
          labels: [], assignee: null, parent: epic ? null : n <= 1002 ? 'E-1' : 'E-2', blocked_by: [], topic: null, branch: null, created: at, updated: at },
        body: epic ? withPlan('', {stages: [{name: 'build', qa: {scope: 'none', when: 'after-stage'}, lanes: [Array.from({length: 1000}, (_, i) => `T-${3 + (n - 1) * 1000 + i}`)]}]}) : '', comments: [],
      })));
    }
    await step(() => tracker.start({deferReadyChecks: true}));
    for (let e = 1; e <= 2; e++) {
      const items = Array.from({length: 1000}, (_, n) => `T-${3 + (e - 1) * 1000 + n}`);
      for (const id of items) tracker.recordMerge(id, {branch: 't/fixture', tip: head, commit: head, base: 'dev'});
    }
    await step(() => tracker.refreshFreshness());
    return {tracker, step, root};
  });
  return { run(t: TestContext) {
    const work = file.run(t, async () => {
      const {tracker, step, root} = file.value;
      visits = [];
      snapshotVisits = [];
      const requestBudget = testDeadlineMs(250);
      tracker.useVerify(() => null, () => [{id: 'linux', head, tree, platform: 'Linux droplet'}]);
      await step(() => until(() => {
        for (const id of ['E-1', 'E-2']) {
          const stage = tracker.view(id).stages![0]!;
          assert.equal(stage.state, 'open', 'a merged stage cannot close before deferred containment finishes');
          assert.ok(stage.cover?.pending?.includes('Linux droplet'));
        }
        assert.equal(visits.length, 0, 'restored receipts never sweep containment on the request path');
        return true;
      }, {what: 'restored cover request completes', timeoutMs: requestBudget, behaviour: 'stage containment request latency'}));
      const restoredSnapshotVisits = snapshotVisits.length;
      await file.owner.wait('restored containment settles', () => step(() => eventually('both stage covers settle', async () => {
        const stages = await Promise.all(['E-1', 'E-2'].map(id => tracker.viewAsync(id)));
        return stages.every(view => view.stages![0]!.cover?.linux === 'linux' && view.stages![0]!.state === 'closed') ? true : undefined;
      })));
      visits = [];
      snapshotVisits = [];
      await step(() => until(() => {
        tracker.recordMerge('T-3', {branch: 't/fixture', tip: head, commit: 'c'.repeat(40), base: 'dev'});
        assert.equal(tracker.view('E-1').stages![0]!.state, 'open', 'a changed landing invalidates closure until containment settles');
        assert.equal(tracker.view('E-2').stages![0]!.state, 'closed', 'unaffected stage keeps its closure');
        assert.equal(visits.length, 0, 'landing reads never sweep containment on the request path');
        return true;
      }, {what: 'landing request completes', timeoutMs: requestBudget, behaviour: 'stage containment request latency'}));
      const landingSnapshotVisits = [...snapshotVisits];
      await file.owner.wait('landing containment settles', () => step(() => eventually('affected stage settles', async () =>
        (await tracker.viewAsync('E-1')).stages![0]!.cover?.linux === 'linux' ? true : undefined)));
      assert.ok(visits.length <= 1001, `only the affected thousand-row stage is visited: ${visits.length}`);
      assert.ok(visits.includes('c'.repeat(40)), 'the new landing was actually checked');
      t.diagnostic(`snapshot member visits: restored ${restoredSnapshotVisits}; landing affected ${landingSnapshotVisits.filter(id => id === 'E-1').length}; landing unaffected ${landingSnapshotVisits.filter(id => id === 'E-2').length}`);
      assert.equal(landingSnapshotVisits.filter(id => id === 'E-2').length, 0, 'landing reads never map unaffected stage snapshots');
      assert.ok(landingSnapshotVisits.filter(id => id === 'E-1').length <= 1000, 'landing maps its affected snapshot at most once');
      assert.equal(restoredSnapshotVisits, 0, 'restored cover binding reuses stage snapshots');
      snapshotVisits = [];
      tracker.view('E-1'); tracker.view('E-2');
      assert.equal(snapshotVisits.length, 0, 'repeated settled reads map no snapshot members');
      const memberPath = join(root, '.cland/tasks/T-3-fixture.md');
      const observedSave = (write: () => Promise<void>) => step(async () => {
        let observed = false;
        const off = tracker.onChange(change => { if (change.id === 'T-3') observed = true; });
        try {
          await write();
          notify('T-3-fixture.md');
          await until(() => observed, {what: 'changed member publication after watched file indexing'});
        } finally { off(); }
      });
      const save = (fields: {state?: 'open' | 'closed'; status?: 'in progress' | 'done'; parent?: string}) => observedSave(async () => {
        const item = parseItem(await readFile(memberPath, 'utf8'));
        Object.assign(item.fm, fields);
        await writeFile(memberPath, serializeItem(item));
      });
      await save({state: 'open', status: 'in progress'});
      assert.equal(tracker.view('E-1').stages![0]!.merged, 999, 'a source-state change invalidates the cached merged count');
      assert.equal(tracker.view('E-1').stages![0]!.statuses['in progress'], 1, 'source status changes update the cached card counts');
      await save({state: 'closed', status: 'done'});
      assert.equal(tracker.view('E-1').stages![0]!.merged, 1000);
      await save({parent: 'E-2'});
      assert.equal(tracker.view('E-1').stages![0]!.merged, 999, 'reparenting invalidates cached membership evidence');
      await save({parent: 'E-1'});
      assert.equal(tracker.view('E-1').stages![0]!.merged, 1000, 'restored membership is observed');
      await observedSave(() => unlink(memberPath));
      assert.equal(tracker.view('E-1').stages![0]!.merged, 999, 'removing a previously cached member invalidates its stage');
      assert.equal(tracker.view('E-1').stages![0]!.state, 'open');
    });
    t.after(() => file.owner.restore());
    return work;
  }};
}

