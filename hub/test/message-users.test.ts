// T2: human message attribution through project frame, persisted Store and unchanged spoke delivery seams.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, tempProject, dispatcherUi, inProcessSpoke, flushProjectLogs } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import type { TopicMessage } from '../src/protocol.ts';

test('users own stored messages, history and coordinator envelopes; legacy single messages follow the first user', async t => {
  const root = await tempProject(t);
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { log: entry => logs.push(entry) });
  const local = await dispatcherUi(t, hub.dispatcher, root);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const send = async (client: typeof local, text: string) => {
    const receipt = coord.waitForEvent(e => e.params.content === text);
    const result = await client.request({ type: 'topic.send', topic: 'general', text, userId: 'forged' });
    assert.equal(result.ok, true, result.error);
    return { message: (result.value as { message: TopicMessage }).message, delivery: await receipt };
  };
  const legacy = await send(local, 'single before switch');
  assert.equal(legacy.message.from, 'human');
  assert.equal(legacy.message.userId, undefined);
  assert.equal(logs.find(e => e.event === 'human-send' && e.id === legacy.message.id)?.userId, undefined);
  const path = join(root, '.cland/hub.db');
  const db = new DatabaseSync(path);
  try {
    db.prepare('insert into users values (?,?,?,?,?,?)').run('jane-id', 'jane', 'Jane', 'admin', 'active', 1);
    db.prepare('insert into users values (?,?,?,?,?,?)').run('alex-id', 'alex', 'Alex', 'admin', 'active', 2);
    db.prepare("insert into auth_state values (1,'users',?) on conflict(singleton) do update set mode='users'").run(Date.now());
  } finally { db.close(); }
  const jane = await send(local, 'Jane private message text');
  const store = new Store(path);
  t.after(() => store.close());
  const alexUser = store.users.get('alex-id')!;
  const web = await dispatcherUi(t, { open: (peer, transport) => hub.dispatcher.open(peer, { ...transport, edge: 'web', user: () => alexUser }) }, root);
  const alex = await send(web, 'Alex private message text');
  await flushProjectLogs(t, root);
  const journalRows = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
  for (const [sent, name, id] of [[jane, 'jane', 'jane-id'], [alex, 'alex', 'alex-id']] as const) {
    assert.equal(sent.message.from, name);
    assert.equal(sent.message.fromKind, 'human');
    assert.equal(sent.message.userId, id);
    assert.equal(store.message(sent.message.id)?.userId, id);
    assert.equal(store.message(sent.message.id)?.from, name);
    assert.equal(sent.delivery.params.meta?.from, name);
    assert.equal(sent.delivery.params.meta?.from_kind, 'human');
    const journal = journalRows.find(e => e.event === 'human-send' && e.id === sent.message.id)!;
    assert.equal(journal.userId, id);
    assert.ok(!JSON.stringify(journal).includes(sent.message.text));
  }
  const history = await web.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  const messages = (history.value as { messages: TopicMessage[] }).messages;
  assert.deepEqual([legacy, jane, alex].map(sent => messages.find(m => m.id === sent.message.id)?.from), ['jane', 'jane', 'alex']);
  assert.equal(store.message(legacy.message.id)?.userId, 'jane-id');
});
