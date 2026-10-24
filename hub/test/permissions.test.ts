// T2: dispatcher permission tables; MCP/socket proofs retain real edges and in-process spokes.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { cland, clandWithEnv, connectUi, dispatcherUi, eventually, inProcessSpoke, projectHub, tempProject, waitForAbsence, type Discovery, type FrameClient, type Session } from './harness.ts';
import { value, dispatcherSpoke } from './validation-support.ts';
import { DEFAULT_PERMISSIONS } from '../src/roles/permissions.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { parseRoles } from '../src/roles/config.ts';

type Audit = { ts: string; event: 'audit'; session: string; sessionId: string | null; role: string | null; tool: string; args: Record<string, unknown>; outcome: string; permission?: string; reason?: string; error?: string; client?: string };
type ToolResult = { ok: boolean; error?: string; code?: string; permission?: string; role?: string | null; reason?: string };

// Observe the logger boundary once, rather than flushing and rereading hub.log per row.
const auditRows = new Map<string, Audit[]>();
const audits = async (root: string): Promise<Audit[]> => auditRows.get(root) ?? [];

const ok = (r: { code: number | null; stdout: string; stderr: string }) => {
  assert.equal(r.code, 0, `exit ${r.code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
};

/** The hub's notice in the Agents topic for a refused call, as the subscribed UI sees it. */
const notice = (ui: FrameClient, text: string) =>
  ui.waitFor((f) => {
    const m = f.message as { from?: string; topic?: string; text?: string } | undefined;
    return f.type === 'message' && m?.from === 'hub' && m.topic === 'agents' && m.text === text;
  });

/** One call through a session, and what it must come to. `forbidden` is the permission the refusal names. */
type Case = { tool: string; args?: Record<string, unknown>; forbidden?: string; reason?: RegExp; error?: RegExp; errorCode?: string; target?: string };

type Caller = { name: string; sessionId: string; role: string | null; label: string; call: (tool: string, args: Record<string, unknown>) => Promise<ToolResult> };

const mcp = (s: Session, name: string, sessionId: string, role: string | null, label: string): Caller => ({ name, sessionId, role, label, call: (tool, args) => s.call<ToolResult>(tool, args) });

const direct = (_ui: FrameClient, s: { call: Session['call'] }, name: string, sessionId: string, role: string | null, label: string): Caller => ({
  name, sessionId, role, label, call: (tool, args) => s.call<ToolResult>(tool, args),
});

/** Make the call; check its answer, its audit record, and for a refusal the typed error and the Agents notice. */
async function check(root: string, ui: FrameClient, who: Caller, c: Case): Promise<void> {
  const before = (await audits(root)).length;
  const r = await who.call(c.tool, c.args ?? {});
  const what = `${who.label} ${c.tool} ${JSON.stringify(c.args ?? {})}`;
  let outcome = 'ok';
  if (c.forbidden) {
    outcome = 'forbidden';
    assert.equal(r.ok, false, `${what}: ${JSON.stringify(r)}`);
    assert.equal(r.code, 'forbidden', `${what}: ${JSON.stringify(r)}`);
    assert.equal(r.permission, c.forbidden, what);
    assert.equal(r.role, who.role, what);
    if (c.reason) assert.match(r.reason ?? '', c.reason, what);
    assert.equal(r.error, `forbidden: ${r.permission} (${r.reason})`);
    await notice(ui, `${who.label} tried ${c.tool}${c.target ?? ''}: forbidden (${r.reason})`);
  } else if (c.error) {
    outcome = 'error';
    assert.equal(r.ok, false, what);
    assert.equal(r.code, c.errorCode, `${what} is not refused by the table: ${JSON.stringify(r)}`);
    assert.match(r.error ?? '', c.error, what);
  } else assert.equal(r.ok, true, `${what}: ${JSON.stringify(r)}`);
  const records = (await audits(root)).slice(before).filter((a) => a.session === who.name);
  assert.equal(records.length, 1, `${what}: one audit record, got ${JSON.stringify(records)}`);
  const [a] = records as [Audit];
  assert.deepEqual([a.session, a.sessionId, a.role, a.tool, a.outcome], [who.name, who.sessionId, who.role, c.tool, outcome], what);
  if (c.forbidden) assert.deepEqual([a.permission, a.reason], [c.forbidden, r.reason]);
  // never the text of a message
  assert.ok(!JSON.stringify(a.args).includes('secret words'), JSON.stringify(a.args));
}

async function setup(t: TestContext) {
  const root = await tempProject(t);
  const rows: Audit[] = [];
  const loaded: Record<string, unknown>[] = [];
  auditRows.set(root, rows);
  t.after(() => { auditRows.delete(root); });
  const { discovery, dispatcher, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', log: entry => { if (entry.event === 'audit') rows.push(entry as Audit); if (entry.event === 'roles-loaded') loaded.push(entry); } });
  const ui = await dispatcherUi(t, dispatcher, root);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  return { root, discovery, ui, loaded, fakes, dispatcher };
}

test('an Implementer shell lists launched sessions in text and JSON while session mutations stay refused', async t => {
  const { root, ui, fakes } = await setup(t);
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: 'sess-impl', role: 'implementer' });
  t.after(() => impl.close());
  await impl.waitForPresence(['impl']);
  await value(ui, { type: 'session.launch', name: 'worker', harness: 'codex' });
  const shell = { CLAND_SESSION_ID: 'sess-impl', CLAND_SESSION_NAME: 'impl' };
  const listed = await clandWithEnv(root, shell, 'session', 'list');
  assert.equal(listed.code, 0, listed.stderr);
  assert.match(listed.stdout, /^worker .*codex {2}running/m);
  const json = await clandWithEnv(root, shell, 'session', 'list', '--json');
  assert.equal(json.code, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout).processes.map((p: { name: string }) => p.name), ['worker']);
  const archived = await clandWithEnv(root, shell, 'session', 'list', '--archived', '--json');
  assert.equal(archived.code, 0, archived.stderr);
  assert.deepEqual(JSON.parse(archived.stdout).processes, []);
  for (const args of [
    ['launch', 'forbidden-worker', '--harness', 'codex'],
    ['stop', 'worker'],
    ['resume', 'worker', '--relaunch'],
    ['archive', 'worker'],
    ['prune', '--older-than', '1d'],
  ]) {
    const refused = await clandWithEnv(root, shell, 'session', ...args);
    assert.equal(refused.code, 1, refused.stdout);
    assert.ok(refused.stderr.includes(`forbidden: session.${args[0]} (Implementer may not use session.${args[0]})`), refused.stderr);
  }
  assert.equal(fakes.codex!.spawns.length, 1, 'only the human launch reached the adapter');
  const reads = (await audits(root)).filter(a => a.session === 'impl' && a.tool === 'session.list');
  assert.ok(reads.length > 0);
  assert.ok(reads.every(a => a.role === 'implementer' && a.sessionId === 'sess-impl' && a.client === 'cli' && a.outcome === 'ok'));
});

test('permission rows preserve typed refusals, notices and audit provenance through the dispatcher', async (t) => {
  const { root, ui, dispatcher } = await setup(t);
  const spawn = async (name: string, role: string) => {
    await value(ui, { type: 'role.set', session: name, role });
    return dispatcherSpoke(t, dispatcher, root, name, `sess-${name}`);
  };
  const coordS = await spawn('coord', 'coordinator');
  const implS = await spawn('impl', 'implementer');
  const revS = await spawn('rev', 'reviewer');
  const qaS = await spawn('qa-1', 'qa');
  const goneS = await spawn('gone', 'implementer');
  // the items, by the human: T-1 is impl's (assigned), T-2 nobody's, T-3 for the Coordinator to close
  await value(ui, { type: 'task.create', size: 'M', title: 'Own item', assignee: 'impl' });
  await value(ui, { type: 'task.create', size: 'M', title: 'Other item' });
  await value(ui, { type: 'task.create', size: 'M', title: 'To close' });

  const coord = direct(ui, coordS, 'coord', 'sess-coord', 'coordinator', 'coord [Coordinator]');
  const impl = direct(ui, implS, 'impl', 'sess-impl', 'implementer', 'impl [Implementer]');
  const rev = direct(ui, revS, 'rev', 'sess-rev', 'reviewer', 'rev [Reviewer]');
  const qa = direct(ui, qaS, 'qa-1', 'sess-qa-1', 'qa', 'qa-1 [QA]');
  const text = 'secret words';
  const verdict = (kind: string) => ({ id: 'T-2', text: 'Looked.', verdict: kind, ...(kind === 'review' ? { scope: 'full' } : {}), result: 'clear', run: `r-${kind}` });
  const toHuman: Case = { tool: 'send', args: { text }, target: ' to the human' };
  const notHuman = /only the Coordinator writes to the human/;

  // the Coordinator: everything today's tools offer
  for (const c of [
    { tool: 'send', args: { to: ['impl'], text } },
    { tool: 'send', args: { text } },
    { tool: 'who' },
    { tool: 'history' },
    { tool: 'status', args: { text: 'coordinating' } },
    { tool: 'task.view', args: { id: 'T-2' } },
    { tool: 'task.list' },
    { tool: 'task.create', args: { size: 'M', title: 'By the Coordinator' } },
    { tool: 'task.edit', args: { id: 'T-2', add_labels: ['triaged'] } },
    { tool: 'task.link', args: { id: 'T-2', branch: 't/2-other' } },
    { tool: 'task.claim', args: { id: 'T-2' } },
    { tool: 'task.claim', args: { id: 'T-2', release: true } },
    { tool: 'task.comment', args: { id: 'T-2', text: 'A plain note.' } },
    { tool: 'task.comment', args: verdict('review') },
    { tool: 'task.close', args: { id: 'T-3' } },
    // allowed by the table; the launch itself fails on the harness
    { tool: 'session.launch', args: { name: 'new-one', harness: 'nope' }, error: /nope/ },
  ] satisfies Case[])
    await check(root, ui, coord, c);

  // the Implementer: send to sessions, reads, claims and comments on its own item, and only review on its claim
  for (const c of [
    { tool: 'send', args: { to: ['coord'], text } },
    { ...toHuman, forbidden: 'send:human', reason: notHuman },
    { tool: 'who' },
    { tool: 'history' },
    { tool: 'status', args: { text: 'implementing' } },
    { tool: 'task.view', args: { id: 'T-1' } },
    { tool: 'task.list' },
    { tool: 'task.claim', args: { id: 'T-1' } },
    { tool: 'task.claim', args: { id: 'T-2' }, forbidden: 'task.claim', reason: /claim only its own item/, target: ' T-2' },
    { tool: 'task.comment', args: { id: 'T-1', text: 'Working on it.' } },
    { tool: 'task.comment', args: { id: 'T-2', text: 'Not mine.' }, forbidden: 'task.comment', reason: /only on its own item/, target: ' T-2' },
    { tool: 'task.comment', args: { id: 'T-1', text: 'Self-review.', verdict: 'review', scope: 'full', result: 'clear', run: 'r-self' }, forbidden: 'task.comment:verdict', reason: /may not write verdicts/, target: ' T-1' },
    { tool: 'task.create', args: { size: 'M', title: 'Mine' }, forbidden: 'task.create', reason: /Implementer may not use task\.create/ },
    { tool: 'task.edit', args: { id: 'T-1', assignee: 'rev' }, forbidden: 'task.edit:review', reason: /may set only review on its claimed item, without other edits/, target: ' T-1' },
    { tool: 'task.edit', args: { id: 'T-1', status: 'review', assignee: 'rev' }, forbidden: 'task.edit:review', reason: /may set only review on its claimed item, without other edits/, target: ' T-1' },
    { tool: 'task.edit', args: { id: 'T-1', status: 'planned' }, forbidden: 'task.edit:review', reason: /may set only review on its claimed item, without other edits/, target: ' T-1' },
    { tool: 'task.edit', args: { id: 'T-2', status: 'review' }, forbidden: 'task.edit:review', reason: /may set only review on its claimed item, without other edits/, target: ' T-2' },
    { tool: 'task.close', args: { id: 'T-1' }, forbidden: 'task.close', target: ' T-1' },
    { tool: 'task.link', args: { id: 'T-1', branch: 'x' }, forbidden: 'task.link', target: ' T-1' },
    { tool: 'session.launch', args: { name: 'helper' }, forbidden: 'session.launch' },
  ] satisfies Case[])
    await check(root, ui, impl, c);

  // its own item is also the one it claims: reassigned by the Coordinator, the claim keeps it its own
  await check(root, ui, coord, { tool: 'task.edit', args: { id: 'T-1', assignee: 'someone-else' } });
  await check(root, ui, impl, { tool: 'task.comment', args: { id: 'T-1', text: 'Still mine: I hold the claim.' } });
  await check(root, ui, impl, { tool: 'task.claim', args: { id: 'T-1', release: true } });
  await check(root, ui, impl, { tool: 'task.comment', args: { id: 'T-1', text: 'Now nobody gave it to me.' }, forbidden: 'task.comment', target: ' T-1' });

  // Reviewer and QA: send to sessions, reads, verdict comments only
  for (const [who, kind] of [
    [rev, 'review'],
    [qa, 'qa'],
  ] as const) {
    for (const c of [
      { tool: 'send', args: { to: ['coord'], text } },
      { ...toHuman, forbidden: 'send:human', reason: notHuman },
      { tool: 'who' },
      { tool: 'history' },
      { tool: 'status', args: { text: 'checking' } },
      { tool: 'task.view', args: { id: 'T-2' } },
      { tool: 'task.list' },
      { tool: 'task.comment', args: verdict(kind) },
      { tool: 'task.comment', args: { id: 'T-2', text: 'Just a remark.' }, forbidden: 'task.comment', reason: /may only comment verdicts/, target: ' T-2' },
      { tool: 'task.claim', args: { id: 'T-2' }, forbidden: 'task.claim', target: ' T-2' },
      { tool: 'task.create', args: { size: 'M', title: 'x' }, forbidden: 'task.create' },
      { tool: 'task.edit', args: { id: 'T-2', title: 'y' }, forbidden: 'task.edit', target: ' T-2' },
      { tool: 'task.close', args: { id: 'T-2' }, forbidden: 'task.close', reason: new RegExp(`${who === rev ? 'Reviewer' : 'QA'} may not use task\\.close`), target: ' T-2' },
      { tool: 'task.link', args: { id: 'T-2', branch: 'x' }, forbidden: 'task.link', target: ' T-2' },
      { tool: 'session.launch', args: { name: 'helper' }, forbidden: 'session.launch' },
    ] satisfies Case[])
      await check(root, ui, who, c);
  }
  // names never change (spec 4.4): only the Coordinator renames, and back
  await check(root, ui, rev, { tool: 'rename', args: { name: 'rev-b' }, forbidden: 'rename', reason: /Reviewer may not use rename/ });
  await check(root, ui, coord, { tool: 'rename', args: { name: 'coord-b' } });
  await check(root, ui, { ...coord, name: 'coord-b', label: 'coord-b [Coordinator]' }, { tool: 'rename', args: { name: 'coord' } });

  // a session with no role (its role revoked while it is connected): every tool refused
  assert.equal((await ui.request({ type: 'role.clear', session: 'gone' })).ok, true);
  const gone = direct(ui, goneS, 'gone', 'sess-gone', null, 'gone');
  for (const tool of ['who', 'history', 'status', 'send', 'task.view', 'task.list', 'task.comment', 'task.claim', 'rename', 'session.launch']) {
    const args = tool === 'send' || tool === 'status' ? { text } : tool === 'rename' ? { name: 'gone-2' } : tool === 'session.launch' ? { name: 'x' } : tool.startsWith('task.') && tool !== 'task.list' ? { id: 'T-1', ...(tool === 'task.comment' ? { text } : {}) } : {};
    await check(root, ui, gone, { tool, args, forbidden: tool, reason: /^a session with no role has no tools$/, ...(tool === 'send' ? { target: ' to the human' } : 'id' in args ? { target: ' T-1' } : {}) });
  }

  // what an audit record keeps: ids, addressees, topics; text only as its length
  const all = await audits(root);
  const sent = all.find((a) => a.session === 'impl' && a.tool === 'send' && a.outcome === 'ok');
  assert.deepEqual(sent?.args, { to: ['coord'], textChars: text.length });
  const claimed = all.find((a) => a.session === 'impl' && a.tool === 'task.claim' && a.outcome === 'ok');
  assert.deepEqual(claimed?.args, { item: 'T-1' });
  assert.ok(!all.some((a) => JSON.stringify(a).includes(text)), 'no message text in the audit');
});

test('role-bearing MCP callers preserve the permission frame contract', async t => {
  const { root, ui } = await setup(t);
  await value(ui, { type: 'task.create', size: 'M', title: 'MCP frame proof' });
  for (const [name, role] of [['coord', 'coordinator'], ['impl', 'implementer'], ['rev', 'reviewer'], ['qa-1', 'qa']] as const) {
    const peer = await inProcessSpoke(t, { discover: true, cwd: root, name, role, sessionId: `mcp-${name}` });
    assert.equal((await peer.call<ToolResult>('who')).ok, true, role);
    const result = await peer.call<ToolResult>('task.close', { id: 'T-1' });
    if (role === 'coordinator') assert.equal(result.ok, true);
    else assert.deepEqual([result.ok, result.code, result.permission, result.role], [false, 'forbidden', 'task.close', role]);
  }
});

test('a session the human @mentioned in a topic may reply to the human there, while the human\'s latest message there addresses it', async (t) => {
  const { root, ui } = await setup(t);
  const spawn = async (name: string, role: string) => {
    const s = await inProcessSpoke(t, { discover: true, cwd: root, name, sessionId: `sess-${name}`, role });
    t.after(() => s.close());
    await s.waitForPresence([name]);
    return s;
  };
  const coordS = await spawn('coord', 'coordinator');
  const revS = await spawn('rev', 'reviewer');
  await coordS.waitForPresence(['coord', 'rev']);
  const rev = direct(ui, revS, 'rev', 'sess-rev', 'reviewer', 'rev [Reviewer]');
  const topic = async (title: string) => {
    const r = await ui.request({ type: 'topic.create', title });
    assert.equal(r.ok, true, r.error);
    return (r.value as { topic: { id: string } }).topic.id;
  };
  const human = async (id: string, text: string) => assert.equal((await ui.request({ type: 'topic.send', topic: id, text })).ok, true);
  const review = await topic('Review of T-1');
  const other = await topic('Release date');
  const notHuman = /only the Coordinator writes to the human/;

  // the human pulls the Reviewer into one topic, by its role; another topic is the Coordinator's
  await human(review, '@reviewer does the diff hold?');
  await revS.waitForEvent((e) => e.params.content === '@reviewer does the diff hold?');
  await human(other, 'when do we release?');
  await check(root, ui, rev, { tool: 'send', args: { topic: review, text: 'it holds' }, target: ' to the human' });
  await check(root, ui, rev, { tool: 'send', args: { topic: review, text: 'one more note' }, target: ' to the human' });
  await check(root, ui, rev, { tool: 'send', args: { topic: other, text: 'secret words' }, forbidden: 'send:human', reason: notHuman, target: ' to the human' });
  await check(root, ui, rev, { tool: 'send', args: { text: 'secret words' }, forbidden: 'send:human', reason: notHuman, target: ' to the human' });
  // by name too; and once the human's latest message in the topic addresses someone else, the grant is gone
  await human(other, '@rev and what do you think?');
  await revS.waitForEvent((e) => e.params.content === '@rev and what do you think?');
  await check(root, ui, rev, { tool: 'send', args: { topic: other, text: 'next week' }, target: ' to the human' });
  await human(review, 'thanks, coordinator: merge it');
  await check(root, ui, rev, { tool: 'send', args: { topic: review, text: 'secret words' }, forbidden: 'send:human', reason: notHuman, target: ' to the human' });
});

test('role.set changes what a session may do on its next call, without a reconnect; the human is unrestricted and audited', async (t) => {
  const { root, ui } = await setup(t);
  const s = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: 'sess-impl', role: 'implementer' });
  t.after(() => s.close());
  await s.waitForPresence(['impl']);
  const connectedAt = async () => ((await ui.request({ type: 'hub.status' })).value as { sessions: Array<{ name: string; connectedAt: string; role: string | null }> }).sessions.find((p) => p.name === 'impl');
  const first = await connectedAt();

  // the human creates an item through the UI's frame: not restricted by the table, audited as the human
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'For impl', assignee: 'impl' });
  assert.equal(created.ok, true, created.error);
  const impl = mcp(s, 'impl', 'sess-impl', 'implementer', 'impl [Implementer]');
  await check(root, ui, impl, { tool: 'task.comment', args: { id: 'T-1', text: 'on it' } });

  // the human makes it a Reviewer: the very next call is judged as a Reviewer's
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'reviewer' })).ok, true);
  const asReviewer = { ...impl, role: 'reviewer', label: 'impl [Reviewer]' };
  await check(root, ui, asReviewer, { tool: 'task.comment', args: { id: 'T-1', text: 'on it, still?' }, forbidden: 'task.comment', reason: /Reviewer may only comment verdicts/, target: ' T-1' });
  await check(root, ui, asReviewer, { tool: 'task.comment', args: { id: 'T-1', verdict: 'review', scope: 'full', result: 'not clear', run: 'r-1' } });
  // and back
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  await check(root, ui, impl, { tool: 'task.comment', args: { id: 'T-1', text: 'back to work' } });
  const after = await connectedAt();
  assert.equal(after?.connectedAt, first?.connectedAt, 'the same connection throughout');
  assert.doesNotMatch(s.log(), /reconnect/i);

  // the human does what no Implementer may, and every call of theirs is in the audit as the human's
  for (const frame of [
    { type: 'task.close', item: 'T-1' },
    { type: 'topic.send', topic: 'general', text: 'secret words', to: ['impl'] },
    { type: 'role.list' },
  ]) {
    const r = await ui.request(frame);
    assert.equal(r.ok, true, `${frame.type}: ${r.error}`);
  }
  const human = (await audits(root)).filter((a) => a.session === 'human' && a.client === 'ui');
  const byTool = (tool: string) => human.find((a) => a.tool === tool);
  for (const tool of ['task.create', 'role.set', 'task.close', 'topic.send', 'role.list']) {
    assert.deepEqual([byTool(tool)?.role, byTool(tool)?.sessionId, byTool(tool)?.outcome, byTool(tool)?.client], ['human', null, 'ok', 'ui'], tool);
  }
  assert.deepEqual(byTool('topic.send')?.args, { to: ['impl'], topic: 'general', textChars: 'secret words'.length });
  // a human call that fails is audited as an error
  assert.equal((await ui.request({ type: 'task.view', item: 'T-9' })).ok, false);
  assert.equal((await audits(root)).filter((a) => a.session === 'human' && a.tool === 'task.view').at(-1)?.outcome, 'error');

  // cland hub audit: filtered by session, by time, as JSON or lines
  const lines = ok(await cland(root, 'hub', 'audit', '--session', 'impl')).stdout.trim().split('\n');
  assert.ok(lines.length >= 4, lines.join('\n'));
  assert.match(lines.find((l) => l.includes('forbidden')) ?? '', /^\S+ {2}impl \[reviewer\] {2}task\.comment {2}item=T-1 textChars=\d+ {2}forbidden task\.comment \(Reviewer may only comment verdicts\)$/);
  assert.ok(lines.every((l) => / {2}impl( \[\w+\])? {2}/.test(l)), lines.join('\n'));
  const json = ok(await cland(root, 'hub', 'audit', '--json', '--since', '1h')).stdout.trim().split('\n').map((l) => JSON.parse(l) as Audit);
  assert.deepEqual(json, await audits(root).then((all) => all.slice(0, json.length)));
  assert.ok(json.some((a) => a.session === 'human') && json.some((a) => a.session === 'impl'));
  assert.equal(ok(await cland(root, 'hub', 'audit', '--since', '2999-01-01T00:00:00Z')).stdout, 'no tool calls recorded\n');
  const bad = await cland(root, 'hub', 'audit', '--since', 'yesterday-ish');
  assert.equal(bad.code, 2);
  assert.match(bad.stderr, /--since needs an ISO time or a span/);
});

// ------------------------------------------------------------------ the tools with no MCP tool yet
// Future tools and incomplete calls are checked through the table: a spoke's raw
// frame is checked like any other. Allowed, it reaches the dispatcher's "unknown request type" (an `error` in the
// audit); refused, it is `forbidden`. `resolve` and `topic.create` (#32) and `role.handover` (#31) go through the
// same rows with their frames.

/** A spoke speaking the hub's frames itself over the WebSocket, as a session whose role the human assigned. */
async function rawSpoke(t: TestContext, discovery: Discovery, name: string, cwd: string): Promise<Caller & { ws: WebSocket }> {
  const ws = new WebSocket(`ws://127.0.0.1:${discovery.port}`, { headers: { authorization: `Bearer ${discovery.secret}` } });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  t.after(() => ws.terminate());
  const frames: Array<Record<string, unknown>> = [];
  const waiters: Array<{ p: (f: Record<string, unknown>) => boolean; r: (f: Record<string, unknown>) => void }> = [];
  ws.on('message', (data) => {
    const f = JSON.parse(data.toString()) as Record<string, unknown>;
    // a delivery is acked like a spoke would
    if ((f.type === 'deliver' || f.type === 'role') && typeof f.id === 'string') ws.send(JSON.stringify({ type: 'ack', id: f.id }));
    frames.push(f);
    for (const w of [...waiters]) if (w.p(f)) waiters.splice(waiters.indexOf(w), 1) && w.r(f);
  });
  const next = (p: (f: Record<string, unknown>) => boolean) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const hit = frames.find(p);
      if (hit) return resolve(hit);
      const timer = setTimeout(() => reject(new Error(`no frame matched; saw ${JSON.stringify(frames)}`)), 5000);
      waiters.push({ p, r: (f) => (clearTimeout(timer), resolve(f)) });
    });
  ws.send(JSON.stringify({ type: 'hello', protocol: 2, sessionId: `sess-${name}`, cwd, name }));
  const welcome = await next((f) => f.type === 'welcome' || f.type === 'error');
  assert.equal(welcome.type, 'welcome', JSON.stringify(welcome));
  let n = 0;
  return {
    ws,
    name,
    sessionId: `sess-${name}`,
    role: null,
    label: name,
    call: async (tool, args) => {
      const id = `raw-${++n}`;
      ws.send(JSON.stringify({ type: tool, id, ...args }));
      return (await next((f) => f.type === 'result' && f.id === id)) as unknown as ToolResult;
    },
  };
}

