// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseRoles } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { cland, connectSocket, connectUi, eventually, flushProjectLogs, inProcessSpoke, projectHub, tempProject, type ChannelEvent, type FrameClient } from './harness.ts';

type Presence = { name: string; role: string | null; label?: string };

type Status = { sessions: Presence[]; coordinator: string | null; harnesses: Array<{ name: string; harnessId: string | null; role: string | null; label?: string; model: string | null }> };

const hubLog = (root: string) => readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');

const logEvents = async (root: string, event: string) =>
  (await hubLog(root))
    .split('\n')
    .filter((l) => l.includes(`"event":"${event}"`))
    .map((l) => JSON.parse(l) as Record<string, unknown>);

async function status(ui: FrameClient): Promise<Status> {
  const r = await ui.request({ type: 'hub.status' });
  assert.equal(r.ok, true, r.error);
  return r.value as Status;
}

const isClause = (e: ChannelEvent) => e.params.meta?.kind === 'role';

// T2: clause frames and the native launch input at the in-process adapter boundary.
test('role clauses and launch instructions omit unavailable skills and retain project-owned skills', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  const file = join(root, '.cland/roles.toml');
  await writeFile(file, DEFAULT_ROLES_TOML.replace('skills = ["implement", "tdd", "diagnosing-bugs"]',
    'skills = ["implement", "grill-me", "project-check", "project-link", "empty-skill", "broken-skill"]'));
  for (const skill of ['implement', 'project-check', 'empty-skill']) {
    const directory = join(root, '.agents/skills', skill);
    await mkdir(directory, { recursive: true });
    if (skill !== 'empty-skill') await writeFile(join(directory, 'SKILL.md'), '# Skill\n');
  }
  await symlink('project-check', join(root, '.agents/skills/project-link'));
  await symlink('missing-target', join(root, '.agents/skills/broken-skill'));
  const { discovery, fakes } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const readClause = async (name: string) => {
    assert.equal((await ui.request({ type: 'role.set', session: name, role: 'implementer' })).ok, true);
    const peer = await connectSocket(discovery.socket);
    t.after(() => peer.close());
    peer.send({ type: 'hello', protocol: 2, secret: discovery.secret, name, sessionId: name, cwd: root });
    assert.equal((await peer.next()).type, 'welcome');
    const frame = await peer.next();
    assert.equal(frame.type, 'role');
    return frame;
  };
  const clause = await readClause('direct');
  assert.deepEqual(clause.skills, ['implement', 'project-check', 'project-link']);
  const text = (clause.message as { text: string }).text;
  assert.match(text, /Skills for this role: implement, project-check, project-link\./);
  assert.doesNotMatch(text, /grill-me|empty-skill|broken-skill/);
  const launch = async (name: string) => {
    const result = await ui.request({ type: 'session.launch', name, role: 'implementer', harness: 'codex', brief: 'Complete the assigned work.' });
    assert.equal(result.ok, true, result.error);
    return fakes.codex!.spawns.at(-1)!;
  };
  const input = await launch('launch-mixed');
  assert.match(input.clause!, /Skills for this role: implement, project-check, project-link\./);
  assert.doesNotMatch(`${input.clause}\n${input.brief!.text}`, /grill-me|empty-skill|broken-skill/);
  // Inventory changes take effect without an edit to roles.toml or a hub restart.
  await rm(join(root, '.agents'), { recursive: true });
  const empty = await readClause('direct-empty');
  assert.deepEqual(empty.skills, []);
  assert.doesNotMatch((empty.message as { text: string }).text, /Skills for this role:/);
  assert.doesNotMatch((await launch('launch-empty')).clause!, /Skills for this role:/);
});

