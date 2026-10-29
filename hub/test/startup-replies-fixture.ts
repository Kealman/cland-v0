// Public-frame byte assertions shared by the synthetic T2 and full copied-tracker T3 fixtures.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { FakeClock } from './fake-clock.ts';
import { projectHub, connectUi } from './harness.ts';
import { enforceStartupBudget } from '../../test-support/startup-budget.ts';

export async function assertStartupReplies(t: TestContext, root: string, source: string, totalItems: number, open: number): Promise<void> {
  const at = '2026-10-16T12:00:00.000Z';
  const store = new Store(join(root, '.cland/hub.db'));
  store.createTopic('general', 'General', null, at);
  store.transaction(() => {
    for (let n = 0; n < 4; n++) store.record({ id: `m${n}`, from: 'human', fromKind: 'human', via: 'hub', to: [],
      text: `Message ${n}: ` + 'A complete General message. '.repeat(95), topic: 'general', ts: at }, [], Date.parse(at));
    for (let n = 1; n <= 5; n++) store.registerArtifact(id => ({ id, kind: 'note', title: `Artifact ${n} with a realistic title for the startup list`, creator: 'human', creatorKind: 'human',
      time: at, topic: 'general', status: 'shared', path: join(root, `.cland/artifacts/${id}-startup-fixture.md`) }), () => {});
  });
  store.close();
  await writeFile(join(root, '.cland/journal.jsonl'), Array.from({length: 4}, (_, i) => JSON.stringify({ts: new Date(Date.parse(at) - (4-i)*61000).toISOString(),
    event: 'notification', kind: 'verdict', item: `T-${i+1}`, text: 'A completed source review receipt. '.repeat(5)}) + '\n').join(''));
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, hub.discovery);
  const requests = [{type:'hub.status'}, {type:'rule.list',all:true}, {type:'topic.history',topic:'general',limit:200}, {type:'artifact.list'},
    {type:'task.list',projection:'summary',state:'open',paged:true}, {type:'events.list',limit:200}, {type:'session.list'}, {type:'account.list'}];
  let total = 0;
  const replies: Record<string, number> = {};
  for (const request of requests) {
    const reply = await ui.request(request);
    assert.equal(reply.ok, true, reply.error);
    const bytes = Buffer.byteLength(JSON.stringify(reply) + '\n');
    assert.ok(bytes <= 256 * 1024, `${request.type}: ${bytes} bytes exceeds 256 kB`);
    total += bytes;
    replies[request.type] = bytes;
    if (request.type === 'task.list') {
      const ids: string[] = [];
      let page = reply.value as {items:Array<{id:string}>;next:string|null;total:number};
      if (source === '5000 open') {
        assert.ok(page.items.length < 100, 'encoded byte budget binds before the row limit');
        assert.ok(page.next, 'large tracker crosses pages');
      }
      let pages = 0;
      for (;;) {
        ids.push(...page.items.map(row=>row.id)); pages++;
        assert.equal(page.total,open);
        if (!page.next) break;
        const next = await ui.request({...request,cursor:page.next});
        assert.equal(next.ok,true,next.error);
        assert.ok(Buffer.byteLength(JSON.stringify(next)+'\n')<=131072);
        page = next.value as typeof page;
        assert.ok(pages<=totalItems,'bounded traversal');
      }
      assert.equal(ids.length,open);
      assert.equal(new Set(ids).size,open,'one row per identity across pages');
      t.diagnostic(`${source}: ${pages} task.list pages; first ${bytes} framed bytes`);
    }
    if (request.type === 'artifact.list') assert.equal((reply.value as {artifacts:unknown[]}).artifacts.length, 5);
  }
  assert.ok(total <= 1024 * 1024, `${total} total startup bytes exceeds 1 MB`);
  // The smoke's actual guard consumes the eight public reply byte receipts.
  // Timing is proved by the rendered Neovim T3 test, not this protocol fixture.
  t.diagnostic(`${source}: ${totalItems} items, ${open} open; framed UTF-8 reply bytes ${JSON.stringify(replies)}; total ${total}`);
  const sample = { startupMs: 0, payloadBytes: replies['task.list']!, total: totalItems, open, replies };
  enforceStartupBudget(sample);
  const oversized = Buffer.byteLength(JSON.stringify({ type: 'result', id: 'fault', ok: true, value: { padding: '🐈'.repeat(70_000) } }) + '\n');
  assert.throws(() => enforceStartupBudget({ ...sample, replies: { ...replies, 'rule.list': oversized } }), /startup reply budget: rule.list/);
  const fullPages = Object.fromEntries(requests.map(request => [request.type, request.type === 'task.list' ? replies[request.type]! : 160 * 1024]));
  assert.throws(() => enforceStartupBudget({ ...sample, replies: fullPages }), /startup total payload budget/);
}
