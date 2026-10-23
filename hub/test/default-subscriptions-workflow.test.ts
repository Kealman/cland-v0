// T3: native Git worktree lifecycle and committed-head review/QA provenance drive the ready event.
import { completeJournalLines } from './journal-lines.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import type { Message } from '../src/protocol.ts';
import { connectUi, eventually, nativeProjectHub as projectHub, spawnSpoke, tempProject } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';

for (const restart of [false, true]) test(`the item lead runs not-clear, re-review and QA; only ready starts the Coordinator (${restart ? 'after restart' : 'connected'})`, async t => {
  const root = await tempProject(t);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { env: fixtureEnvironment(cwd, process.env), cwd, encoding: 'utf8' }).trim();
  await copyPreparedProject(root);
  let served = await projectHub(t, root);
  let { discovery } = served;
  let ui = await connectUi(t, discovery);
  let coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  const qa = await spawnSpoke({ cwd: root, discover: true, name: 'qa-one', role: 'qa', sessionId: 'qa-id' });
  t.after(async () => { await Promise.all([coord, impl, rev, qa].map(s => s.close())); });
  await coord.waitForPresence(['coord', 'impl', 'rev', 'qa-one']);
  const { item: epic } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Loop plan', kind: 'epic' });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Own loop', assignee: 'impl', parent: epic.id });
  await coord.call('task.plan', { id: epic.id, op: 'set', yaml: `stages:\n- name: Loop\n  qa: {scope: affected, when: per-item}\n  lanes: [[${item.id}]]\n` });
  const plannedText = `event · task · ${item.id} status changed backlog → planned`;
  const plannedEvent = await eventually('planned setup event recorded for Coordinator', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Message[] }).messages.find(m => m.kind === 'event' && m.to.includes('coord') && m.text === plannedText);
  });
  assert.equal(plannedEvent.detail?.digest, 'turn', 'planning waits for the Coordinator next turn');
  const claimed = await impl.call<{ ok: boolean; worktree: { path: string } }>('task.claim', { id: item.id });
  assert.equal(claimed.ok, true);
  const work = claimed.worktree.path;
  await writeFile(join(work, 'feature'), 'first\n');
  git(work, 'add', 'feature');
  git(work, 'commit', '-qm', 'First pass');
  const request = async (who: typeof rev, role: string, text: string) => {
    const sent = await impl.call<{ ok: boolean }>('send', { to: [role], kind: 'report', text });
    assert.equal(sent.ok, true);
    await who.waitForEvent(e => e.params.content.includes(text));
  };
  await impl.call('task.edit', { id: item.id, status: 'review' });
  await request(rev, 'reviewer', `review request ${item.id} first pass`);
  await rev.call('task.hold', { id: item.id });
  await rev.call('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'not clear', run: 'loop-first' });
  await rev.call('send', { to: [`lead ${item.id}`], kind: 'report', text: `review not clear ${item.id}` });
  const finding = await impl.waitForEvent(e => e.params.content.includes(`review not clear ${item.id}`));
  assert.match(finding.params.content, /verdict posted review not clear/);
  assert.equal(coord.events.some(e => e.params.content.includes(`event · task · ${item.id}`)), false);
  await writeFile(join(work, 'feature'), 'fixed\n');
  git(work, 'add', 'feature');
  git(work, 'commit', '-qm', 'Fix findings');
  await request(rev, 'reviewer', `review request ${item.id} fixed pass`);
  await rev.call('task.hold', { id: item.id });
  await rev.call('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'loop-fixed' });
  await rev.call('send', { to: [`lead ${item.id}`], text: `review clear ${item.id}` });
  await impl.waitForEvent(e => e.params.content.includes(`review clear ${item.id}`));
  await request(qa, 'qa', `qa request ${item.id} qa/briefs/${item.id}.md`);
  await qa.call('task.hold', { id: item.id });
  const before = await coord.call<{ item: { status: string } }>('task.view', { id: item.id });
  assert.notEqual(before.item.status, 'ready');
  if (restart) await coord.close();
  await qa.call('task.comment', { id: item.id, verdict: 'qa', result: 'clear', run: 'loop-qa' });
  const readyText = `event · task · ${item.id} status changed qa → ready`;
  const readyHistory = async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event' && m.to.includes('coord') && m.text.includes(`task · ${item.id}`) && m.id !== plannedEvent.id);
  };
  await eventually('one ready event recorded for Coordinator', async () => (await readyHistory()).some(m => m.text === readyText) ? true : undefined);
  if (restart) {
    ui.close();
    await served.stop();
    served = await projectHub(t, root);
    ({ discovery } = served);
    ui = await connectUi(t, discovery);
    coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  }
  const ready = await coord.waitForEvent(e => e.params.content.includes(readyText));
  assert.equal(ready.params.meta?.kind, 'event', 'ready itself starts a turn without a relay message');
  const deliveries = await readyHistory();
  assert.equal(deliveries.length, 1, JSON.stringify(deliveries));
  assert.equal(deliveries[0]?.detail?.digest, 'now');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = completeJournalLines(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line));
  assert.equal(journal.filter(e => e.event === 'event-delivery' && e.id === plannedEvent.id && e.to?.includes('coord') && e.digest === 'turn').length, 1, 'the setup planned event is accounted for separately');
  assert.equal(journal.filter(e => e.event === 'event-delivery' && e.subject?.item === item.id && e.to?.includes('coord') && e.id !== plannedEvent.id).length, 1);
  await eventually('ready acknowledgement recorded', async () => {
    await ui.request({ type: 'hub.status', flushLogs: true });
    const records = completeJournalLines(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line));
    return records.some(e => e.event === 'acked' && e.id === deliveries[0]?.id) || undefined;
  });
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const settled = completeJournalLines(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line));
  assert.equal(settled.filter(e => e.event === 'event-delivery' && e.subject?.item === item.id && e.to?.includes('coord') && e.id !== plannedEvent.id).length, 1, 'still one ready delivery after settling');
});