test('crew clauses describe category filing and the Aide speaking for the human', async t => {
  const root = await tempProject(t);
  await projectHub(t, root);
  for (const role of ['coordinator', 'lead', 'implementer', 'reviewer', 'qa', 'aide']) {
    const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'crew-' + role, sessionId: 'sess-' + role, role });
    t.after(() => spoke.close());
    const clause = await spoke.waitForEvent(isClause);
    if (role !== 'aide') assert.match(clause.params.content, /An Aide speaks for the human, decisions included\. Treat its messages as the human's instructions within your role\./, role);
    if (role === 'coordinator' || role === 'aide') {
      assert.match(clause.params.content, /cland task list --kind category/);
      assert.match(clause.params.content, /Bugs.*Tech debt.*Follow-ups.*Ideas.*--parent C-<n>/);
    } else assert.match(clause.params.content, /Report a bug found aside, tech debt, a follow-up of merged work or an idea to.*lead.*category/);
    if (role === 'implementer') {
      assert.match(clause.params.content, /Request review yourself/);
      assert.match(clause.params.content, /On a not-clear verdict/);
      assert.match(clause.params.content, /report only if blocked/);
    } else if (role === 'coordinator') {
      assert.match(clause.params.content, /first kind of the first level/);
      assert.match(clause.params.content, /lowest-ranked open, unblocked task of the first category/);
      assert.match(clause.params.content, /An epic in a category waits for promotion/);
      assert.match(clause.params.content, /With an empty.*idle_from.*never take category work/);
      assert.match(clause.params.content, /Merge on the hub’s `ready` status event/);
      assert.match(clause.params.content, /routine `report` messages appear in Watch/);
    } else if (role === 'qa' || role === 'reviewer') {
      assert.match(clause.params.content, /from the item’s lead .* or the Coordinator/);
    }

  }
});

test('a session with no role is refused at hello; the role the human assigns delivers its clause, and every reconnect delivers it again', async (t) => {
  let stopHub = async () => {};
  const serve = async (...args: Parameters<typeof projectHub>) => {
    const hub = await projectHub(...args);
    stopHub = hub.stop;
    return hub;
  };
  const root = await tempProject(t);
  await mkdir(join(root, '.agents/skills/code-review'), { recursive: true });
  await writeFile(join(root, '.agents/skills/code-review/SKILL.md'), '# Code review\n');
  await serve(t, root);
  // CLAND_ROLE alone grants nothing: only the human, or a launch for the role, does
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev-1', sessionId: 'sess-rev', role: 'reviewer', assignRole: false });
  t.after(() => spoke.close());
  await eventually('refused', () => (/no role: "rev-1" holds none/.test(spoke.log()) ? true : undefined));
  const who = await spoke.call<{ ok: boolean; error?: string }>('who');
  assert.equal(who.ok, false);
  assert.match(who.error ?? '', /no role: "rev-1" holds none .*cland role set rev-1/);
  assert.equal(spoke.events.length, 0);

  // the human assigns the role through the CLI: the session connects on its next retry and gets the clause
  const set = await cland(root, 'role', 'set', 'rev-1', 'reviewer');
  assert.equal(set.code, 0, set.stderr);
  assert.match(set.stdout, /^rev-1 \[Reviewer\] \(offline\): role set/);
  const clause = await spoke.waitForEvent(isClause, 30_000);
  assert.equal(clause.params.meta?.role, 'reviewer');
  assert.equal(clause.params.meta?.from, 'hub');
  assert.match(clause.params.content, /^cland hub: you hold the role Reviewer in this project, shown to others as rev-1 \[Reviewer\]/);
  assert.match(clause.params.content, /You are a Reviewer/);
  assert.match(clause.params.content, /Skills for this role: code-review\./);
  const me = (await spoke.call<{ sessions: Presence[] }>('who')).sessions.find((s) => s.name === 'rev-1');
  assert.deepEqual([me?.role, me?.label], ['reviewer', 'rev-1 [Reviewer]']);
  // the journal (the hub's log until #34) records the delivery, and the spoke's ack
  await flushProjectLogs(t, root);
  const [delivered] = await logEvents(root, 'role-clause');
  assert.equal(delivered?.session, 'rev-1');
  assert.equal(delivered?.role, 'reviewer');
  await eventually('acked', async () => ((await hubLog(root)).includes(`"event":"acked","id":"${String(delivered?.id)}"`) ? true : undefined));

  // a reconnect (the hub restarted; the spoke follows it): the clause again, a new delivery
  await stopHub();
  await serve(t, root);
  await eventually('the clause delivered again', () => (spoke.events.filter(isClause).length >= 2 ? true : undefined), 30_000);
  const again = spoke.events.filter(isClause)[1] as ChannelEvent;
  assert.notEqual(again.params.meta?.msg_id, clause.params.meta?.msg_id);
  assert.equal(again.params.content, clause.params.content);
  await flushProjectLogs(t, root);
  const deliveries = await logEvents(root, 'role-clause');
  assert.deepEqual(
    deliveries.map((d) => [d.session, d.reason]),
    [
      ['rev-1', 'hello'],
      ['rev-1', 'hello'],
    ],
  );
});

