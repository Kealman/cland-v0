// Roles as hub-held state (spec 4.4, ADR 0001, #29): `.cland/roles.toml`, assignment by the human (UI frames and the
// CLI), the clause delivered as a hub event on assignment and on every reconnect, Coordinator exclusivity and the
// vacancy warning, launches with a role's defaults. Against a real daemon in a temporary project: spokes over MCP,
// the UI on the Unix socket, the CLI as its own process, the fake Claude Code for launches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseRoles } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { MAX_TEXT_BYTES } from '../src/hub/hygiene.ts';
import { flushProjectLogs, assignRole, cland, clandWithEnv, clauseAnswered, connectUi, eventually, fakeClaude, spawnSpoke, startDaemon, tempProject, type ChannelEvent, type FrameClient } from './harness.ts';

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
const CLAUSE_REPLY_HEADROOM_BYTES = 512;

test('crew clauses describe category filing and the Aide speaking for the human', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  for (const role of ['coordinator', 'lead', 'implementer', 'reviewer', 'qa', 'aide']) {
    const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'crew-' + role, sessionId: 'sess-' + role, role });
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

for (const source of ['defaults', 'project'] as const) test(`${source} clause snapshots describe review before verification, the human queue and stopped-session lifecycle`, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'config.toml'), `[verification]\nlock_path = ${JSON.stringify(join(root, 'suite.lock'))}\n`);
  if (source === 'project') await writeFile(join(root, '.cland', 'roles.toml'), await readFile(new URL('../../.cland/roles.toml', import.meta.url), 'utf8'));
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  for (const role of ['coordinator', 'lead', 'implementer', 'reviewer', 'qa', 'aide']) {
    const name = 'queue-' + role;
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const spoke = await spawnSpoke({ discover: true, cwd: root, name, sessionId: 'queue-' + role, role });
    t.after(() => spoke.close());
    const clause = (await spoke.waitForEvent(isClause)).params.content;
    if (role === 'coordinator' || role === 'aide') assert.match(clause, /Tasks need `--size XS\|S\|M\|L\|XL`, a `## Summary` of 1–3 sentences and `--regression-of T-n`/);
    else assert.match(clause, /naming its size \(XS, S, M, L or XL\) and category/);
    const replyBytes = Buffer.byteLength(`pong: ${clause}`, 'utf8');
    assert.ok(replyBytes <= MAX_TEXT_BYTES - CLAUSE_REPLY_HEADROOM_BYTES,
      `${source} ${role}: clause reply is ${replyBytes} bytes; reserve ${CLAUSE_REPLY_HEADROOM_BYTES} below the ${MAX_TEXT_BYTES}-byte send cap`);
    assert.match(clause, /The human's own `npm test` waits in the same queue/, `${source} ${role}`);
    assert.match(clause, /sessions panel's `verify:` line.*`cland verify queue`/, `${source} ${role}`);
    if (role === 'coordinator' || role === 'lead' || role === 'implementer') {
      assert.match(clause, /Request review first[.;] (?:after a clear source verdict, the Implementer runs|When the verdict on your source is clear, run) `cland verify` at the exact reviewed head/);
      assert.match(clause, /needs a new review before a new run/);
      assert.match(clause, /tree-hash cache still lets an unchanged head reuse an earlier green run/);
      if (role === 'implementer') {
        assert.match(clause, /Before requesting review, fetch and merge origin\/dev/);
        assert.match(clause, /If a later merge changes that head, request a new review before verification/);
        assert.doesNotMatch(clause, /Send your review request before launching the suite|fix the findings, verify and push/);
      } else {
        assert.match(clause, /Wait for the same-head result and the Reviewer’s final verdict before merging/);
      }
    } else if (role === 'reviewer') {
      assert.match(clause, /Review source first, before the full verification run/);
      assert.match(clause, /source verdict at the exact reviewed `commit`/);
      assert.match(clause, /leaving run-dependent criteria unverified/);
      assert.match(clause, /check the same head and record the final verdict/);
      assert.match(clause, /a failed run is not clear/);
      assert.match(clause, /changed head needs a new source review before another run/);
      assert.match(clause, /tree-hash cache hit for an unchanged head is valid run evidence/);
    }
    if (role === 'coordinator') {
      assert.match(clause, /cland session resume <name> --relaunch/);
      assert.match(clause, /cland session resume <name> --fresh/);
      assert.match(clause, /cland session archive <name>/);
      assert.match(clause, /cland session prune --older-than 7d/);
      assert.match(clause, /journal is retained/i);
    }
  }
  const definitions = parseRoles(await readFile(join(root, '.cland', 'roles.toml'), 'utf8'));
  for (const tool of ['session.archive', 'session.prune']) assert.ok(definitions.get('coordinator')?.permissions.tools?.includes(tool), `${source}: ${tool}`);
});

