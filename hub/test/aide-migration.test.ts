// T2: startup migration through real frames, with an in-process hub and fake harnesses.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { parseRoles } from '../src/roles/config.ts';
import { FakeClock } from './fake-clock.ts';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';

const oldRestriction = '- You cannot ask the human, resolve a topic\'s wait, launch, stop or resume sessions, merge, hand over a role, release, sync or `cland push`: the Coordinator owns those operations.';
const oldTools = ['rule.add', 'rule.edit', 'rule.retire', 'rule.list', 'task.plan', 'task.create', 'task.edit', 'task.close', 'task.link', 'task.comment', 'task.claim', 'task.criterion', 'task.view', 'task.list', 'artifact.create', 'artifact.keep', 'artifact.move', 'artifact.archive', 'artifact.promote', 'send', 'topic.create', 'history', 'who', 'status'];
const addedTools = ['session.launch', 'session.stop', 'session.resume', 'task.import', 'push'];
const mark = '# cland: aide-tools-0.1.4 migrated';
const before = `# human settings\n[aide]\nclause = '''\nMy introduction.\n${oldRestriction}\nMy closing line.\n'''\n[aide.launch]\nharness = "claude-code"\nmodel = "my-model" # keep\n[aide.permissions] # grants\ntools = ${JSON.stringify(oldTools)} # keep tools comment\n[qa.launch]\nharness = "codex"\n`;

test('startup migrates the shipped Aide restriction with one Agents notice', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, before);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const after = await readFile(path, 'utf8');
  const roles = parseRoles(after);
  assert.deepEqual(roles.get('aide')!.permissions.tools, [...oldTools, ...addedTools]);
  assert.ok(after.includes(`[aide.permissions] # grants\n${mark}\n`), after);
  const clause = roles.get('aide')!.clause;
  assert.ok(!clause.includes(oldRestriction));
  assert.match(clause, /On the human's word, launch, stop and resume/);
  assert.match(clause, /During a build the Coordinator keeps the crew's staffing/);
  assert.match(clause, /cland task import-github/);
  assert.match(clause, /cland push/);
  assert.ok(clause.startsWith('My introduction.\n'));
  assert.ok(clause.endsWith('\nMy closing line.'));
  assert.ok(after.endsWith('# keep tools comment\n[qa.launch]\nharness = "codex"\n'));
  assert.ok(after.includes('model = "my-model" # keep\n'));
  const ui = await connectUi(t, discovery);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.equal(history.ok, true, history.error);
  const notices = (history.value as { messages: Array<{ kind: string; text: string }> }).messages.filter(m => m.kind === 'aide-tools-migration');
  assert.equal(notices.length, 1, JSON.stringify(history.value));
  for (const tool of addedTools) assert.ok(notices[0]!.text.includes(tool));
  assert.match(notices[0]!.text, /next launch/);
});

test('later starts leave the marked file untouched after a human removes a grant', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, before);
  const first = await projectHub(t, root, {}, { clock: new FakeClock() });
  const migrated = await readFile(path, 'utf8');
  assert.ok(migrated.includes(mark));
  await first.stop();
  for (const text of [migrated, migrated.replace(',"session.launch"', '')]) {
    await writeFile(path, text);
    const stamp = await stat(path);
    const next = await projectHub(t, root, {}, { clock: new FakeClock() });
    assert.equal(await readFile(path, 'utf8'), text);
    const after = await stat(path);
    assert.deepEqual([after.ino, after.mtime.toISOString()], [stamp.ino, stamp.mtime.toISOString()]);
    const ui = await connectUi(t, next.discovery);
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    assert.equal((history.value as { messages: Array<{ kind: string }> }).messages.filter(m => m.kind === 'aide-tools-migration').length, 1);
    ui.close();
    await next.stop();
  }
});

test('startup leaves inherited, complete and invalid permissions files unchanged', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  for (const text of [
    '[aide.launch]\nharness = "codex"\n[aide.permissions]\n# inherited tools\n',
    '[aide.launch]\nharness = "codex"\n[aide.permissions]\ntools = ["session.launch", "session.stop", "session.resume", "task.import", "push"]\n',
    '[aide.permissions]\ntools = ["send",\n',
  ]) {
    await writeFile(path, text);
    const stamp = await stat(path);
    const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
    assert.equal(await readFile(path, 'utf8'), text);
    const after = await stat(path);
    assert.deepEqual([after.ino, after.mtime.toISOString()], [stamp.ino, stamp.mtime.toISOString()]);
    const ui = await connectUi(t, hub.discovery);
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    const notices = (history.value as { messages: Array<{ kind: string; text: string }> }).messages.filter(m => m.kind === 'aide-tools-migration');
    if (text.endsWith(',\n')) {
      assert.equal(notices.length, 1);
      assert.match(notices[0]!.text, /waits for a valid file/);
    } else assert.equal(notices.length, 0);
    ui.close();
    await hub.stop();
  }
});

