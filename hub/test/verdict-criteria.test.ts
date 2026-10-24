// T2 component: tracker rules over real sockets and CLI with in-process hub/MCP peers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cland, connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';

// Persistence proofs close and reopen the hub/store in this process.
const hubs = new Map<string, Awaited<ReturnType<typeof projectHub>>>();
const openHub: typeof projectHub = async (...args) => {
  const hub = await projectHub(...args);
  hubs.set(args[1], hub);
  args[0].after(() => { if (hubs.get(args[1]) === hub) hubs.delete(args[1]); });
  return hub;
};
const stopHub = async (root: string) => { await hubs.get(root)!.stop(); };
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { taskWriteGate } from './tracker-write-gate.ts';
import type { ItemView } from '../src/tracker/tracker.ts';

test('a clear MCP verdict verifies selected legacy criteria with its run and reports the marks', async t => {
  const root = await tempProject(t);
  const { discovery } = await openHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const item = ((await ui.request({ size: 'M', type: 'task.create', title: 'Verdict criteria', body: '## Acceptance criteria\n- [ ] First\n- [ ] Second\n- [ ] Third\n\n## Notes\nKeep this.' })).value as { item: ItemView }).item;
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', role: 'reviewer' });
  t.after(() => rev.close());
  await rev.call('subscribe', { subject: { item: item.id }, events: ['task'] });
  const result = await rev.call<{ ok: boolean; item: ItemView }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'rev-1', verified: 'C1,C3', text: 'Checked first and third.' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.item.criteria.map(c => [c.id, c.checked, c.marks.map(m => m.kind)]), [['C1', false, ['verified']], ['C2', false, []], ['C3', false, ['verified']]]);
  for (const c of [result.item.criteria[0]!, result.item.criteria[2]!]) {
    assert.equal(c.marks[0]?.kind === 'verified' && c.marks[0].run, 'rev-1');
    assert.equal(c.marks[0]?.by, 'rev [reviewer]');
  }
  await ui.waitFor(f => f.type === 'message' && String((f.message as { text: string }).text).includes(`${item.id} criterion marked C1 verified`));
  assert.match(result.item.body, /## Notes\nKeep this\./);
  const frame = await ui.waitFor(f => f.type === 'message' && String((f.message as { text: string }).text).includes('rev-1') && (f.message as { kind: string }).kind === 'report');
  const message = frame.message as { text: string; criteria: unknown };
  assert.match(message.text, /C1.*C3/);
  assert.deepEqual(message.criteria, [{ id: 'C1', mark: 'verified' }, { id: 'C3', mark: 'verified' }]);
  const cli = await cland(root, 'task', 'comment', item.id, 'All checked', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'rev-all', '--verified', 'all', '--as', 'rev', '--json');
  assert.equal(cli.code, 0, cli.stderr);
  const all = (JSON.parse(cli.stdout) as { item: ItemView }).item;
  assert.equal(all.criteria.length, 3);
  for (const c of all.criteria) {
    const mark = c.marks.at(-1)!;
    assert.equal(mark.kind, 'verified');
    assert.equal(mark.kind === 'verified' && mark.run, 'rev-all');
    assert.equal(mark.by, 'rev [reviewer]');
  }
});

test('not-clear QA verdicts fail criteria with notes, reopen and persist the report in the item topic', async t => {
  const root = await tempProject(t);
  const { discovery } = await openHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const item = ((await ui.request({ size: 'M', type: 'task.create', title: 'QA failures', body: '## Acceptance criteria\n- [ ] First\n- [ ] Second' })).value as { item: ItemView }).item;
  const topic = ((await ui.request({ type: 'topic.create', item: item.id, title: 'QA criteria' })).value as { topic: { id: string } }).topic;
  const qa = await inProcessSpoke(t, { discover: true, cwd: root, name: 'qa-1', role: 'qa' });
  t.after(() => qa.close());
  for (const criterion of ['C1', 'C2']) await ui.request({ type: 'task.criterion', item: item.id, op: 'done', criterion });
  const passed = await qa.call<{ ok: boolean; error?: string }>('task.comment', { id: item.id, verdict: 'qa', result: 'clear', run: 'qa-pass', verified: 'all' });
  assert.equal(passed.ok, true, passed.error);
  await ui.request({ type: 'task.close', item: item.id });
  const failed = await qa.call<{ ok: boolean; item: ItemView }>('task.comment', { id: item.id, verdict: 'qa', result: 'not clear', run: 'qa-fail', failed: [{ criterion: 'C2', note: 'Reconnect drops the clause', op: 'remove' }] });
  assert.equal(failed.ok, true);
  assert.equal(failed.item.state, 'open');
  assert.equal(failed.item.status, 'in progress');
  assert.deepEqual(failed.item.criteria[0]?.marks.map(m => m.kind), ['done', 'verified']);
  assert.equal(failed.item.criteria[1]?.checked, false);
  assert.deepEqual(failed.item.criteria[1]?.marks.map(m => [m.kind, m.by, m.kind === 'failed' && m.note]), [['failed', 'qa-1 [qa]', 'Reconnect drops the clause']]);
  const message = (await ui.waitFor(f => f.type === 'message' && (f.message as { kind: string; text: string }).kind === 'report' && (f.message as { text: string }).text.includes('qa-fail'))).message as { topic: string; criteria: unknown };
  assert.equal(message.topic, topic.id);
  assert.deepEqual(message.criteria, [{ id: 'C2', mark: 'failed', note: 'Reconnect drops the clause' }]);
  const cli = await cland(root, 'task', 'comment', item.id, 'Both fail', '--verdict', 'qa', '--result', 'not clear', '--run', 'qa-cli', '--failed', 'C1=First broken', '--failed', 'C2=Second broken = still broken', '--as', 'qa-1', '--json');
  assert.equal(cli.code, 0, cli.stderr);
  const marked = (JSON.parse(cli.stdout) as { item: ItemView }).item;
  assert.deepEqual(marked.criteria.map(c => c.marks[0]?.kind === 'failed' && c.marks[0].note), ['First broken', 'Second broken = still broken']);
  const read = async () => ((await ui.request({ type: 'topic.history', topic: topic.id })).value as { messages: { criteria?: unknown; text: string }[] }).messages;
  assert.deepEqual((await read()).find(m => m.text.includes('qa-fail'))?.criteria, message.criteria);
  await qa.close();
  await stopHub(root);
  const restarted = await openHub(t, root);
  const nextUi = await connectUi(t, restarted.discovery);
  const history = ((await nextUi.request({ type: 'topic.history', topic: topic.id })).value as { messages: { criteria?: unknown; text: string }[] }).messages;
  assert.deepEqual(history.find(m => m.text.includes('qa-fail'))?.criteria, message.criteria);
});

