// T3: native launch defaults and Coordinator first-turn clause ordering.
// Roles as hub-held state (spec 4.4, ADR 0001, #29): `.cland/roles.toml`, assignment by the human (UI frames and the
// CLI), the clause delivered as a hub event on assignment and on every reconnect, Coordinator exclusivity and the
// vacancy warning, launches with a role's defaults. Against a real project hub in a temporary project: spokes over MCP,
// the UI on the Unix socket, the CLI as its own process, the fake Claude Code for launches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseRoles } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { roleClauseSections } from '../src/roles/clause.ts';
import { assignRole, clandWithEnv, clauseAnswered, connectUi, eventually, fakeClaude, nativeProjectHub as projectHub, spawnSpoke, tempProject, type ChannelEvent, type FrameClient } from './harness.ts';

type Presence = { name: string; role: string | null; label?: string };

type Status = { sessions: Presence[]; coordinator: string | null; harnesses: Array<{ name: string; harnessId: string | null; role: string | null; label?: string; model: string | null }> };

const hubLog = (root: string) => readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');

const logEvents = async (root: string, event: string) =>
  (await hubLog(root))
    .split('\n')
    .filter((l) => l.includes(`"event":"${event}"`))
    .map((l) => JSON.parse(l) as Record<string, unknown>);

async function status(ui: FrameClient): Promise<Status> {
  const r = await ui.request({ type: 'hub.status', history: true });
  assert.equal(r.ok, true, r.error);
  return r.value as Status;
}

const isClause = (e: ChannelEvent) => e.params.meta?.kind === 'role';

for (const source of ['defaults', 'project'] as const) test(`${source} shipped clauses and rule guidance reach each assigned role`, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'config.toml'), `[verification]\nlock_path = ${JSON.stringify(join(root, 'suite.lock'))}\n`);
  if (source === 'project') await writeFile(join(root, '.cland', 'roles.toml'), await readFile(new URL('../../.cland/roles.toml', import.meta.url), 'utf8'));
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  for (const role of ['coordinator', 'lead', 'implementer', 'reviewer', 'qa', 'aide']) {
    const name = 'queue-' + role;
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const spoke = await spawnSpoke({ discover: true, cwd: root, name, sessionId: 'queue-' + role, role });
    t.after(() => spoke.close());
    const clause = (await spoke.waitForEvent(isClause)).params.content;
    // Wording and the byte reserve are pinned in roles-clauses.test.ts (T1).
    // This integration claim is that the assigned role's actual clause reaches the spoke.
    const definitions = parseRoles(source === 'defaults' ? DEFAULT_ROLES_TOML
      : await readFile(new URL('../../.cland/roles.toml', import.meta.url), 'utf8'));
    const [baseClause, rulesSection] = clause.split('\n\nProject rules for your role\n');
    assert.ok(baseClause!.includes(roleClauseSections(definitions.get(role)!.clause).base), `${source} ${role}: shipped base delivered`);
    assert.ok(rulesSection, `${source} ${role}: project rules section is present`);
    const { guidance } = roleClauseSections(definitions.get(role)!.clause);
    if (guidance) assert.ok(rulesSection.includes(guidance), `${source} ${role}: shipped rule guidance delivered`);
  }

});

test('roles.toml is written at the first start, and an edit changes the next launch: a role launch takes its defaults', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
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

test('the holder leaving raises the vacancy; a launched Coordinator gets its clause as its first turn', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
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