test('Implementer, Reviewer and QA session tools and shell calls retain their refusals', async t => {
  const { root, discovery, ui } = await setup(t);
  const cli = await connectUi(t, discovery, 'cli');
  for (const [name, role, label] of [['impl', 'implementer', 'Implementer'], ['rev', 'reviewer', 'Reviewer'], ['qa-1', 'qa', 'QA']]) {
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const raw = await rawSpoke(t, discovery, name!, root);
    const caller = { ...raw, role: role!, label: `${name} [${label}]` };
    for (const tool of ['session.launch', 'session.stop', 'session.resume']) {
      await check(root, ui, caller, { tool, args: tool === 'session.launch' ? { name: 'helper', role: 'implementer' } : { session: 'coord' }, forbidden: tool });
      const result = await cli.request({ type: tool, ...(tool === 'session.launch' ? { name: 'helper' } : { session: 'coord' }), as: { name, sessionId: raw.sessionId, shell: true } });
      assert.equal(result.ok, false);
      assert.match(result.error ?? '', new RegExp(`forbidden: ${tool.replace('.', '\\.')}`));
          const row = (await audits(root)).filter(row => row.session === name && row.tool === tool && row.client === 'cli').at(-1)!;
      assert.deepEqual([row.session, row.sessionId, row.role, row.tool, row.client, row.outcome], [name, raw.sessionId, role, tool, 'cli', 'forbidden']);
    }
  }
});

