// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cland, inProcessSpoke, projectHub, tempProject, type Session } from './harness.ts';
import { value } from './validation-support.ts';

type InboxAsk = { id: string; topic: { id: string; title: string; item?: string | null }; question: string; options: string[]; free: boolean; from: string; label: string };
type Inbox = { asks: InboxAsk[]; approvals: Array<{ session: string }>; waiting: Array<{ id: string; title: string }>; needsYou: number };
type AskResult = { ok: boolean; ask: string; topic: { id: string }; error?: string };

async function coordinator(t: import('node:test').TestContext, root: string): Promise<Session> {
  const s = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => s.close());
  await s.waitForPresence(['coord']);
  return s;
}

const ask = (s: Session, topic: string, question: string, options: string[], free?: boolean) =>
  s.call<AskResult>('ask', { topic, question, options, ...(free !== undefined ? { free } : {}) });

test('cland topic create binds an Implementer topic to its claimed item and refuses another item', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await value(ui, { type: 'task.create', size: 'XS', title: 'Mine', assignee: 'impl' });
  await value(ui, { type: 'task.create', size: 'XS', title: 'Another item' });
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', role: 'implementer', sessionId: 'sess-impl' });
  t.after(() => impl.close());
  await impl.waitForPresence(['impl']);
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: 'T-1' })).ok, true);
  const shell = { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'sess-impl' };

  const created = await clandWithEnv(root, shell, 'topic', 'create', 'My work', '--item', 'T-1', '--json');
  assert.equal(created.code, 0, created.stderr);
  const { topic } = JSON.parse(created.stdout) as { topic: { id: string; title: string; item: string } };
  assert.equal(topic.title, 'My work');
  assert.equal(topic.item, 'T-1');
  const bound = await value<{ item: { topic: string } }>(ui, { type: 'task.view', item: 'T-1' });
  assert.equal(bound.item.topic, topic.id);

  const refused = await clandWithEnv(root, shell, 'topic', 'create', 'Other work', '--item', 'T-2');
  assert.equal(refused.code, 1);
  assert.equal(refused.stdout, '');
  assert.match(refused.stderr, /forbidden: topic\.create \(Implementer may create a topic only bound to its own item\)/);
  const other = await value<{ item: { topic: string | null } }>(ui, { type: 'task.view', item: 'T-2' });
  assert.equal(other.item.topic, null);
  const listed = await value<{ topics: Array<{ id: string }> }>(ui, { type: 'topic.list' });
  assert.deepEqual(listed.topics.map(t => t.id), ['general', 'agents', topic.id]);
});

test('cland topic create opens an unbound human topic and rejects malformed arguments', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const created = await cland(root, 'topic', 'create', 'Design discussion');
  assert.equal(created.code, 0, created.stderr);
  const { topics } = await value<{ topics: Array<{ id: string; title: string; item: string | null }> }>(ui, { type: 'topic.list' });
  const topic = topics.find(t => t.title === 'Design discussion');
  assert.ok(topic);
  assert.equal(topic.item, null);
  assert.equal(created.stdout, `created ${topic.id}: Design discussion\n`);
  for (const args of [[], [' '], ['extra', 'title'], ['Title', '--item']]) {
    const bad = await cland(root, 'topic', 'create', ...args);
    assert.equal(bad.code, 1);
    assert.equal(bad.stdout, '');
  }
  assert.equal((await value<{ topics: unknown[] }>(ui, { type: 'topic.list' })).topics.length, 3);
});

test('cland inbox lists an open ask with its section, id, topic, asker, first line and age, and needs you; --json prints the hub\'s Inbox', async (t) => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const coord = await coordinator(t, root);
  const asked = await ask(coord, 'general', 'Which port?', ['a fixed one', 'a free one, picked at start']);
  assert.equal(asked.ok, true, JSON.stringify(asked));

  const listed = await cland(root, 'inbox');
  assert.equal(listed.code, 0, listed.stderr);
  assert.match(listed.stdout, /^Asks and approvals \(1\)\n/);
  assert.ok(listed.stdout.includes(`ask ${asked.ask}  General  Which port?  from coord [Coordinator]  · 0 m`), listed.stdout);
  assert.doesNotMatch(listed.stdout, /a fixed one|a free one, picked at start/);
  assert.match(listed.stdout, /needs you: 1\n$/);

  const json = await cland(root, 'inbox', '--json');
  assert.equal(json.code, 0, json.stderr);
  const parsed = JSON.parse(json.stdout) as Inbox;
  const a = parsed.asks[0] as InboxAsk;
  assert.deepEqual([a.id, a.topic.id, a.topic.title, a.topic.item ?? null, a.question, a.options, a.free, a.from, a.label], [
    asked.ask,
    'general',
    'General',
    null,
    'Which port?',
    ['a fixed one', 'a free one, picked at start'],
    true,
    'coord',
    'coord [Coordinator]',
  ]);
  assert.equal(parsed.needsYou, 1);
});

