// T3: full projectHub startup with 1,000 durable items, 8,163 artifacts and a comparable journal.
// Coordinator-approved scale exception (topic-785, 2026-10-21): startup dominates
// this C2 fixture beyond the T2 duration guard; cold startup performance belongs to T-1039.
// No native hub process is needed; the smaller byte-guard fixture stays T2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { FakeClock } from './fake-clock.ts';
import { tempProject } from './harness.ts';

test('eight startup replies fit per-frame and total budgets on a thousand-item durable fixture', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const { serializeItem } = await import('../src/tracker/item.ts');
  const { projectHub, connectUi } = await import('./harness.ts');
  const { join } = await import('node:path');
  const root = await tempProject(t), at = '2026-10-16T12:00:00.000Z';
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await Promise.all(Array.from({ length: 1000 }, (_, i) => writeFile(join(root, `.cland/tasks/T-${i + 1}-fixture.md`), serializeItem({
    fm: { id: `T-${i + 1}`, kind: 'task', size: 'S', title: `Startup item ${i + 1}`, state: i < 104 ? 'open' : 'closed',
      status: i < 104 ? 'planned' : 'done', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null, created: at, updated: at },
    body: '## Summary\n\nA realistic startup item.\n\n## Implementation\n\n' + 'Detailed item body stays on demand. '.repeat(50), comments: [],
  }))));
  const store = new Store(join(root, '.cland/hub.db'));
  store.createTopic('general', 'General', null, at);
  store.transaction(() => {
    for (let n = 0; n < 200; n++) store.record({ id: `m${n}`, from: 'human', fromKind: 'human', via: 'hub', to: [],
      text: `Message ${n}: ` + 'A complete General message. '.repeat(95), topic: 'general', ts: at }, [], Date.parse(at));
    for (let n = 1; n <= 8163; n++) store.registerArtifact(id => ({ id, kind: 'note', title: `Artifact ${n} with a realistic title for the startup list`, creator: 'human', creatorKind: 'human',
      time: at, topic: 'general', status: 'shared', path: join(root, `.cland/artifacts/${id}-startup-fixture.md`) }), () => {});
  });
  store.close();
  await writeFile(join(root, '.cland/journal.jsonl'), Array.from({length: 200}, (_, i) => JSON.stringify({ts: new Date(Date.parse(at) - (200-i)*61000).toISOString(),
    event: 'notification', kind: 'verdict', item: `T-${i+1}`, text: 'A completed source review receipt. '.repeat(5)}) + '\n').join(''));
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, hub.discovery);
  const requests = [{type:'hub.status'}, {type:'rule.list',all:true}, {type:'topic.history',topic:'general',limit:200}, {type:'artifact.list'},
    {type:'task.list',projection:'summary',state:'open'}, {type:'events.list',limit:200}, {type:'session.list'}, {type:'account.list'}];
  let total = 0;
  for (const request of requests) {
    const reply = await ui.request(request);
    assert.equal(reply.ok, true, reply.error);
    const bytes = Buffer.byteLength(JSON.stringify(reply) + '\n');
    assert.ok(bytes <= 256 * 1024, `${request.type}: ${bytes} bytes exceeds 256 kB`);
    total += bytes;
    if (request.type === 'task.list') assert.equal((reply.value as {items:unknown[]}).items.length, 104);
    if (request.type === 'artifact.list') assert.equal((reply.value as {artifacts:unknown[]}).artifacts.length, 100);
  }
  assert.ok(total <= 1024 * 1024, `${total} total startup bytes exceeds 1 MB`);
});