test('the tools still to come are checked through the same table: one session, its role changed by the human between calls', async (t) => {
  const { root, ui, dispatcher } = await setup(t);
  await value(ui, { type: 'task.create', size: 'M', title: 'Raw own', assignee: 'raw' });
  await value(ui, { type: 'task.create', size: 'M', title: 'Not raw' });
  assert.equal((await ui.request({ type: 'role.set', session: 'raw', role: 'coordinator' })).ok, true);
  const raw = await dispatcherSpoke(t, dispatcher, root, 'raw', 'sess-raw');
  const directRaw = direct(ui, raw, 'raw', 'sess-raw', 'coordinator', 'raw [Coordinator]');
  const unknown = /unknown request type/;
  const as = (role: string | null, label: string): Caller => ({ ...directRaw, role, label: role ? `raw [${label}]` : 'raw' });
  // Permission controls use valid arguments; malformed calls now stop before the permission table.
  const valid: Record<string, Record<string, unknown>> = {
    ask: { topic: 'general', question: 'Which?', options: [] }, resolve: { topic: 'general' },
    'topic.create': { title: 'Fixture' }, 'role.handover': { to: 'x', note: { goals_now: 'g', work_in_flight: 'w', open_decisions: 'o', waiting_on: 'n' } },
    merge: { item: 'T-2' }, 'artifact.create': { kind: 'note', title: 'Fixture', topic: 'missing', content: 'Fixture' },
  };
  const future = (tool: string, extra: Record<string, unknown> = {}) => ({ tool, args: { ...valid[tool], ...extra }, ...(tool === 'merge' ? { target: ` ${extra.item ?? 'T-2'}` } : {}) });
  const rows: Array<[string | null, string, Array<Case>]> = [
    [
      'coordinator',
      'Coordinator',
      [
        future('ask'),
        // resolve and topic.create have frames (#32): allowed, they do their work
        future('resolve', { topic: 'general' }),
        future('topic.create', { title: 'Free topic' }),
        future('topic.create', { title: 'Bound', item: 'T-2' }),
        // role.handover exists (#31): allowed by the table, then refused for a receiver the hub does not know
        { ...future('role.handover', { to: 'x', note: { goals_now: 'g', work_in_flight: 'w', open_decisions: 'o', waiting_on: 'n' } }), error: /"x" is not a session the hub knows/ },
        { ...future('merge', { item: 'T-2' }), error: /no branch/, errorCode: 'merge-branch' },
        { ...future('artifact.create'), error: /no such artifact topic/, errorCode: 'artifact-topic' },
        { ...future('task.import', { repo: 'o/r' }), forbidden: 'task.import' },
      ],
    ],
    [
      'implementer',
      'Implementer',
      [
        { ...future('ask'), forbidden: 'ask' },
        { ...future('resolve'), forbidden: 'resolve' },
        future('topic.create', { title: 'Mine', item: 'T-1' }),
        { ...future('topic.create', { title: 'Not mine', item: 'T-2' }), forbidden: 'topic.create', reason: /bound to its own item/, target: ' T-2' },
        { ...future('topic.create', { title: 'Unbound' }), forbidden: 'topic.create', reason: /bound to its own item/ },
        // a blank item is no item, and an item that cannot be looked up is not its own: both refused (review of #32)
        { ...future('topic.create', { title: 'Blank', item: '   ' }), forbidden: 'topic.create', reason: /bound to its own item/ },
        { ...future('topic.create', { title: 'Missing', item: 'T-99' }), forbidden: 'topic.create', reason: /bound to its own item/, target: ' T-99' },
        { ...future('role.handover'), forbidden: 'role.handover' },
        { ...future('merge', { item: 'T-1' }), forbidden: 'merge', target: ' T-1' },
        { ...future('artifact.create'), error: /no such artifact topic/, errorCode: 'artifact-topic' },
        { ...future('task.import'), forbidden: 'task.import' },
      ],
    ],
    ...(['reviewer', 'qa'] as const).map(
      (role): [string, string, Case[]] => [
        role,
        role === 'qa' ? 'QA' : 'Reviewer',
        [
          { ...future('ask'), forbidden: 'ask' },
          { ...future('resolve'), forbidden: 'resolve' },
          { ...future('topic.create', { title: 'x', item: 'T-1' }), forbidden: 'topic.create', target: ' T-1' },
          { ...future('role.handover'), forbidden: 'role.handover' },
          { ...future('merge'), forbidden: 'merge' },
          { ...future('artifact.create'), error: /no such artifact topic/, errorCode: 'artifact-topic' },
          { ...future('task.import'), forbidden: 'task.import' },
        ],
      ],
    ),
    [null, '', ['ask', 'resolve', 'topic.create', 'role.handover', 'merge', 'artifact.create', 'task.import'].map((tool) => ({ ...future(tool), forbidden: tool }))],
  ];
  let first = true;
  for (const [role, label, cases] of rows) {
    if (!first) {
      const r = role === null ? await ui.request({ type: 'role.clear', session: 'raw' }) : await ui.request({ type: 'role.set', session: 'raw', role });
      assert.equal(r.ok, true, r.error);
    }
    first = false;
    for (const c of cases) await check(root, ui, as(role, label), c);
  }
  // a frame that is no tool at all is not the table's business: unknown, and audited as an error
  await check(root, ui, as(null, ''), { tool: 'bogus.tool', error: unknown });
});

