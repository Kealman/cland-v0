// T2: role snapshots and permission refreshes in-process; slow CLI coverage is in roles-snapshot-cli.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseRoles, RolesFile, ROLES_REFRESH_MS } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { decide } from '../src/roles/permissions.ts';
import { createHubBase } from '../src/hub/server.ts';
import { RequestGuard } from '../src/hub/budget.ts';
import { cland, connectUi, eventually, projectHub, tempProject } from './harness.ts';

const rolesText = (tools: string[]) => `[implementer.launch]\nharness = "codex"\n[implementer.permissions]\ntools = ${JSON.stringify(tools)}\n`;

test('default and project clauses route shared-defect candidates through one Coordinator fix', async () => {
  for (const text of [DEFAULT_ROLES_TOML, await readFile(new URL('../../.cland/roles.toml', import.meta.url), 'utf8')]) {
    const roles = parseRoles(text);
    assert.match(roles.get('implementer')!.clause, /On a `shared-defect` candidate, report the flagged test and run to `lead T-<n>` in your item topic and hold diagnosis/);
    assert.match(roles.get('coordinator')!.clause, /Triage `shared-defect` candidates and post one reviewed shared fix to affected item leads/);
  }
});

test('default and project clauses pin category filing and idle work without adding tool grants', async () => {
  const defaults = parseRoles(DEFAULT_ROLES_TOML);
  const project = parseRoles(await readFile(new URL('../../.cland/roles.toml', import.meta.url), 'utf8'));
  for (const role of ['coordinator', 'lead', 'implementer', 'reviewer', 'qa', 'aide']) {
    const filing = defaults.get(role)!.clause.split('\n').find(line => line.startsWith('- File category work:') || line.startsWith('- Report a bug found aside'));
    assert.ok(filing, role);
    if (role === 'coordinator' || role === 'aide') {
      assert.match(filing, /Tasks need `--size XS\|S\|M\|L`, a `## Summary` of 1–3 sentences and `--regression-of T-n` for rework of landed tasks/);
    } else assert.match(filing, /naming its size \(XS, S, M, L or XL\) and category/);
    assert.ok(project.get(role)!.clause.split('\n').includes(filing), `${role}: project clause has the same filing rule`);
    if (!['coordinator', 'aide'].includes(role)) {
      for (const definitions of [defaults, project]) {
        assert.ok(!definitions.get(role)!.permissions.tools.includes('task.create'));
        assert.ok(!definitions.get(role)!.permissions.tools.includes('task.link'));
      }
    }
  }
  for (const definitions of [defaults, project]) {
    assert.match(definitions.get('coordinator')!.clause, /first kind of the first level/);
    assert.match(definitions.get('coordinator')!.clause, /An epic in a category waits for promotion/);
    assert.match(definitions.get('lead')!.clause, /merges outside any Lead's subtree, including categories and unscheduled items/);
  }
});

test('default and project Reviewer clauses pin the review scope rule', async () => {
  const rule = 'Give `scope` full for a first review or reworked design, delta after `dev` moved under a reviewed branch, evidence for suite evidence alone.';
  for (const text of [DEFAULT_ROLES_TOML, await readFile(new URL('../../.cland/roles.toml', import.meta.url), 'utf8')]) {
    assert.ok(parseRoles(text).get('reviewer')!.clause.includes(rule));
  }
});

test('roles edits refresh within 500 ms plus async I/O, and malformed or missing edits retain the last good permissions', async t => {
  const root = await tempProject(t);
  const dir = join(root, '.cland');
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'roles.toml');
  await writeFile(path, rolesText(['who']));
  const records: Array<Record<string, unknown>> = [];
  const roles = new RolesFile(path, entry => records.push(entry));
  t.after(() => roles.stop());
  t.mock.timers.enable({ apis: ['setInterval'] });
  await roles.start();
  const old = roles.get();
  await writeFile(path, rolesText([]));
  assert.equal(roles.get(), old, 'checks do not pull a new version from disk');
  t.mock.timers.tick(ROLES_REFRESH_MS);
  await eventually('edit published', () => roles.get() !== old ? true : undefined);
  assert.equal(decide('implementer', roles.get().get('implementer')?.permissions.tools, { tool: 'who' }).ok, false);
  assert.equal(decide('implementer', old.get('implementer')?.permissions.tools, { tool: 'who' }).ok, true, 'an existing snapshot never mutates');
  const good = roles.get();
  await writeFile(path, '[broken');
  t.mock.timers.tick(ROLES_REFRESH_MS);
  await eventually('parse failure reported', () => records.some(r => r.event === 'roles-unreadable') ? true : undefined);
  assert.equal(roles.get(), good);
  await rm(path);
  t.mock.timers.tick(ROLES_REFRESH_MS);
  await eventually('missing file reported', () => records.some(r => r.event === 'roles-missing') ? true : undefined);
  assert.equal(roles.get(), good);
  await writeFile(path, rolesText(['who']));
  t.mock.timers.tick(ROLES_REFRESH_MS);
  await eventually('valid edit recovered', () => roles.get() !== good ? true : undefined);
});

