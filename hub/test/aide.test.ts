// T3: native harness launch, shell stop/resume and settings-hook pipe lifecycle.
import { claudeLaunchIdentity } from './claude-launch-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, clauseAnswered, connectUi, eventually, fakeClaude, flushProjectLogs, nativeProjectHub as projectHub, spawnSpoke, tempProject } from './harness.ts';
import { DEFAULTS, parseRoles } from '../src/roles/config.ts';
import type { HarnessProcessView, Message } from '../src/protocol.ts';
import { INIT_GIT_IDENTITY } from './git-identity-fixture.ts';

test('an Aide launches any role through its tool and runs launch, stop and resume in its own shell', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await ui.request({ type: 'session.launch', name: 'aide-1', role: 'aide', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const aideProcess = (launched.value as { process: HarnessProcessView }).process;
  await clauseAnswered(ui, 'aide-1');
  const aide = await spawnSpoke({ cwd: root, discover: true, name: 'aide-1', ...(await claudeLaunchIdentity(fake, 'aide-1')), sessionId: aideProcess.sessionId, assignRole: false });
  t.after(() => aide.close());
  await aide.waitForPresence(['aide-1']);
  const coord = await aide.call<{ ok: boolean; process: HarnessProcessView }>('session.launch', { name: 'coord', role: 'coordinator', harness: 'claude-code' });
  assert.equal(coord.ok, true, JSON.stringify(coord));
  await clauseAnswered(ui, 'coord');
  const { item } = await aide.call<{ item: { id: string } }>('task.create', { title: 'Human requested Lead', kind: 'epic' });
  const lead = await aide.call<{ ok: boolean; process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: item.id, harness: 'claude-code' });
  assert.equal(lead.ok, true, JSON.stringify(lead));
  await eventually('Lead completes its clause turn', async () => (await fake.log(lead.process.harnessId!)).includes('session.measure done') || undefined);

  const run = async (args: string) => {
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: `@aide-1 cland ${args}` })).ok, true);
    const answer = await ui.waitFor(f => f.type === 'message' && (f.message as Message).from === 'aide-1' && (f.message as Message).text.startsWith(`ran: cland ${args}: `), 30_000);
    const text = (answer.message as Message).text;
    assert.match(text, /: exit 0\n/, text);
    return JSON.parse(text.slice(text.indexOf('\n') + 1)) as { process: HarnessProcessView; found?: boolean };
  };
  const worker = await run('session launch worker --role implementer --harness claude-code --json');
  assert.equal(worker.process.role, 'implementer');
  await eventually('worker completes its clause turn', async () => (await fake.log(worker.process.harnessId!)).includes('session.measure done') || undefined);
  const stopped = await run('session stop worker --json');
  assert.equal(stopped.process.status, 'stopped');
  const resumed = await run('session resume worker --relaunch --json');
  assert.equal(resumed.found, true);
  assert.equal(resumed.process.sessionId, worker.process.sessionId);
  assert.equal(resumed.process.status, 'running');
  await eventually('resumed worker completes its clause turn', async () => (await fake.log(resumed.process.harnessId!)).includes('session.measure done') || undefined);
  assert.equal((await run('session stop coord --json')).process.status, 'stopped');
  const resumedCoord = await run('session resume coord --relaunch --json');
  assert.equal(resumedCoord.found, true);
  await eventually('resumed Coordinator completes its clause turn', async () => (await fake.log(resumedCoord.process.harnessId!)).includes('session.measure done') || undefined);

  await flushProjectLogs(t, root);
  const records = (await readFile(join(root, '.cland/log/hub.log'), 'utf8')).split('\n').slice(0, -1)
    .filter(line => line.includes('"event":"audit"'))
    .map(line => JSON.parse(line) as { session: string; sessionId: string; role: string; tool: string; client?: string; outcome: string })
    .filter(row => row.session === 'aide-1' && ['session.launch', 'session.stop', 'session.resume'].includes(row.tool));
  assert.deepEqual(records.map(row => [row.tool, row.client, row.outcome]), [
    ['session.launch', undefined, 'ok'], ['session.launch', undefined, 'ok'],
    ['session.launch', 'cli', 'ok'], ['session.stop', 'cli', 'ok'], ['session.resume', 'cli', 'ok'],
    ['session.stop', 'cli', 'ok'], ['session.resume', 'cli', 'ok'],
  ]);
  assert.ok(records.every(row => row.sessionId === aideProcess.sessionId && row.role === 'aide'));
});

test('cland init writes the Aide defaults and CLI launches several Aides with no model override', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const init = await clandWithEnv(root, { ...fake.env, ...INIT_GIT_IDENTITY }, 'init');
  assert.equal(init.code, 0, init.stderr);
  const roles = parseRoles(await readFile(join(root, '.cland', 'roles.toml'), 'utf8'));
  const shipped = DEFAULTS.get('aide')!;
  assert.deepEqual(roles.get('aide'), { ...shipped, launch: { ...shipped.launch, permissions: 'auto' } });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  for (const name of ['aide-1', 'aide-2']) {
    const launch = await cland(root, 'session', 'launch', name, '--role', 'aide', '--json');
    assert.equal(launch.code, 0, launch.stderr);
    const process = JSON.parse(launch.stdout).process;
    assert.equal(process.harness, 'claude-code');
    assert.equal(process.label, `${name} [Aide]`);
    assert.equal((await fake.job(process.harnessId)).model, null);
    await clauseAnswered(ui, name);
  }
  const status = await ui.request({ type: 'hub.status' });
  assert.deepEqual((status.value as { sessions: Array<{ name: string; role: string }> }).sessions.filter(s => s.role === 'aide').map(s => s.name).sort(), ['aide-1', 'aide-2']);
});

test('a fake Claude Aide keeps answering when a settings hook exits without reading stdin', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hygiene]\nmax_text_bytes = 2097152\n');
  await mkdir(join(root, '.claude'));
  await writeFile(join(root, '.claude/settings.json'), JSON.stringify({ hooks: {
    UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'exec 0<&-; exit 23' }] }],
  } }));
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launch = await cland(root, 'session', 'launch', 'aide-1', '--role', 'aide', '--json');
  assert.equal(launch.code, 0, launch.stderr);
  const { process } = JSON.parse(launch.stdout) as { process: { harnessId: string } };
  await clauseAnswered(ui, 'aide-1');
  // More than a pipe can buffer: even on macOS the write is still pending when the hook closes stdin.
  for (const text of ['payload '.repeat(65536), 'answer after the closed stdin']) {
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text, to: ['aide-1'] })).ok, true);
    await ui.waitFor(f => f.type === 'message' && (f.message as Message).from === 'aide-1' && (f.message as Message).text === `pong: ${text}`, 15_000)
      .catch(async () => { throw new Error(`Aide did not answer after the hook closed stdin:\n${(await fake.log(process.harnessId)).slice(-2000)}`); });
  }
  await eventually('the hook exit code is retained', async () => (await fake.log(process.harnessId)).includes('hook UserPromptSubmit exited 23:') || undefined);
});
