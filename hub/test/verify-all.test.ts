// T3: native Git diff admission through the real verify CLI reserves all before queue or worker startup.
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectSocket, nativeProjectHub as projectHub, tempProject } from './harness.ts';
import type { HubStatus, VerificationQueue } from '../src/protocol.ts';

// The hand holder keeps admitted requests observable without launching a package process.
test('explicit all is reserved before verification queue admission', async t => {
  const root = await tempProject(t);
  const remote = await tempProject(t);
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, { env: fixtureEnvironment(root, process.env), cwd: root })).stdout.trim();
  await git('init', '-q', '-b', 'dev');
  await git('config', 'user.name', 'Verify test');
  await git('config', 'user.email', 'verify@example.invalid');
  await writeFile(join(root, '.gitignore'), '.cland/\nsuite.lock*\n');
  await git('add', '.'); await git('commit', '-qm', 'Base');
  await git('init', '--bare', '-q', remote);
  await git('remote', 'add', 'origin', remote); await git('push', '-qu', 'origin', 'dev');
  await git('checkout', '-qb', 't/T-689');
  await mkdir(join(root, 'hub/src'), { recursive: true });
  await writeFile(join(root, 'hub/src/change.ts'), '// hub change\n');
  await git('add', '.'); await git('commit', '-qm', 'Hub change');
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), `[verification]\ntest="true"\nlock_path=${JSON.stringify(join(root, 'suite.lock'))}\n`);
  await mkdir(join(root, 'suite.lock'));
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const spoke = await connectSocket(discovery.socket);
  t.after(() => spoke.close());
  spoke.send({ type: 'hello', protocol: 2, secret: discovery.secret, name: 'impl', sessionId: 'verify-impl', cwd: root });
  assert.equal((await spoke.next()).type, 'welcome');
  const made = await ui.request({ type: 'task.create', title: 'Verify admission', size: 'S', assignee: 'impl' });
  const item = (made.value as { item: { id: string } }).item.id;
  const opened = await ui.request({ type: 'topic.create', item, title: 'Verify admission' });
  const topic = (opened.value as { topic: { id: string } }).topic.id;
  const actor = { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'verify-impl', CLAND_ROLE: 'implementer' };
  const request = { type: 'suite.start', mode: 'all', cwd: root, report: topic, to: ['impl'] };
  const frame = async (id: string, extra: Record<string, unknown> = {}) => {
    spoke.send({ ...request, ...extra, id });
    for (;;) { const reply = await spoke.next(); if (reply.type === 'result' && reply.id === id) return reply; }
  };
  const empty = async () => {
    assert.deepEqual(((await ui.request({ type: 'hub.status', history: true })).value as HubStatus).suites, []);
    assert.deepEqual(((await ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters, []);
  };
  const denied = await frame('reserved');
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'verify-all-reserved');
  assert.match(String(denied.error), /mode hub-only; all paths outside nvim\//);
  assert.match(String(denied.error), /hub\/src\/change.ts/);
  await empty();
  // A report-free preview skips send/artifact grants, while explicit all stays reserved.
  const preview = await frame('preview', { mode: 'auto', dryRun: true, report: undefined, to: undefined });
  assert.equal(preview.ok, true, String(preview.error));
  assert.equal((preview.value as { dryRun: boolean }).dryRun, true);
  await empty();
  const reservedPreview = await frame('reserved-preview', { dryRun: true, report: undefined, to: undefined });
  assert.equal(reservedPreview.ok, false);
  assert.equal(reservedPreview.code, 'verify-all-reserved');
  await empty();
  for (const mode of ['all', '--all']) {
    const cli = await clandWithEnv(root, actor, 'verify', mode, '--report', topic, '--to', 'impl');
    assert.equal(cli.code, 1);
    assert.match(cli.stderr, /verify-all-reserved/);
    assert.match(cli.stderr, /mode hub-only/);
    await empty();
  }
  // The role is read from the hub, regardless of a stale shell role hint.
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const admitted = await frame('coordinator');
  assert.equal(admitted.ok, true, String(admitted.error));
  const coord = admitted.value as { id: string };
  assert.equal((await ui.request({ type: 'suite.cancel', suite: coord.id })).ok, true);
  const coordCli = await clandWithEnv(root, actor, 'verify', '--all', '--report', topic, '--to', 'impl', '--json');
  assert.equal(coordCli.code, 0, coordCli.stderr);
  assert.equal((await ui.request({ type: 'suite.cancel', suite: JSON.parse(coordCli.stdout).id })).ok, true);
  const human = await cland(root, 'verify', 'all', '--report', topic, '--json');
  assert.equal(human.code, 0, human.stderr);
  assert.equal((await ui.request({ type: 'suite.cancel', suite: JSON.parse(human.stdout).id })).ok, true);
  const humanFrame = await ui.request(request);
  assert.equal(humanFrame.ok, true, humanFrame.error);
  assert.equal((await ui.request({ type: 'suite.cancel', suite: (humanFrame.value as { id: string }).id })).ok, true);
});