test('permission dispatch rechecks the latest snapshot when a file edit lands during deferred artifact preparation', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland', 'roles.toml');
  const text = (tools: string[]) => `[coordinator.launch]\nharness = "codex"\n[coordinator.permissions]\ntools = ${JSON.stringify(tools)}\n`;
  await writeFile(path, text(['artifact.create']));
  const roles = new RolesFile(path);
  t.after(() => roles.stop());
  t.mock.timers.enable({ apis: ['setInterval'] });
  await roles.start();
  let entered!: () => void;
  let release!: () => void;
  const reading = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  t.after(() => release());
  const source = join(root, 'brief.md');
  await writeFile(source, 'Brief');
  const hub = createHubBase({ secret: 'test', roles,
    // Providing the artifact root also starts executor reconciliation; keep its
    // state and lock identity inside this in-process fixture.
    env: { ...process.env, DIGITALOCEAN_TOKEN: '', CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state') },
    droplet: { processes: { alive: pid => pid === process.pid, started: () => null } },
    readArtifact: async path => { const bytes = await readFile(path); entered(); await gate; return bytes; },
    control: { status: () => ({ pid: process.pid, port: 0, socket: '', version: 'test', root, startedAt: new Date().toISOString(), uptimeMs: 0 }), stop: () => {} },
  });
  t.after(() => hub.close());
  const answers: Array<Record<string, unknown>> = [];
  const conversation = hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  t.after(() => conversation.closed());
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'test' }));
  conversation.receive(JSON.stringify({ type: 'role.set', id: 'role', session: 'coord', role: 'coordinator' }));
  await eventually('role assigned', () => answers.find(frame => frame.id === 'role'));
  conversation.receive(JSON.stringify({ type: 'artifact.create', id: 'create', as: { name: 'coord' }, kind: 'prompt', title: 'Brief', topic: 'general', path: source, status: 'draft' }));
  await reading;
  const before = roles.get();
  await writeFile(path, text([]));
  t.mock.timers.tick(ROLES_REFRESH_MS);
  await eventually('revocation published during the request', () => roles.get() !== before ? true : undefined);
  release();
  const result = await eventually('deferred request answered', () => answers.find(frame => frame.id === 'create'));
  assert.equal(result.code, 'forbidden');
  assert.deepEqual(hub.core.store.artifacts(), [], 'no artifact published under the revoked grant');
});

test('a deferred roles read leaves checks on the last snapshot and stop prevents late publication', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland', 'roles.toml');
  await writeFile(path, rolesText(['who']));
  let resolveRead!: (text: string) => void;
  let entered!: () => void;
  const reading = new Promise<void>(resolve => { entered = resolve; });
  let first = true;
  const roles = new RolesFile(path, undefined, async path => {
    if (first) { first = false; return readFile(path, 'utf8'); }
    entered();
    return new Promise<string>(resolve => { resolveRead = resolve; });
  });
  t.mock.timers.enable({ apis: ['setInterval'] });
  await roles.start();
  const snapshot = roles.get();
  t.mock.timers.tick(ROLES_REFRESH_MS);
  await reading;
  assert.equal(roles.get(), snapshot);
  const stopped = roles.stop();
  resolveRead(rolesText([]));
  await stopped;
  assert.equal(roles.get(), snapshot, 'a stopped source cannot publish a delayed read');
});

test('an explicit fresh snapshot waits out an old in-flight read and sees an edit saved before launch', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland', 'roles.toml');
  await writeFile(path, rolesText(['who']));
  let entered!: () => void;
  let release!: () => void;
  const reading = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  const roles = new RolesFile(path, undefined, async path => {
    const text = await readFile(path, 'utf8');
    if (++reads === 2) { entered(); await gate; }
    return text;
  });
  t.after(() => roles.stop());
  t.after(() => release());
  t.mock.timers.enable({ apis: ['setInterval'] });
  await roles.start();
  t.mock.timers.tick(ROLES_REFRESH_MS);
  await reading;
  await writeFile(path, rolesText([]));
  const old = roles.get();
  const fresh = roles.fresh();
  assert.equal(roles.get(), old, 'hot checks continue without waiting on the rare fresh read');
  release();
  await fresh;
  assert.equal(decide('implementer', roles.get().get('implementer')?.permissions.tools, { tool: 'who' }).ok, false);
});

