// T3: first status receipt on a live-size retained-history fixture, including
// stopped processes, suite receipts and plans. Coordinator-approved scale seam
// (topic-785, T-1039); no native hub process needed. The synthetic byte guard stays T2; the pinned corpus complements the thousand-row case here.
import test from 'node:test';
import { copyPinnedTracker } from './pinned-tracker.ts';
import assert from 'node:assert/strict';
import files, { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { FakeClock } from './fake-clock.ts';
import { tempProject, connectSocket } from './harness.ts';
import {onCleanup} from './process-cleanup.ts';
import { performance } from 'node:perf_hooks';
import { assertStartupReplies } from './startup-replies-fixture.ts';
import { parseItem } from '../src/tracker/item.ts';
import { join } from 'node:path';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import { withPlan } from '../src/tracker/plan.ts';

test('eight startup replies fit per-frame and total budgets on a thousand-item durable fixture', { timeout: 120000 }, async t => {
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
  const steps: Array<{ step: unknown; durationMs: unknown }> = [];
  const checkpoints: number[] = [];
  let recomputes = 0;
  const reads = new Map<string, number>();
  const itemsPath = join(root, '.cland/tasks') + '/';
  const countRead = (path: unknown) => {
    if (typeof path === 'string' && path.startsWith(itemsPath) && path.endsWith('-fixture.md')) {
      reads.set(path, (reads.get(path) ?? 0) + 1);
    }
  };
  const readFileSync = fs.readFileSync, readFile = files.readFile;
  t.mock.method(fs, 'readFileSync', (...args: Parameters<typeof fs.readFileSync>) => {
    countRead(args[0]); return readFileSync(...args);
  });
  t.mock.method(files, 'readFile', (...args: Parameters<typeof files.readFile>) => {
    countRead(args[0]); return readFile(...args);
  });
  syncBuiltinESMExports();
  onCleanup(t, () => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const cpuStarted = process.cpuUsage();
  const started = performance.now();
  const hub = await projectHub(t, root, {}, { clock: new FakeClock(),
    git: async args => args[0] === 'for-each-ref' ? `${'a'.repeat(40)} refs/heads/dev` : null,
    readBase: async () => 'dev',
    log: entry => {
      if (entry.event === 'verification-checkpoint') checkpoints.push(Number(entry.jobs));
      if (entry.event === 'explorer-recomputed') recomputes++;
      if (entry.event === 'hub-startup-step-completed') steps.push({ step: entry.step, durationMs: entry.durationMs });
    },
  });
  const ui = await connectUi(t, hub.discovery);
  const requests = [{type:'hub.status'}, {type:'rule.list',all:true}, {type:'topic.history',topic:'general',limit:200}, {type:'artifact.list'},
    {type:'task.list',projection:'summary',state:'open'}, {type:'events.list',limit:200}, {type:'session.list'}, {type:'account.list'}];
  let total = 0;
  for (const request of requests) {
    const reply = await ui.request(request);
    assert.equal(reply.ok, true, reply.error);
    if (request.type === 'hub.status') {
      const elapsed = performance.now() - started;
      const cpu = process.cpuUsage(cpuStarted);
      const cpuMs = (cpu.user + cpu.system) / 1000;
      t.diagnostic(`first completed hub.status: ${elapsed.toFixed(1)} ms wall; ${cpuMs.toFixed(1)} ms process CPU; hang guard 30000 ms wall; ${process.platform}/${process.arch}; embedded projectHub`);
      t.diagnostic(`startup steps (wall ms): ${JSON.stringify(steps)}`);
      const maxReads = Math.max(...reads.values());
      t.diagnostic(`startup work: ${checkpoints.length} checkpoints; ${checkpoints.reduce((a, b) => a + b, 0)} jobs visited; ${recomputes} explorer batches; ${reads.size} item files; ${[...reads.values()].reduce((a, b) => a + b, 0)} reads; max ${maxReads} reads/item`);
      assert.equal(checkpoints.length, 1, 'retained suite history is checkpointed once, independent of stopped sessions');
      assert.deepEqual(checkpoints, [1645], 'one checkpoint visits each retained suite once');
      assert.ok(recomputes > 0 && recomputes <= 4, `startup recomputed explorer ${recomputes} times; bound 4 batches`);
      assert.equal(reads.size, 1004, 'the complete durable tracker was read');
      assert.ok(maxReads <= 2, `startup read an item ${maxReads} times; bound 2 reads/item`);
      assert.ok(elapsed < 30000, `first hub.status took ${elapsed.toFixed(1)} ms; hang guard 30000 ms`); // lint-allow-wall-clock: gross hang guard through completed status; deterministic work counts enforce startup scaling.
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

// Reuse the established T3 scale seam; retain separate thousand-item scale cases.
test('eight startup replies and byte guards work on a pinned durable fixture', async t => {
  const root = await tempProject(t);
  await copyPinnedTracker(root);
  const rows = await Promise.all((await readdir(join(root, '.cland/tasks'))).filter(name => name.endsWith('.md')).map(async name => parseItem(await readFile(join(root, '.cland/tasks', name), 'utf8'), name)));
  assert.ok(rows.length > 12, 'copied tracker replaces the small synthetic fixture');
  await assertStartupReplies(t, root, 'pinned', rows.length, rows.filter(row => row.fm.state === 'open').length);
});