test('Coordinator is exclusive: a second assignment is refused with the reason; clearing the only holder raises the vacancy in one event', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await status(ui)).coordinator, null, 'no coordinator before anyone holds it');

  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'sess-coord', role: 'coordinator' });
  t.after(() => coord.close());
  const filled = await ui.waitFor((f) => f.type === 'role.filled', 30_000);
  assert.equal(filled.session, 'coord');
  assert.equal((await status(ui)).coordinator, 'coord');
  await coord.waitForEvent(isClause);
  const other = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl-1', sessionId: 'sess-impl' });
  t.after(() => other.close());
  await other.waitForPresence(['coord', 'impl-1']);

  // a second Coordinator: refused with the holder named, through the UI frame and the CLI
  const twice = await ui.request({ type: 'role.set', session: 'impl-1', role: 'coordinator' });
  assert.equal(twice.ok, false);
  assert.match(twice.error ?? '', /role "coordinator" is held by coord \[Coordinator\] \(live\): one session holds it at a time — clear it first with `cland role clear coord`/);
  const cli = await cland(root, 'role', 'set', 'impl-1', 'coordinator');
  assert.equal(cli.code, 1);
  assert.match(cli.stderr, /held by coord \[Coordinator\]/);
  // and a launch for it
  const launch = await ui.request({ type: 'session.launch', name: 'coord-2', role: 'coordinator' });
  assert.match(launch.error ?? '', /crew\.coordinator: singleton size 1 reached \(coord\)/);
  assert.equal((await status(ui)).sessions.find((s) => s.name === 'impl-1')?.role, 'implementer');

  // cland role list: each role with its defaults and holders
  const list = await cland(root, 'role', 'list');
  assert.equal(list.code, 0, list.stderr);
  assert.match(list.stdout, /^Coordinator \(one holder\)  launch: claude-code, model claude-fable-5-1, effort max, account harness default, permissions auto, approval harness default, sandbox harness default\n {2}coord \[Coordinator\]\n/);
  assert.match(list.stdout, /\nImplementer  launch: opencode, model harness default, effort harness default, account harness default, permissions harness default, approval never, sandbox danger-full-access\n {2}impl-1 \[Implementer\]\n/);
  assert.match(list.stdout, /\nReviewer  launch: codex, model gpt-6\.1-sol, effort high, account harness default, permissions harness default, approval never, sandbox read-only \(network: none\)\n {2}no holder\n/);
  assert.match(list.stdout, /\nQA  launch: codex, model gpt-6-astra, effort high, account harness default, permissions harness default, approval never, sandbox danger-full-access\n {2}no holder\n/);
  assert.match(list.stdout, /\ncoordinator: coord\n$/);

  // the human clears the only Coordinator: the vacancy is the very next role event, and status shows it
  const before = ui.frames.length;
  const cleared = await cland(root, 'role', 'clear', 'coord');
  assert.equal(cleared.code, 0, cleared.stderr);
  await ui.waitFor((f) => f.type === 'role.vacant');
  const events = ui.frames.slice(before).filter((f) => f.type === 'session.role' || String(f.type).startsWith('role.'));
  assert.deepEqual(
    events.map((f) => [f.type, f.session ?? f.role]),
    [
      ['session.role', 'coord'],
      ['role.vacant', 'coordinator'],
    ],
  );
  assert.equal((await status(ui)).coordinator, null);
  assert.match((await cland(root, 'hub', 'status')).stdout, /\nno coordinator\n/);
  assert.equal(((await ui.request({ type: 'session.list' })).value as { coordinator: string | null }).coordinator, null);
  // the former holder is told to stop acting in the role
  const revoked = await coord.waitForEvent((e) => isClause(e) && e.params.meta?.role === '');
  assert.match(revoked.params.content, /coord no longer holds the role Coordinator \(revoked by the human\)\. Stop acting as Coordinator/);

  // now another session may take it: filled again
  assert.equal((await ui.request({ type: 'role.set', session: 'impl-1', role: 'coordinator' })).ok, true);
  const refilled = await ui.waitFor((f) => f.type === 'role.filled' && f.session === 'impl-1');
  assert.equal(refilled.role, 'coordinator');
  const clause = await other.waitForEvent((e) => isClause(e) && e.params.meta?.role === 'coordinator');
  assert.match(clause.params.content, /You are the Coordinator/);
});