test('roles.toml is written at the first start, and an edit changes the next launch: a role launch takes its defaults', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const file = join(root, '.cland', 'roles.toml');
  const written = await readFile(file, 'utf8');
  assert.match(written, /^# managed by cland/);
  for (const role of ['coordinator', 'implementer', 'reviewer', 'qa']) assert.match(written, new RegExp(`^\\[${role}\\]$`, 'm'));
  assert.match(written, /\[coordinator\.launch\]\nharness = "claude-code"\nmodel = "claude-fable-5-1"\neffort = "max"/);
  const ui = await connectUi(t, discovery);

  // a launch for a role, no harness or model given: the role's defaults
  const first = (await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator' }, 30_000)) as { ok: boolean; error?: string; value?: { process: { harnessId: string; harness: string; model: string; label: string } } };
  assert.equal(first.ok, true, first.error);
  assert.equal(first.value?.process.harness, 'claude-code');
  assert.equal(first.value?.process.label, 'coord [Coordinator]');
  assert.deepEqual(await fake.job(first.value?.process.harnessId as string).then((j) => [j.model, j.effort]), ['claude-fable-5-1', 'max']);
  assert.equal((await ui.request({ type: 'session.stop', session: 'coord' }, 15_000)).ok, true);

  // the human edits the file: the hub picks it up, and the next launch uses the new values
  await writeFile(file, written.replace('model = "claude-fable-5-1"\neffort = "max"', 'model = "claude-fake-edited"\neffort = "high"'));
  await eventually('the edit reloaded', async () => ((await logEvents(root, 'roles-loaded')).length >= 2 ? true : undefined));
  const second = (await ui.request({ type: 'session.launch', name: 'coord-2', role: 'coordinator' }, 30_000)) as { ok: boolean; error?: string; value?: { process: { harnessId: string } } };
  assert.equal(second.ok, true, second.error);
  assert.deepEqual(await fake.job(second.value?.process.harnessId as string).then((j) => [j.model, j.effort]), ['claude-fake-edited', 'high']);
  // given values win over the defaults
  assert.equal((await ui.request({ type: 'session.stop', session: 'coord-2' }, 15_000)).ok, true);
  const third = (await ui.request({ type: 'session.launch', name: 'coord-3', role: 'coordinator', model: 'claude-fake-given' }, 30_000)) as { ok: boolean; error?: string; value?: { process: { harnessId: string } } };
  assert.equal(third.ok, true, third.error);
  assert.deepEqual(await fake.job(third.value?.process.harnessId as string).then((j) => [j.model, j.effort]), ['claude-fake-given', 'high']);

  // a file that does not parse is logged; the last good version stays in force
  await writeFile(file, '[coordinator\nbroken');
  await eventually('the bad edit logged', async () => ((await logEvents(root, 'roles-unreadable')).length ? true : undefined));
  const list = (await ui.request({ type: 'role.list' })).value as { roles: Array<{ role: string; launch: { model: string | null } }> };
  assert.equal(list.roles.find((r) => r.role === 'coordinator')?.launch.model, 'claude-fake-edited');
  // the hub never rewrites an existing file
  assert.equal(await readFile(file, 'utf8'), '[coordinator\nbroken');
});

test('a session with no role is refused at hello; the role the human assigns delivers its clause, and every reconnect delivers it again', async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  // CLAND_ROLE alone grants nothing: only the human, or a launch for the role, does
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'rev-1', sessionId: 'sess-rev', role: 'reviewer', assignRole: false });
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
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root);
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
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await status(ui)).coordinator, null, 'no coordinator before anyone holds it');

  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', sessionId: 'sess-coord', role: 'coordinator' });
  t.after(() => coord.close());
  const filled = await ui.waitFor((f) => f.type === 'role.filled', 30_000);
  assert.equal(filled.session, 'coord');
  assert.equal((await status(ui)).coordinator, 'coord');
  await coord.waitForEvent(isClause);
  const other = await spawnSpoke({ discover: true, cwd: root, name: 'impl-1', sessionId: 'sess-impl' });
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
  assert.match(list.stdout, /^Coordinator \(one holder\)  launch: claude-code, claude-fable-5-1, effort max\n {2}coord \[Coordinator\]\n/);
  assert.match(list.stdout, /\nImplementer  launch: opencode, approval never, sandbox danger-full-access\n {2}impl-1 \[Implementer\]\n/);
  assert.match(list.stdout, /\nReviewer  launch: codex, gpt-6\.1-sol, effort high, approval never, sandbox read-only \(network: none\)\n {2}no holder\n/);
  assert.match(list.stdout, /\nQA  launch: codex, gpt-6-astra, effort high, approval never, sandbox danger-full-access\n {2}no holder\n/);
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