test('roles.toml is the table: an edited permission list is in force on the next call; the defaults written match the built-in table', async (t) => {
  // what the hub writes is what it enforces when a role gives no list
  const written = parseRoles(DEFAULT_ROLES_TOML);
  for (const [role, grants] of Object.entries(DEFAULT_PERMISSIONS)) assert.deepEqual(written.get(role)?.permissions.tools, [...grants], role);
  assert.deepEqual(parseRoles('[qa]\nclause = "x"\n[qa.launch]\nharness = "codex"\n').get('qa')?.permissions.tools, [...(DEFAULT_PERMISSIONS.qa ?? [])]);
  assert.throws(() => parseRoles('[qa.launch]\nharness = "codex"\n[qa.permissions]\ntools = ["send:everyone"]\n'), /qa\.permissions\.tools: "send" has no scope "everyone" \(scopes: agents, human\)/);
  assert.throws(() => parseRoles('[qa.launch]\nharness = "codex"\n[qa.permissions]\ntools = ["teleport"]\n'), /unknown tool "teleport"/);

  const { root, ui, loaded } = await setup(t);
  await value(ui, { type: 'task.create', size: 'M', title: 'Item' });
  const s = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', sessionId: 'sess-rev', role: 'reviewer' });
  t.after(() => s.close());
  await s.waitForPresence(['rev']);
  const rev = mcp(s, 'rev', 'sess-rev', 'reviewer', 'rev [Reviewer]');
  await check(root, ui, rev, { tool: 'send', args: { text: 'hello human' }, forbidden: 'send:human', target: ' to the human' });
  await check(root, ui, rev, { tool: 'task.close', args: { id: 'T-1' }, forbidden: 'task.close', target: ' T-1' });

  // the human gives the Reviewer the human's ear and closing, and takes `who` away
  const file = join(root, '.cland', 'roles.toml');
  const text = await readFile(file, 'utf8');
  const reviewerList = 'tools = ["send:agents", "task.hold", "task.comment:verdict", "task.criterion:verify", "artifact.create", "artifact.keep", "artifact.move", "artifact.archive", "subscribe", "unsubscribe", "subscriptions", "who", "session.list", "history", "status", "task.view", "task.list", "rule.list", "task.plan:show"]';
  assert.ok(text.includes(reviewerList));
  const edited = text.replace(reviewerList, 'tools = ["send:agents", "send:human", "task.comment:verdict", "task.close", "history", "status"]');
  const beforeLoad = loaded.length;
  await writeFile(file, edited);
  await eventually('the edit is read', () => loaded.length > beforeLoad ? true : undefined);
  await check(root, ui, rev, { tool: 'send', args: { text: 'hello human' } });
  await check(root, ui, rev, { tool: 'task.close', args: { id: 'T-1' } });
  await check(root, ui, rev, { tool: 'who', forbidden: 'who', reason: /Reviewer may not use who/ });
  const list = await clandWithEnv(root, { CLAND_SESSION_NAME: 'rev', CLAND_SESSION_ID: 'sess-rev' }, 'session', 'list');
  assert.equal(list.code, 1, list.stdout);
  assert.match(list.stderr, /forbidden: session\.list \(Reviewer may not use session\.list\)/);
  const denied = await s.call<ToolResult>('subscribe', { subject: { session: 'impl' }, events: ['session.state'] });
  assert.deepEqual([denied.ok, denied.code, denied.permission], [false, 'forbidden', 'subscribe']);
  await notice(ui, 'rev [Reviewer] tried event.subscribe: forbidden (Reviewer may not use subscribe)');
  assert.ok((await audits(root)).some(a => a.session === 'rev' && a.tool === 'event.subscribe' && a.outcome === 'forbidden' && a.permission === 'subscribe'));
});