test('invalid or unauthorized criterion selections refuse the whole verdict without changing its source', async t => {
  const root = await tempProject(t);
  const { discovery } = await openHub(t, root);
  const ui = await connectUi(t, discovery);
  const item = ((await ui.request({ size: 'M', type: 'task.create', title: 'Refused verdict', body: '## Acceptance criteria\n- [ ] First\n- [ ] Second' })).value as { item: ItemView }).item;
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', role: 'reviewer' });
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => rev.close()); t.after(() => coord.close());
  const source = await readFile(join(root, item.path), 'utf8');
  for (const [extra, error] of [
    [{ verified: 'C1,C99' }, /C99/],
    [{ verified: '' }, /verified must/],
    [{ verified: 'C1', result: 'not clear' }, /requires a clear verdict/],
    [{ failed: [{ criterion: 'C1', note: 'Broken' }] }, /requires a not-clear verdict/],
    [{ result: 'not clear', failed: [{ criterion: 'C1', note: 'Broken' }, { criterion: 'C99', note: 'Missing' }] }, /C99/],
    [{ result: 'not clear', failed: [{ criterion: 'C1', note: ' ' }] }, /needs a note/],
    [{ result: 'not clear', failed: [{ criterion: 'C1', note: 'First\nSecond' }] }, /needs a note/],
    [{ run: 'two words', verified: 'all' }, /run id/],
  ] as const) {
    const result = await rev.call<{ ok: boolean; error: string }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'refused', ...extra });
    assert.equal(result.ok, false, JSON.stringify(extra));
    assert.match(result.error, error);
    assert.equal(await readFile(join(root, item.path), 'utf8'), source);
  }
  const refused = await coord.call<{ ok: boolean; error: string }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'coord-1', verified: 'all' });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /require Reviewer or QA/);
  assert.equal(await readFile(join(root, item.path), 'utf8'), source);
  const human = await cland(root, 'task', 'comment', item.id, 'Human verdict', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'human-1', '--verified', 'all');
  assert.notEqual(human.code, 0);
  assert.match(human.stderr, /require Reviewer or QA/);
  const plain = await cland(root, 'task', 'comment', item.id, 'plain', '--verified', 'all');
  assert.notEqual(plain.code, 0);
  assert.match(plain.stderr, /a verdict needs/);
  assert.equal(await readFile(join(root, item.path), 'utf8'), source);
});

test('a hand save or revoked criterion grant refuses verdict and marks together', async t => {
  const root = await tempProject(t);
  const gate = await taskWriteGate(t, root);
  const { discovery } = await openHub(t, root, gate.env);
  const ui = await connectUi(t, discovery);
  const item = ((await ui.request({ size: 'M', type: 'task.create', title: 'Concurrent verdict', body: '## Acceptance criteria\n- [ ] First\n\n## Notes\nOriginal.' })).value as { item: ItemView }).item;
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', role: 'reviewer' });
  t.after(() => rev.close());
  const path = join(root, item.path);
  await gate.arm();
  const writing = rev.call<{ ok: boolean; error: string }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'raced', verified: 'all' });
  await gate.entered();
  const edited = (await readFile(path, 'utf8')).replace('Original.', 'Hand saved.');
  await writeFile(path, edited);
  await gate.release();
  const raced = await writing;
  assert.equal(raced.ok, false);
  assert.match(raced.error, /concurrent hand edit/);
  assert.equal(await readFile(path, 'utf8'), edited);
  await gate.arm();
  const revoked = rev.call<{ ok: boolean; code: string }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'revoked', verified: 'all' });
  await gate.entered();
  const roles = join(root, '.cland', 'roles.toml');
  const roleText = await readFile(roles, 'utf8');
  const reviewer = roleText.indexOf('[reviewer.permissions]');
  await writeFile(roles, roleText.slice(0, reviewer) + roleText.slice(reviewer).replace('"task.criterion:verify", ', ''));
  await eventually('criterion grant reloaded', async () => {
    const log = await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
    return log.split('\n').filter(line => line.includes('\"event\":\"roles-loaded\"')).length >= 2 ? true : undefined;
  });
  await gate.release();
  const result = await revoked;
  assert.equal(result.ok, false);
  assert.equal(result.code, 'forbidden');
  assert.equal(await readFile(path, 'utf8'), edited);
});