test('fresh retries a failed read without another file edit and times its synchronous failure once', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland', 'roles.toml');
  await writeFile(path, rolesText(['who']));
  let reads = 0;
  let clock = 0;
  const guard = new RequestGuard({ now: () => clock });
  const roles = new RolesFile(path, entry => { if (entry.event === 'roles-unreadable') clock += 400; }, path => {
    if (++reads === 2) throw new Error('temporary read failure');
    return readFile(path, 'utf8');
  });
  t.after(() => roles.stop());
  t.mock.timers.enable({ apis: ['setInterval'] });
  await roles.start();
  await writeFile(path, rolesText([]));
  await roles.fresh(guard.resumer('session.launch'));
  assert.equal(guard.counters.slow, 1, 'one failure reporter belongs to one continuation');
  await roles.fresh(guard.resumer('session.launch'));
  assert.equal(reads, 3, 'a stat cannot stand in for a successful read');
  assert.equal(decide('implementer', roles.get().get('implementer')?.permissions.tools, { tool: 'who' }).ok, false);
});

test('a roles refresh invalidates repeated read answers before the next permission check', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland', 'roles.toml');
  await writeFile(path, rolesText(['history']));
  const roles = new RolesFile(path);
  t.after(() => roles.stop());
  t.mock.timers.enable({ apis: ['setInterval'] });
  await roles.start();
  const hub = createHubBase({ secret: 'test', roles, guard: { now: () => 0 } });
  t.after(() => hub.close());
  const answers: Array<Record<string, unknown>> = [];
  const conversation = hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  t.after(() => conversation.closed());
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: 'test', client: 'test' }));
  conversation.receive(JSON.stringify({ type: 'role.set', id: 'role', session: 'impl', role: 'implementer' }));
  await eventually('role assigned', () => answers.find(frame => frame.id === 'role'));
  const request = (id: string) => conversation.receive(JSON.stringify({ type: 'artifact.list', id, as: { name: 'impl' } }));
  request('before');
  assert.equal((await eventually('first answer', () => answers.find(frame => frame.id === 'before'))).ok, true);
  request('repeat');
  assert.equal((await eventually('repeated answer', () => answers.find(frame => frame.id === 'repeat'))).ok, true);
  const old = roles.get();
  await writeFile(path, rolesText([]));
  t.mock.timers.tick(ROLES_REFRESH_MS);
  await eventually('revocation published', () => roles.get() !== old ? true : undefined);
  request('after');
  assert.equal((await eventually('fresh answer', () => answers.find(frame => frame.id === 'after'))).code, 'forbidden');
});

test('roles refresh publication and failure logging are each timed as resumed background work', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland', 'roles.toml');
  await writeFile(path, rolesText(['who']));
  let clock = 0;
  let armed = false;
  const records: Array<Record<string, unknown>> = [];
  const guard = new RequestGuard({ now: () => clock, log: entry => records.push(entry) });
  const roles = new RolesFile(path, entry => { if (armed) clock += 400; records.push(entry); }, undefined, guard.resumer('roles.refresh'));
  t.after(() => roles.stop());
  t.mock.timers.enable({ apis: ['setInterval'] });
  await roles.start();
  armed = true;
  await writeFile(path, '[broken');
  t.mock.timers.tick(ROLES_REFRESH_MS);
  await eventually('failure timed', () => guard.counters.slow === 1 ? true : undefined);
  await writeFile(path, rolesText([]));
  t.mock.timers.tick(ROLES_REFRESH_MS);
  await eventually('publication timed', () => guard.counters.slow === 2 ? true : undefined);
  assert.deepEqual(records.filter(entry => entry.event === 'slow-request').map(entry => [entry.tool, entry.phase, entry.ms]), [['roles.refresh', 'resumed', 400], ['roles.refresh', 'resumed', 400]]);
});


test('OpenCode role snapshots warn once for ignored keys in validation and role list', { timeout: 2000 }, async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const path = join(root, '.cland/roles.toml');
  await writeFile(path, '[implementer.launch]\nharness = "opencode"\napproval = "never"\nsandbox = "read-only"\npermissions = "skip"\n');
  const ui = await connectUi(t, discovery);
  const reload = await ui.request({ type: 'hub.reload' });
  assert.equal(reload.ok, true, reload.error);
  const warning = "implementer.launch: OpenCode ignores approval, sandbox, permissions; OpenCode's own configuration governs";
  assert.deepEqual((reload.value as { warnings: string[] }).warnings, [warning]);
  const list = await cland(root, 'role', 'list');
  assert.equal(list.code, 0, list.stderr);
  assert.match(list.stdout, /Implementer  launch: opencode, .*guard: OpenCode's own\n/);
  assert.equal(list.stdout.split(warning).length - 1, 1);
  const records: Array<Record<string, unknown>> = [];
  const file = new RolesFile(path, entry => records.push(entry));
  t.after(() => file.stop());
  await file.start();
  await file.fresh();
  await file.fresh();
  assert.deepEqual(records.filter(row => row.event === 'roles-warning').map(row => row.warning), [warning]);
  const launch = file.get().get('implementer')!.launch;
  assert.deepEqual([launch.approval, launch.sandbox, launch.permissions], [null, null, null]);
});