test('the migrated Aide can launch a session through its shell frame', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, before);
  const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'aide-1', role: 'aide', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const { process } = launched.value as { process: { sessionId: string } };
  const aide = await inProcessSpoke(t, { cwd: root, discover: true, name: 'aide-1', sessionId: process.sessionId, assignRole: false });
  await aide.waitForPresence(['aide-1']);
  const cli = await connectUi(t, discovery, 'cli');
  const result = await cli.request({ type: 'session.launch', as: { name: 'aide-1', sessionId: process.sessionId, shell: true }, name: 'worker', role: 'implementer', harness: 'claude-code' });
  assert.equal(result.ok, true, result.error);
  assert.equal(fakes['claude-code']!.spawns.at(-1)?.name, 'worker');
  assert.equal(fakes['claude-code']!.spawns.at(-1)?.role, 'implementer');
});

test('startup names a customized Aide clause for human review', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  const custom = before.replace(oldRestriction, 'My custom staffing policy.');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, custom);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  assert.equal(parseRoles(await readFile(path, 'utf8')).get('aide')!.clause, 'My introduction.\nMy custom staffing policy.\nMy closing line.');
  const ui = await connectUi(t, discovery);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const notices = (history.value as { messages: Array<{ kind: string; text: string }> }).messages.filter(m => m.kind === 'aide-tools-migration');
  assert.equal(notices.length, 1);
  assert.match(notices[0]!.text, /custom Aide clause was kept; review it/);
});

test('a denied migration publication cannot start a hub with default role policy', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  const restricted = '[aide.launch]\nharness = "codex"\nmodel = "human-model"\n[aide.permissions]\ntools = ["who"]\n';
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, restricted);
  const rename = fs.rename;
  // System-boundary fault: the real atomic writer reaches a denied rename.
  let denied = false;
  t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    if (args[1] === path) { denied = true; throw Object.assign(new Error('migration publish denied'), { code: 'EACCES' }); }
    return rename(...args);
  });
  syncBuiltinESMExports();
  try {
    const events: Array<Record<string, unknown>> = [];
    await assert.rejects(projectHub(t, root, {}, { clock: new FakeClock(), log: entry => events.push(entry) }), /migration.*publish.*denied/);
    assert.equal(denied, true);
    assert.equal(await readFile(path, 'utf8'), restricted);
    await assert.rejects(stat(join(root, '.cland/hub.json')), { code: 'ENOENT' }, 'no hub can serve fallback grants');
    assert.equal(events.some(entry => entry.event === 'aide-tools-migration-failed'), true);
    assert.equal(events.some(entry => entry.event === 'roles-unreadable'), false, 'valid source is not reported as invalid');
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
});

test('a concurrent roles edit stops startup without replacing the human policy', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/roles.toml');
  const restricted = '[aide.launch]\nharness = "codex"\nmodel = "human-model"\n[aide.permissions]\ntools = ["who"]\n';
  const edited = restricted.replace('human-model', 'new-human-model').replace('["who"]', '["history"]');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, restricted);
  const read = fs.readFile;
  let reads = 0;
  // System-boundary race: a valid edit arrives at the atomic writer's read-back.
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    if (args[0] === path && ++reads === 2) await writeFile(path, edited);
    return read(...args);
  });
  syncBuiltinESMExports();
  try {
    const events: Array<Record<string, unknown>> = [];
    await assert.rejects(projectHub(t, root, {}, { clock: new FakeClock(), log: entry => events.push(entry) }), /hub startup stopped.*roles.toml changed while setting it/);
    assert.ok(reads >= 2, 'the writer observed the concurrent edit');
    assert.equal(await readFile(path, 'utf8'), edited);
    await assert.rejects(stat(join(root, '.cland/hub.json')), { code: 'ENOENT' }, 'no hub can serve fallback grants');
    assert.equal(events.some(entry => entry.event === 'aide-tools-migration-failed'), true);
    assert.equal(events.some(entry => entry.event === 'roles-unreadable'), false);
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
});
