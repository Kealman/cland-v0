// Roles as hub-held state (spec 4.4, ADR 0001, #29): `.cland/roles.toml`, assignment by the human (UI frames and the
// CLI), the clause delivered as a hub event on assignment and on every reconnect, Coordinator exclusivity and the
// vacancy warning, launches with a role's defaults. Against a real daemon in a temporary project: spokes over MCP,
// the UI on the Unix socket, the CLI as its own process, the fake Claude Code for launches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseRoles } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { assignRole, cland, clandWithEnv, clauseAnswered, connectUi, eventually, fakeClaude, spawnSpoke, startDaemon, tempProject, type ChannelEvent, type FrameClient } from './harness.ts';

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
  assert.match(launch.error ?? '', /held by coord \[Coordinator\]/);
  assert.equal((await status(ui)).sessions.find((s) => s.name === 'impl-1')?.role, 'implementer');

  // cland role list: each role with its defaults and holders
  const list = await cland(root, 'role', 'list');
  assert.equal(list.code, 0, list.stderr);
  assert.match(list.stdout, /^Coordinator \(one holder\)  launch: claude-code, claude-fable-5-1, effort max\n {2}coord \[Coordinator\]\n/);
  assert.match(list.stdout, /\nImplementer  launch: opencode, approval never, sandbox workspace-write \(writable: \.; network: local\)\n {2}impl-1 \[Implementer\]\n/);
  assert.match(list.stdout, /\nReviewer  launch: codex, gpt-6\.1-sol, effort high, approval never, sandbox read-only \(network: none\)\n {2}no holder\n/);
  assert.match(list.stdout, /\nQA  launch: codex, gpt-6-astra, effort high, approval never, sandbox workspace-write \(network: local\)\n {2}no holder\n/);
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
  const qaSandbox = { mode: 'workspace-write', writableRoots: [], network: 'local' };
  assert.deepEqual(launch(''), { harness: 'codex', model: null, effort: null, approval: 'never', sandbox: qaSandbox });
  const implementer = parseRoles('[implementer.launch]\nharness = "codex"\nmodel = "gpt-6.1-sol"\n').get('implementer')?.launch;
  assert.deepEqual([implementer?.approval, implementer?.sandbox], ['never', { mode: 'workspace-write', writableRoots: ['.'], network: 'local' }]);
  // the Coordinator has none built in
  assert.deepEqual(parseRoles('[coordinator.launch]\nharness = "codex"\n').get('coordinator')?.launch, { harness: 'codex', model: null, effort: null, approval: null, sandbox: null });
  // only what is written overrides, key by key
  assert.deepEqual(launch('approval = "on-request"'), { harness: 'codex', model: null, effort: null, approval: 'on-request', sandbox: qaSandbox });
  assert.deepEqual(launch('network = "full"')?.sandbox, { ...qaSandbox, network: 'full' });
  assert.deepEqual(launch('writable_roots = [".", "../shared"]')?.sandbox, { ...qaSandbox, writableRoots: ['.', '../shared'] });
  assert.deepEqual(parseRoles('[implementer.launch]\nharness = "codex"\nwritable_roots = []\n').get('implementer')?.launch.sandbox, { mode: 'workspace-write', writableRoots: [], network: 'local' });
  // "" is the adapter's default approval and the harness's own sandbox
  assert.deepEqual(launch('approval = ""\nsandbox = ""'), { harness: 'codex', model: null, effort: null, approval: null, sandbox: null });
  // a written mode keeps what still fits it: no roots outside workspace-write, nothing closed without a sandbox
  assert.deepEqual(parseRoles('[implementer.launch]\nharness = "codex"\nsandbox = "read-only"\n').get('implementer')?.launch.sandbox, { mode: 'read-only', writableRoots: [], network: 'local' });
  assert.deepEqual(launch('sandbox = "read-only"\nnetwork = "none"')?.sandbox, { mode: 'read-only', writableRoots: [], network: 'none' });
  assert.deepEqual(launch('sandbox = "danger-full-access"')?.sandbox, { mode: 'danger-full-access', writableRoots: [], network: 'full' });

  assert.throws(() => launch('approval = "always"'), /qa\.launch\.approval must be one of never, on-request, untrusted/);
  assert.throws(() => launch('sandbox = "open"'), /qa\.launch\.sandbox must be one of read-only, workspace-write, danger-full-access/);
  assert.throws(() => launch('sandbox = "read-only"\nnetwork = "lan"'), /qa\.launch\.network must be one of none, local, full/);
  assert.throws(() => launch('sandbox = ""\nnetwork = "local"'), /qa\.launch\.writable_roots and qa\.launch\.network need qa\.launch\.sandbox/);
  assert.throws(() => launch('sandbox = "read-only"\nwritable_roots = ["."]'), /qa\.launch\.writable_roots needs sandbox = "workspace-write"/);
  assert.throws(() => launch('sandbox = "danger-full-access"\nnetwork = "none"'), /nothing is closed there/);

  // the defaults cland writes: no Codex role waits on an approval; only the Implementer writes outside its directory
  const defaults = parseRoles(DEFAULT_ROLES_TOML);
  assert.deepEqual(
    ['coordinator', 'implementer', 'reviewer', 'qa'].map((r) => [defaults.get(r)?.launch.approval, defaults.get(r)?.launch.sandbox]),
    [
      [null, null],
      ['never', { mode: 'workspace-write', writableRoots: ['.'], network: 'local' }],
      ['never', { mode: 'read-only', writableRoots: [], network: 'none' }],
      ['never', { mode: 'workspace-write', writableRoots: [], network: 'local' }],
    ],
  );
});
