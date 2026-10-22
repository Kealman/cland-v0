// T1: durable run projections through Store/HubCore, without sockets or native processes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/hub/store.ts';
import { HubCore } from '../src/hub/core.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject } from './harness.ts';

test('run identity survives reopen with recipient role boundaries preserved', async t => {
  const file = join(await tempProject(t), 'runs.sqlite');
  const clock = new FakeClock();
  let core = new HubCore({ store: new Store(file), clock });
  const record = (id: string, to = ['rev'], now = 1000) => core.store.record({ id, from: 'impl', fromKind: 'agent', fromRole: 'implementer', via: 'session', to, text: id, kind: 'report', topic: 'general', ts: clock.now().toISOString() }, [], now);
  try {
    core.store.rememberSession('helper', 1000);
    core.store.rememberRole('helper', 'aide');
    record('old-unrelated', ['rev'], 500); record('first'); record('aide-boundary', ['helper']); record('second', ['rev'], 2000);
    const original = core.topicHistoryPage('general');
    assert.equal(original.runs.length, 2);
    assert.equal(original.messages[2]!.runId, undefined);
    // A later role change must not reinterpret a recipient's role at the original send.
    core.store.rememberRole('helper', 'reviewer');
    core.close(); core.store.close();
    core = new HubCore({ store: new Store(file), clock });
    assert.deepEqual(core.topicHistoryPage('general'), original);
    core.store.prune(1001, 1); // Only the older unrelated message goes; the former-Aide boundary survives.
    const rebuilt = core.topicHistoryPage('general');
    assert.equal(rebuilt.messages.find(m => m.id === 'aide-boundary')!.runId, undefined);
    assert.equal(rebuilt.runs.length, 2);
    core.close(); core.store.close();
    core = new HubCore({ store: new Store(file), clock });
    assert.deepEqual(core.topicHistoryPage('general'), rebuilt);
    record('third', ['rev'], 2000);
    const extended = core.topicHistoryPage('general');
    assert.equal(extended.runs[1]!.id, original.runs[1]!.id);
    assert.equal(extended.runs[1]!.messageCount, 2);
    assert.throws(() => core.store.transaction(() => { record('rolled-back'); throw new Error('abort'); }), /abort/);
    assert.deepEqual(core.topicHistoryPage('general'), extended);
    core.store.prune(2001, 1);
    const retained = core.topicHistoryPage('general');
    assert.deepEqual(retained.messages.map(m => m.id), ['second', 'third']);
    assert.equal(retained.runs.length, 1);
    assert.equal(retained.runs[0]!.messageCount, 2);
  } finally { core.close(); core.store.close(); }
});

test('an older store lazily restores full runs across multiple backfill pages', async t => {
  const file = join(await tempProject(t), 'legacy.sqlite');
  const clock = new FakeClock();
  let core = new HubCore({ store: new Store(file), clock });
  const record = (id: string) => core.store.record({ id, from: 'impl', fromKind: 'agent', fromRole: 'implementer', via: 'session', to: ['rev'], text: id, topic: 'general', ts: clock.now().toISOString() }, [], 1000);
  try {
    core.store.transaction(() => { for (let i = 0; i < 405; i++) record(`legacy-${i}`); });
    const expected = core.topicHistoryPage('general', 1);
    assert.equal(expected.runs[0]!.messageCount, 405);
    core.close(); core.store.close();
    // A pre-extension database contains the messages, but none of the derived tables.
    const old = new DatabaseSync(file);
    try { old.exec('drop table thread_run_members; drop table thread_runs; update messages set run_eligible = null'); } finally { old.close(); }
    core = new HubCore({ store: new Store(file), clock });
    assert.deepEqual(core.topicHistoryPage('general', 1), expected);
    record('new-tail');
    const page = core.topicHistoryPage('general', 1);
    assert.equal(page.runs[0]!.id, expected.runs[0]!.id);
    assert.equal(page.runs[0]!.firstSeq, expected.runs[0]!.firstSeq);
    assert.equal(page.runs[0]!.messageCount, 406);
    assert.equal(page.messages[0]!.runId, expected.runs[0]!.id);
  } finally { core.close(); core.store.close(); }
});

test('history byte pages include run metadata without gaps', () => {
  const clock = new FakeClock();
  const core = new HubCore({ clock });
  try {
    core.store.transaction(() => {
      for (let i = 0; i < 120; i++) core.store.record({ id: `bytes-${i}`, from: 'impl', fromKind: 'agent', fromRole: 'implementer', via: 'session', to: ['rev'],
        text: `${i} ` + 'Complete 🐈 message. '.repeat(180), topic: 'general', ts: clock.now().toISOString(),
        ...(i % 2 ? { answerTo: `bytes-${i - 1}` } : {}) }, [], 1000);
    });
    for (const direction of ['before', 'after'] as const) {
      let cursor = direction === 'before' ? Number.MAX_SAFE_INTEGER : 0;
      let ids: string[] = [];
      let pages = 0;
      for (;;) {
        const page = core.topicHistoryPage('general', 200, { [direction]: cursor });
        assert.ok(Buffer.byteLength(JSON.stringify(page)) < 256 * 1024);
        if (!page.messages.length) break;
        pages++;
        assert.equal(page.runs.length, page.messages.filter(m => m.runId).length);
        assert.ok(page.runs.every(run => run.messageCount === 1));
        const next = page.messages.map(m => m.id);
        ids = direction === 'before' ? [...next, ...ids] : [...ids, ...next];
        cursor = direction === 'before' ? page.messages[0]!.seq : page.messages.at(-1)!.seq;
      }
      assert.ok(pages > 1);
      assert.deepEqual(ids, Array.from({ length: 120 }, (_, i) => `bytes-${i}`));
    }
  } finally { core.close(); core.store.close(); }
});