async function integritySetup(t: TestContext) {
  const fixture = await setup(t);
  const spoke = async (name: string, sessionId: string, role?: string) => {
    const session = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name, sessionId, ...(role ? { role } : { assignRole: false }) });
    await session.waitForPresence([name]);
    return session;
  };
  return { ...fixture, spoke };
}

test("a client hello on the spokes' WebSocket is refused: the bearer secret makes no human", async (t) => {
  const { discovery } = await integritySetup(t);
  const ws = new WebSocket(`ws://127.0.0.1:${discovery.port}`, { headers: { authorization: `Bearer ${discovery.secret}` } });
  t.after(() => ws.terminate());
  await new Promise<void>((resolve, reject) => (ws.once('open', () => resolve()), ws.once('error', reject)));
  const frames: Array<Record<string, unknown>> = [];
  ws.on('message', (d) => frames.push(JSON.parse(String(d)) as Record<string, unknown>));
  ws.send(JSON.stringify({ type: 'hello', protocol: 2, client: 'ui' }));
  const refusal = await eventually('refused', () => frames.find((f) => f.type === 'error'));
  assert.equal(refusal.code, 'unauthorized');
  assert.match(String(refusal.message), /Unix socket or stdio/);
  assert.ok(!frames.some((f) => f.type === 'welcome'));
});