test('the holder leaving raises the vacancy; a launched Coordinator gets its clause as its first turn', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);

  const launched = (await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', model: 'claude-fake-1' }, 30_000)) as { ok: boolean; error?: string; value?: { process: { harnessId: string } } };
  assert.equal(launched.ok, true, launched.error);
  await ui.waitFor((f) => f.type === 'role.filled' && f.session === 'coord', 30_000);
  // the adapter injected the clause: the fake answers every turn
  await clauseAnswered(ui, 'coord');
  assert.match(await fake.log(launched.value?.process.harnessId as string), /submitted: <channel source="cland" from="hub" from_kind="hub"[^\n]*>\ncland hub: you hold the role Coordinator/);
  const listed = ((await ui.request({ type: 'session.list' })).value as { processes: Array<{ name: string; label: string }>; coordinator: string | null });
  assert.deepEqual([listed.processes[0]?.label, listed.coordinator], ['coord [Coordinator]', 'coord']);
  assert.match((await clandWithEnv(root, fake.env, 'session', 'list')).stdout, /^coord \[Coordinator\]  claude-code  running/);

  // stopped: no live Coordinator, and its role is vacant
  assert.equal((await ui.request({ type: 'session.stop', session: 'coord' }, 15_000)).ok, true);
  await ui.waitFor((f) => f.type === 'role.vacant');
  assert.equal((await status(ui)).coordinator, null);
  const roles = (await ui.request({ type: 'role.list' })).value as { roles: Array<{ role: string; holders: unknown[] }> };
  assert.deepEqual(roles.roles.find((r) => r.role === 'coordinator')?.holders, []);
  // so another session may take it
  await assignRole(root, 'coord-b', 'coordinator');
});

test('roles.toml: approval, sandbox, writable_roots and network of a launch are parsed, defaulted and checked (T-48)', () => {
  const launch = (lines: string) => parseRoles(`[qa.launch]\nharness = "codex"\n${lines}\n`).get('qa')?.launch;
  // nothing given (a roles.toml written before these keys existed): the role's built-in approval and sandbox, not none
  const qaSandbox = { mode: 'danger-full-access', writableRoots: [], network: 'full' };
  assert.deepEqual(launch(''), { harness: 'codex', model: null, effort: null, approval: 'never', sandbox: qaSandbox, permissions: null });
  const implementer = parseRoles('[implementer.launch]\nharness = "codex"\nmodel = "gpt-6.1-sol"\n').get('implementer')?.launch;
  assert.deepEqual([implementer?.approval, implementer?.sandbox], ['never', qaSandbox]);
  // the Coordinator has none built in
  assert.deepEqual(parseRoles('[coordinator.launch]\nharness = "codex"\n').get('coordinator')?.launch, { harness: 'codex', model: null, effort: null, approval: null, sandbox: null, permissions: null });
  // only what is written overrides, key by key
  assert.deepEqual(launch('approval = "on-request"'), { harness: 'codex', model: null, effort: null, approval: 'on-request', sandbox: qaSandbox, permissions: null });
  assert.deepEqual(launch('network = "full"')?.sandbox, { ...qaSandbox, network: 'full' });
  assert.deepEqual(launch('sandbox = "workspace-write"\nnetwork = "local"\nwritable_roots = [".", "../shared"]')?.sandbox, { mode: 'workspace-write', writableRoots: ['.', '../shared'], network: 'local' });
  assert.deepEqual(parseRoles('[implementer.launch]\nharness = "codex"\nsandbox = "workspace-write"\nnetwork = "local"\nwritable_roots = []\n').get('implementer')?.launch.sandbox, { mode: 'workspace-write', writableRoots: [], network: 'local' });
  // "" is the adapter's default approval and the harness's own sandbox
  assert.deepEqual(launch('approval = ""\nsandbox = ""'), { harness: 'codex', model: null, effort: null, approval: null, sandbox: null, permissions: null });
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
