// T2: real CLI and MCP frames close during gated inspection; no worker or native process runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectSocket, connectUi, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { Suites } from '../src/hub/suites.ts';
import type { HubStatus, Message } from '../src/protocol.ts';
import { Store } from '../src/hub/store.ts';
import { HubCore } from '../src/hub/core.ts';
import { replayAgentsRecord } from '../src/hub/agents-topic.ts';

for (const [transport, change] of [['cli', 'none'], ['mcp', 'none'], ['mcp', 'role'], ['mcp', 'claim'], ['mcp', 'candidate'], ['mcp', 'reserved']] as const) test(`${transport} admission records its outcome after mid-inspection close (${change})`, async t => {
  const root = await tempProject(t), clock = new FakeClock();
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ntest="true"\n');
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>(), completed = Promise.withResolvers<void>();
  const start = Suites.prototype.start;
  // Observe admission completion before asking for its durable outcome; retain the real implementation.
  t.mock.method(Suites.prototype, 'start', function (this: Suites, ...args: Parameters<Suites['start']>) {
    const work = start.apply(this, args);
    void work.then(() => completed.resolve(), () => completed.resolve());
    return work;
  });
  t.after(() => release.resolve());
  const hub = await projectHub(t, root, {}, { clock, durationContext: null,
    compatibility: { occupied: async () => true, holder: async () => null },
    selectSuite: async () => {
      assert.equal(change, 'reserved');
      entered.resolve(); await release.promise; completed.resolve();
      return { mode: 'hub-only', files: ['hub/src/example.ts'], reason: 'fixture' };
    },
    log: entry => { if (entry.event === 'audit' && entry.tool === 'suite.start' && entry.error === 'the connection closed before the answer') closed.resolve(); },
    candidate: { head: async () => 'a'.repeat(40), tree: async () => 'b'.repeat(40), inspect: async () => {
      entered.resolve(); await release.promise;
      if (change === 'candidate') throw new Error('candidate inspection refused');
      return { head: 'a'.repeat(40), branch: 'candidate', tree: 'b'.repeat(40), selection: { mode: 'hub-only', files: ['hub/src/example.ts'], reason: 'fixture' }, tierPlan: [], budgetBase: undefined };
    } },
  });
  const ui = await connectUi(t, hub.discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const spoke = await connectSocket(hub.discovery.socket); t.after(() => spoke.close());
  spoke.send({ type: 'hello', protocol: 2, secret: hub.discovery.secret, sessionId: 'submitter', name: 'impl', cwd: root });
  assert.equal((await spoke.next()).type, 'welcome');
  const made = await ui.request({ type: 'task.create', title: 'Admission close', size: 'S', branch: 'candidate', assignee: 'impl' });
  const item = (made.value as { item: { id: string } }).item.id;
  const claimed = await ui.request({ type: 'task.claim', item, as: { name: 'impl', sessionId: 'submitter', shell: true } });
  assert.equal(claimed.ok, true, JSON.stringify(claimed));
  const topic = ((await ui.request({ type: 'topic.create', title: 'Admission', item })).value as { topic: { id: string } }).topic.id;
  if (change === 'reserved') {
    const unrelated = ((await ui.request({ type: 'topic.create', title: 'Unrelated' })).value as { topic: { id: string } }).topic.id;
    const denied = await ui.request({ type: 'suite.start', mode: 'all', cwd: root, report: unrelated,
      as: { name: 'impl', sessionId: 'submitter', shell: true } });
    assert.equal(denied.ok, false);
    const history = (await ui.request({ type: 'topic.history', topic: unrelated })).value as { messages: Message[] };
    assert.equal(history.messages.length, 0, 'failed report authorization grants no publication authority');
  }
  const client = transport === 'cli' ? await connectSocket(hub.discovery.socket) : spoke;
  t.after(() => client.close());
  if (transport === 'cli') {
    client.send({ type: 'hello', protocol: 2, secret: hub.discovery.secret, client: 'cli' });
    assert.equal((await client.next()).type, 'welcome');
  }
  client.send({ type: 'suite.start', id: 'submission', mode: change === 'reserved' ? 'all' : 'auto', cwd: root, report: topic, to: ['reviewer'],
    ...(transport === 'cli' ? { as: { name: 'impl', sessionId: 'submitter', shell: true } } : {}) });
  await entered.promise;
  client.close(); await closed.promise;
  if (change === 'role') assert.equal((await ui.request({ type: 'role.clear', session: 'impl' })).ok, true);
  if (change === 'claim') {
    assert.equal((await ui.request({ type: 'task.claim', item, release: true, as: { name: 'impl', sessionId: 'submitter', shell: true } })).ok, true);
    assert.equal((await ui.request({ type: 'task.edit', item, assignee: null })).ok, true);
  }
  release.resolve(); await completed.promise;
  const status = (await ui.request({ type: 'hub.status', flushLogs: true })).value as HubStatus;
  const history = (await ui.request({ type: 'topic.history', topic })).value as { messages: Message[] };
  const receipt = history.messages.find(m => m.detail?.event === 'verification-submission');
  assert.ok(receipt, 'admission receipt must survive the submitting connection');
  const outcome = change === 'none' ? 'admitted' : 'refused';
  assert.match(receipt.text, new RegExp(outcome));
  assert.equal(receipt.from, 'hub');
  assert.equal(status.suites!.length, change === 'none' ? 1 : 0);
  if (change === 'role') assert.match(receipt.text, /forbidden/);
  if (change === 'claim') assert.match(receipt.text, /own item topic/);
  if (change === 'candidate') assert.match(receipt.text, /candidate inspection refused/);
  if (change === 'reserved') assert.match(receipt.text, /verify-all-reserved.*mode hub-only/);
  const journal = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(journal.some(e => e.event === 'audit' && e.error === 'the connection closed before the answer'));
  assert.equal(journal.filter(e => e.event === 'verification-submission' && e.request === 'submission' && e.outcome === outcome).length, 1);
  await hub.stop();
  const reopened = new Store(join(root, '.cland/hub.db'));
  try {
    assert.equal(reopened.topicMessages(topic, 50).filter(m => m.id === receipt.id).length, 1);
    if (transport === 'cli') {
      // A durable lifecycle tail whose projection was lost must still replay after a submission receipt.
      const restarted = new HubCore({ store: reopened, clock });
      try {
        const records = [...journal, { event: 'role-assigned', session: 'tail', role: 'implementer', agentsNotice: 'unprojected-tail' }];
        assert.equal(replayAgentsRecord(restarted, records), 1);
        assert.equal(replayAgentsRecord(restarted, records), 0, 'tail replays once');
      } finally { restarted.close(); }
    }
  }
  finally { reopened.close(); }
});