test('shell task frames bind the held identity despite forged roles', async t => {
  const { root, discovery, ui, spoke } = await integritySetup(t);
  await spoke('impl-1', 'sess-impl', 'implementer');
  const cli = await connectUi(t, discovery, 'cli');
  await value(ui, { type: 'task.create', size: 'M', title: 'Ship it', assignee: 'impl-1' });
  const closed = await cli.request({ type: 'task.close', item: 'T-1', as: { name: 'impl-1', sessionId: 'sess-impl', role: 'coordinator', shell: true } });
  assert.equal(closed.ok, false);
  assert.match(closed.error ?? '', /forbidden: task\.close \(Implementer may not use task\.close\)/);
  const record = (await audits(root)).filter(a => a.tool === 'task.close').at(-1);
  assert.deepEqual([record?.session, record?.sessionId, record?.role, record?.outcome, record?.client], ['impl-1', 'sess-impl', 'implementer', 'forbidden', 'cli']);
  const asName = await cli.request({ type: 'task.close', item: 'T-1', as: { name: 'impl-1', role: 'coordinator' } });
  assert.equal(asName.ok, false); assert.match(asName.error ?? '', /forbidden: task\.close/);
  const claimed = await value<{ claim: { session: string; sessionId: string } }>(cli, { type: 'task.claim', item: 'T-1', as: { name: 'impl-1', sessionId: 'sess-impl', shell: true } });
  assert.deepEqual([claimed.claim.session, claimed.claim.sessionId], ['impl-1', 'sess-impl']);
  await value(ui, { type: 'task.close', item: 'T-1' });
});