test('cland topic answer <ask> 2 answers with option 2, prints the confirmation, the Coordinator\'s spoke receives answer_to, and the ask leaves the inbox', async (t) => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const coord = await coordinator(t, root);
  const asked = await ask(coord, 'general', 'Which port?', ['a fixed one', 'a free one, picked at start']);
  assert.equal(asked.ok, true, JSON.stringify(asked));

  const answered = await cland(root, 'topic', 'answer', asked.ask, '2');
  assert.equal(answered.code, 0, answered.stderr);
  assert.equal(answered.stdout, `answered ${asked.ask} in General: a free one, picked at start\n`);
  await coord.waitForEvent((e) => e.params.content === 'a free one, picked at start' && e.params.meta?.answer_to === asked.ask);

  const after = await cland(root, 'inbox');
  assert.equal(after.code, 0, after.stderr);
  assert.doesNotMatch(after.stdout, new RegExp(`ask ${asked.ask}`));
  assert.match(after.stdout, /needs you: 0\n$/);
});

test('cland topic answer --text sends a free answer; refused answers print cland: <error> and exit 1', async (t) => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const coord = await coordinator(t, root);
  const free = await ask(coord, 'general', 'Second, in your words?', []);
  const strict = await ask(coord, 'general', 'Pick one', ['left', 'right'], false);
  const options = await ask(coord, 'general', 'Log level?', ['info', 'debug']);
  for (const q of [free, strict, options]) assert.equal(q.ok, true, JSON.stringify(q));

  const answered = await cland(root, 'topic', 'answer', free.ask, '--text', 'keep both, behind a flag');
  assert.equal(answered.code, 0, answered.stderr);
  assert.equal(answered.stdout, `answered ${free.ask} in General: keep both, behind a flag\n`);
  await coord.waitForEvent((e) => e.params.content === 'keep both, behind a flag' && e.params.meta?.answer_to === free.ask);

  // a free answer to an options-only ask is refused
  const refused = await cland(root, 'topic', 'answer', strict.ask, '--text', 'neither');
  assert.equal(refused.code, 1);
  assert.equal(refused.stderr, 'cland: this ask takes one of its options (1-2), not a free answer\n');
  // an option out of range is refused
  const out = await cland(root, 'topic', 'answer', options.ask, '3');
  assert.equal(out.code, 1);
  assert.equal(out.stderr, 'cland: option 3 is not one of 1-2\n');
  // 0 and negatives are integers too: the hub's refusal, not the CLI's
  const zero = await cland(root, 'topic', 'answer', options.ask, '0');
  assert.equal(zero.code, 1);
  assert.equal(zero.stderr, 'cland: option 0 is not one of 1-2\n');
  // an ask that is no longer open takes no answer any more
  const again = await cland(root, 'topic', 'answer', free.ask, '1');
  assert.equal(again.code, 1);
  assert.equal(again.stderr, 'cland: the ask is answered: "Second, in your words?" takes no answer any more\n');
  // an unknown ask
  const nope = await cland(root, 'topic', 'answer', 'nope', '1');
  assert.equal(nope.code, 1);
  assert.equal(nope.stderr, 'cland: no ask "nope"\n');

  // malformed calls are the CLI's own errors, exit 1 like the hub's refusals
  for (const bad of [['topic', 'answer'], ['topic', 'answer', free.ask], ['topic', 'answer', strict.ask, 'oops'], ['topic', 'answer', strict.ask, '1', '--text', 'and an option']]) {
    const r = await cland(root, ...bad);
    assert.equal(r.code, 1, bad.join(' '));
    assert.match(r.stderr, /cland topic answer/);
  }
});

test('cland inbox and cland topic answer without a hub print the note and exit 1', async (t) => {
  const root = await tempProject(t);
  const listed = await cland(root, 'inbox');
  assert.equal(listed.code, 1);
  assert.equal(listed.stderr, 'cland: no hub runs for this project — run `cland hub start`\n');
  const answered = await cland(root, 'topic', 'answer', 'some-ask', '1');
  assert.equal(answered.code, 1);
  assert.equal(answered.stderr, 'cland: no hub runs for this project — run `cland hub start`\n');
});
