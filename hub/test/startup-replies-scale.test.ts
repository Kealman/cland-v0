// T3: first status receipt on a live-size retained-history fixture, including
// stopped processes, suite receipts and plans. Coordinator-approved scale seam
// (topic-785, T-1039); no native hub process needed. The smaller byte guard stays T2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { FakeClock } from './fake-clock.ts';
import { tempProject, connectSocket } from './harness.ts';
import {onCleanup} from './process-cleanup.ts';
import { performance } from 'node:perf_hooks';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import { withPlan } from '../src/tracker/plan.ts';

test('eight startup replies fit per-frame and total budgets on a thousand-item durable fixture', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const { serializeItem } = await import('../src/tracker/item.ts');
  const { projectHub, connectUi } = await import('./harness.ts');
  const { join } = await import('node:path');
  const root = await tempProject(t), at = '2026-10-16T12:00:00.000Z';
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await Promise.all(Array.from({ length: 1000 }, (_, i) => writeFile(join(root, `.cland/tasks/T-${i + 1}-fixture.md`), serializeItem({
    fm: { id: `T-${i + 1}`, kind: 'task', size: 'S', title: `Startup item ${i + 1}`, state: i < 104 ? 'open' : 'closed',
      status: i < 104 ? 'planned' : 'done', labels: [], assignee: null, parent: `E-${1001 + Math.floor(i / 250)}`, blocked_by: [], topic: null, branch: null, created: at, updated: at },
    body: '## Summary\n\nA realistic startup item.\n\n## Implementation\n\n' + 'Detailed item body stays on demand. '.repeat(50), comments: [
      {author:'reviewer',at,text:'The card facts include a bounded verdict reason. Full review prose remains on demand.',
        verdict:{verdict:'review',result:'clear',run:'review-1',scope:'full',by:'reviewer'}},
      {author:'human',at,text:'## Resolution\n\nUse the shared projection for the card.'},
    ],
  }))));
  for (let n = 0; n < 4; n++) await writeFile(join(root, `.cland/tasks/E-${1001 + n}-fixture.md`), serializeItem({
    fm: { id: `E-${1001 + n}`, kind: 'epic', title: `Startup plan ${n}`, state: 'open', labels: [], assignee: null, parent: null,
      blocked_by: [], topic: null, branch: null, created: at, updated: at },
    body: withPlan('## Summary\n\nA retained plan with 250 child items.', { stages: [{ name: 'retained stage', qa: { scope: 'none', when: 'per-item' },
      lanes: [Array.from({ length: 250 }, (_, i) => `T-${n * 250 + i + 1}`)] }] }), comments: [],
  }));
  const store = new Store(join(root, '.cland/hub.db'));
  store.createTopic('general', 'General', null, at);
  store.transaction(() => {
    for (let n = 0; n < 200; n++) store.record({ id: `m${n}`, from: 'human', fromKind: 'human', via: 'hub', to: [],
      text: `Message ${n}: ` + 'A complete General message. '.repeat(95), topic: 'general', ts: at }, [], Date.parse(at));
    for (let n = 0; n < 800; n++) {
      const topic = `closed-${n}`;
      store.createTopic(topic, `Closed topic ${n}`, null, at);
      store.record({ id: `report-${n}`, from: 'reviewer', fromKind: 'agent', via: 'hub', to: ['implementer'],
        text: 'Completed review. '.repeat(100), topic, ts: at }, [], Date.parse(at));
      store.setTopicStatus(topic, 'closed', at);
    }
    for (let n = 1; n <= 8163; n++) store.registerArtifact(id => ({ id, kind: 'note', title: `Artifact ${n} with a realistic title for the startup list`, creator: 'human', creatorKind: 'human',
      time: at, topic: 'general', status: 'shared', path: join(root, `.cland/artifacts/${id}-startup-fixture.md`) }), () => {});
    // Retained reports and stopped sessions coexist on the live project. Replaying
    // each terminal process must not rewrite the entire suite history again.
    const timingIdentities = Array.from({ length: 800 }, (_, i) => `hub/test/retained-${i}.test.ts: a retained test receipt with a realistic identity`);
    for (let n = 0; n < 1645; n++) {
      const job: SuiteJob = { id: `run-${n}`, executor: 'local', mode: 'auto', cwd: root, topic: 'general', to: [], actor: null,
        head: `head-${n}`, branch: `t/T-${n + 1}`, log: join(root, `run-${n}.log`), result: join(root, `run-${n}.json`), gate: join(root, `gate-${n}`),
        pid: null, started: at, queued: at, finished: at, completedAt: at, outcome: { code: 0, cause: 'completed' }, artifact: null,
        reported: true, cleaned: true, error: null, state: 'finished', timingIdentities };
      store.setMeta(`suite-job:${job.id}`, JSON.stringify({ position: n, job }));
    }
  });
  store.close();
  const processes = new ProcessTable(join(root, '.cland/hub.db'));
  for (let n = 0; n < 217; n++) processes.put({ name: `stopped-${n}`, sessionId: `session-${n}`, harness: 'codex', role: 'implementer', model: null,
    cwd: root, pid: null, harnessId: null, harnessSessionId: null, startedAt: at, status: 'stopped', stoppedAt: at, archivedAt: at });
  processes.close();
  await writeFile(join(root, '.cland/journal.jsonl'), Array.from({length: 200}, (_, i) => JSON.stringify({ts: new Date(Date.parse(at) - (200-i)*61000).toISOString(),
    event: 'notification', kind: 'verdict', item: `T-${i+1}`, text: 'A completed source review receipt. '.repeat(5)}) + '\n').join(''));
  const started = performance.now();
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, hub.discovery);
  const requests = [{type:'hub.status'}, {type:'rule.list',all:true}, {type:'topic.history',topic:'general',limit:200}, {type:'artifact.list'},
    {type:'task.list',projection:'summary',state:'open'}, {type:'events.list',limit:200}, {type:'session.list'}, {type:'account.list'}];
  let total = 0;
  for (const request of requests) {
    const reply = await ui.request(request);
    assert.equal(reply.ok, true, reply.error);
    if (request.type === 'hub.status') {
      const elapsed = performance.now() - started;
      t.diagnostic(`first completed hub.status: ${elapsed.toFixed(1)} ms; budget 10000 ms (original 15000 ms guard retained)`);
      assert.ok(elapsed < 10000, `first hub.status took ${elapsed.toFixed(1)} ms; T-1081 budget 10000 ms`); // lint-allow-wall-clock: C6 measures startup to the completed status receipt.
      // Coordinator decision a6b632c3: 3× the local 5 s target gives loaded T3
      // shards headroom while staying well below the 39 s production regression.
      assert.ok(elapsed < 15000, `first hub.status took ${elapsed.toFixed(1)} ms; budget 15000 ms`); // lint-allow-wall-clock: T-1039 guards end-to-end startup through the first completed status reply; the separate copied-state CLI evidence enforces the local 5 s target.
      assert.equal((reply.value as { recentSuites: unknown[] }).recentSuites.length, 1);
    }
    const bytes = Buffer.byteLength(JSON.stringify(reply) + '\n');
    assert.ok(bytes <= 256 * 1024, `${request.type}: ${bytes} bytes exceeds 256 kB`);
    total += bytes;
    if (request.type === 'task.list') assert.equal((reply.value as {items:unknown[]}).items.length, 108);
    if (request.type === 'artifact.list') assert.equal((reply.value as {artifacts:unknown[]}).artifacts.length, 100);
  }
  assert.ok(total <= 1024 * 1024, `${total} total startup bytes exceeds 1 MB`);
  const snapshot=await connectSocket(hub.discovery.socket);
  onCleanup(t,()=>snapshot.close());
  snapshot.send({type:'hello',protocol:2,secret:hub.discovery.secret,client:'startup-card-budget',features:['snapshot']});
  let itemBytes=0;
  for (;;) {
    const frame=await snapshot.next();
    assert.notEqual(frame.type,'snapshot.refused',JSON.stringify(frame));
    if (frame.type==='snapshot' && frame.domain==='items') {
      itemBytes=Buffer.byteLength(JSON.stringify(frame));
      const rows=(frame.value as {items:Array<Record<string,unknown>>}).items;
      assert.equal(rows.length,108);
      assert.ok(rows.every(row=>!Object.hasOwn(row,'body')&&!Object.hasOwn(row,'comments')));
      assert.ok(rows.filter(row=>row.kind==='task'&&row.state==='open').every(row=>row.agents_text&&row.decision));
      assert.ok(rows.filter(row=>row.state==='closed').every(row=>!row.agents_text&&!row.decision));
    }
    if (frame.type==='snapshot.end') break;
  }
  t.diagnostic(`startup replies: ${total} bytes; open/container card snapshot: ${itemBytes} bytes`);
  assert.ok(itemBytes>0 && itemBytes<=1024*1024, `${itemBytes} items snapshot bytes exceeds 1 MiB`);
  for (let n = 0; n < 4; n++) {
    const reply = await ui.request({ type: 'task.view', item: `E-${1001 + n}` });
    assert.equal(reply.ok, true, reply.error);
    const item = (reply.value as { item: { plan: { stages: Array<{ lanes: string[][] }> }; planError?: string } }).item;
    assert.equal(item.planError, undefined);
    assert.equal(item.plan.stages[0]!.lanes[0]!.length, 250, 'startup validates plans against the complete index');
  }
});