test('a rename moves no ownership: only the Coordinator renames, and another session under an assignee\'s name owns nothing of it', async (t) => {
  const { root, ui, spoke } = await integritySetup(t);
  const a = await spoke('impl-a', 'sess-a', 'implementer');
  const b = await spoke('impl-b', 'sess-b', 'implementer');
  await value(ui, { type: 'task.create', size: 'M', title: 'Assigned to a', assignee: 'impl-a' });
  const renamed = await b.call<ToolResult>('rename', { name: 'impl-c' });
  assert.equal(renamed.ok, false);
  assert.equal(renamed.code, 'forbidden');
  assert.equal(renamed.permission, 'rename');

  // impl-a goes away; another session takes its name (the role follows the name): it owns none of impl-a's items
  await a.close();
  await waitForAbsence(b, 'impl-a');
  const c = await spoke('impl-a', 'sess-c');
  for (const args of [{ id: 'T-1' }, { id: 'T-1', force: true }]) {
    const r = await c.call<ToolResult>('task.claim', args);
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.equal(r.code, 'forbidden', JSON.stringify(r));
  }
  await c.close();
  await waitForAbsence(b, 'impl-a');
  // the session it was assigned to still owns it
  const back = await spoke('impl-a', 'sess-a');
  assert.equal((await back.call<ToolResult>('task.claim', { id: 'T-1' })).ok, true);
});