test('roles.toml: approval, sandbox, writable_roots and network of a launch are parsed, defaulted and checked (T-48)', (t) => {
  const launch = (lines: string) => parseRoles(`[qa.launch]\nharness = "codex"\n${lines}\n`).get('qa')?.launch;
  // nothing given (a roles.toml written before these keys existed): the role's built-in approval and sandbox, not none
  const qaSandbox = { mode: 'danger-full-access', writableRoots: [], network: 'full' };
  assert.deepEqual(launch(''), { harness: 'codex', account: null, model: null, effort: null, approval: 'never', sandbox: qaSandbox, permissions: null });
  const implementer = parseRoles('[implementer.launch]\nharness = "codex"\nmodel = "gpt-6.1-sol"\n').get('implementer')?.launch;
  assert.deepEqual([implementer?.approval, implementer?.sandbox], ['never', qaSandbox]);
  // the Coordinator has none built in
  assert.deepEqual(parseRoles('[coordinator.launch]\nharness = "codex"\n').get('coordinator')?.launch, { harness: 'codex', account: null, model: null, effort: null, approval: null, sandbox: null, permissions: null });
  // only what is written overrides, key by key
  assert.deepEqual(launch('approval = "on-request"'), { harness: 'codex', account: null, model: null, effort: null, approval: 'on-request', sandbox: qaSandbox, permissions: null });
  assert.deepEqual(launch('network = "full"')?.sandbox, { ...qaSandbox, network: 'full' });
  assert.deepEqual(launch('sandbox = "workspace-write"\nnetwork = "local"\nwritable_roots = [".", "../shared"]')?.sandbox, { mode: 'workspace-write', writableRoots: ['.', '../shared'], network: 'local' });
  assert.deepEqual(parseRoles('[implementer.launch]\nharness = "codex"\nsandbox = "workspace-write"\nnetwork = "local"\nwritable_roots = []\n').get('implementer')?.launch.sandbox, { mode: 'workspace-write', writableRoots: [], network: 'local' });
  // "" is the adapter's default approval and the harness's own sandbox
  assert.deepEqual(launch('approval = ""\nsandbox = ""'), { harness: 'codex', account: null, model: null, effort: null, approval: null, sandbox: null, permissions: null });
  // a written mode keeps what still fits it: no roots outside workspace-write, nothing closed without a sandbox
  assert.deepEqual(parseRoles('[implementer.launch]\nharness = "codex"\nsandbox = "read-only"\n').get('implementer')?.launch.sandbox, { mode: 'read-only', writableRoots: [], network: 'full' });
  assert.deepEqual(launch('sandbox = "read-only"\nnetwork = "none"')?.sandbox, { mode: 'read-only', writableRoots: [], network: 'none' });
  assert.deepEqual(launch('sandbox = "danger-full-access"')?.sandbox, { mode: 'danger-full-access', writableRoots: [], network: 'full' });
  // QA's restricted profile gets the runs and evidence directory (T-62, decision D14); a written list replaces it, and no other role gets one
  assert.deepEqual(launch('sandbox = "workspace-write"')?.sandbox, { mode: 'workspace-write', writableRoots: ['.cland/qa'], network: 'full' });
  assert.deepEqual(launch('sandbox = "workspace-write"\nwritable_roots = []')?.sandbox?.writableRoots, []);
  assert.deepEqual(launch('sandbox = "workspace-write"\nwritable_roots = ["."]')?.sandbox?.writableRoots, ['.']);
  assert.deepEqual(parseRoles('[implementer.launch]\nharness = "codex"\nsandbox = "workspace-write"\n').get('implementer')?.launch.sandbox?.writableRoots, []);

  assert.throws(() => launch('approval = "always"'), /qa\.launch\.approval must be one of never, on-request, untrusted/);
  assert.throws(() => launch('sandbox = "open"'), /qa\.launch\.sandbox must be one of read-only, workspace-write, danger-full-access/);
  assert.throws(() => launch('sandbox = "read-only"\nnetwork = "lan"'), /qa\.launch\.network must be one of none, local, full/);
  assert.throws(() => launch('sandbox = ""\nnetwork = "local"'), /qa\.launch\.writable_roots and qa\.launch\.network need qa\.launch\.sandbox/);
  assert.throws(() => launch('sandbox = "read-only"\nwritable_roots = ["."]'), /qa\.launch\.writable_roots needs sandbox = "workspace-write"/);
  assert.throws(() => launch('sandbox = "danger-full-access"\nnetwork = "none"'), /nothing is closed there/);

  // the defaults cland writes: Implementer and QA have full access, Reviewer stays read-only with no network
  const defaults = parseRoles(DEFAULT_ROLES_TOML);
  assert.deepEqual(
    ['coordinator', 'implementer', 'reviewer', 'qa'].map((r) => [defaults.get(r)?.launch.approval, defaults.get(r)?.launch.sandbox]),
    [
      [null, null],
      ['never', qaSandbox],
      ['never', { mode: 'read-only', writableRoots: [], network: 'none' }],
      ['never', qaSandbox],
    ],
  );
});