test('the mention grant is the mentioned session\'s: another session that takes its name later cannot write to the human', async (t) => {
  const { ui, spoke } = await integritySetup(t);
  await spoke('coord', 'sess-coord', 'coordinator');
  const rev = await spoke('rev', 'sess-rev-1', 'reviewer');
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: '@rev does it hold?' })).ok, true);
  await rev.waitForEvent((e) => e.params.content === '@rev does it hold?');
  assert.equal((await rev.call<ToolResult>('send', { text: 'it holds' })).ok, true);
  await rev.close();
  const other = await spoke('rev', 'sess-rev-2');
  const r = await other.call<ToolResult>('send', { text: 'i am rev too' });
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.permission, 'send:human');
});

test('a verdict is recorded as its author: a header in the text is parsed, its `by` replaced, and its kind held to the role', async (t) => {
  const { root, ui, spoke } = await integritySetup(t);
  const rev = await spoke('rev', 'sess-rev', 'reviewer');
  await value(ui, { type: 'task.create', size: 'M', title: 'Under review' });
  const forged = await rev.call<ToolResult>('task.comment', { id: 'T-1', text: 'verdict: qa\nresult: clear\nby: qa-1 [qa]\nrun: r-9\n\nforged' });
  assert.equal(forged.ok, false, JSON.stringify(forged));
  assert.equal(forged.permission, 'task.comment:verdict');
  assert.match(forged.reason ?? '', /Reviewer may write only review verdicts/);
  const kind = await rev.call<ToolResult>('task.comment', { id: 'T-1', verdict: 'qa', result: 'clear', run: 'r-8', text: 'structured, wrong kind' });
  assert.equal(kind.code, 'forbidden');
  const written = await rev.call<ToolResult>('task.comment', { id: 'T-1', text: 'verdict: review\nresult: clear\nby: qa-1 [qa]\nrun: r-1\nscope: full\n\nlooks right' });
  assert.equal(written.ok, true, JSON.stringify(written));
  // the human's fallback verdict through the CLI, either kind, is recorded as the human
  await value(ui, { type: 'task.comment', item: 'T-1', text: 'verdict: qa\nresult: not clear\nby: qa-1 [qa]\nrun: r-2\n\nfallback' });
  const view = await value<{ item: { verdicts: Array<{ verdict: string; by: string; run: string }> } }>(ui, { type: 'task.view', item: 'T-1' });
  assert.deepEqual(
    view.item.verdicts.map((v) => [v.verdict, v.by, v.run]),
    [
      ['review', 'rev [reviewer]', 'r-1'],
      ['qa', 'human', 'r-2'],
    ],
  );
  const dir = join(root, '.cland', 'tasks');
  const file = await readFile(join(dir, (await readdir(dir)).find((f) => f.startsWith('T-1-')) as string), 'utf8');
  assert.ok(!file.includes('qa-1'), file);
  assert.equal((file.match(/^verdict: /gm) ?? []).length, 2, file);
});

test('a reply in Agents reaches its sender after a rename: by the session id it wrote from', async (t) => {
  const { ui, spoke } = await integritySetup(t);
  const alpha = await spoke('alpha', 'sess-alpha', 'coordinator');
  const beta = await spoke('beta', 'sess-beta', 'implementer');
  const sent = await alpha.call<{ ok: boolean }>('send', { to: ['beta'], text: 'status of T-1?' });
  assert.equal(sent.ok, true);
  const got = await beta.waitForEvent((e) => e.params.content === 'status of T-1?');
  const id = got.params.meta?.msg_id as string;
  assert.deepEqual(await alpha.call('rename', { name: 'gamma' }), { ok: true, name: 'gamma' });
  const reply = await ui.request({ type: 'topic.send', topic: 'agents', text: 'beta is on it', replyTo: id });
  assert.equal(reply.ok, true, reply.error);
  assert.deepEqual((reply.value as { message: { to: string[] } }).message.to, ['gamma']);
  await alpha.waitForEvent((e) => e.params.content === 'beta is on it');
});
