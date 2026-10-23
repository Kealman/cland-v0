// T3: real Git task worktree merge lifecycle closes the item that starts its archive window. Fake time proves the window.
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeClock } from './fake-clock.ts';
import { nativeProjectHub as projectHub } from './harness.ts';
// Archive through the real hub, a real spoke and the human CLI; fakes sit at the harness boundary.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import type { HarnessProcessView } from '../src/protocol.ts';
import { cland, connectUi, eventually } from './harness.ts';
import { preparedProject } from './prepared-project.ts';

type List = { processes: HarnessProcessView[]; archived: number };

test('a real task merge starts the stopped Implementer item window', async t => {
  const root = await preparedProject(t);
  await writeFile(join(root, '.cland', 'config.toml'), '[sessions]\narchive_after_item = "1s"\narchive_after_stop = "1d"\n');
  execFileSync('git', ['add', '.cland/config.toml'], { env: fixtureEnvironment(root, process.env), cwd: root });
  execFileSync('git', ['commit', '-qm', 'Configure cleanup fixture'], { env: fixtureEnvironment(root, process.env), cwd: root });
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, {}, { clock, harnesses: 'fake' });
  const ui = await connectUi(t, discovery);
  const pushed = await cland(root, 'push');
  assert.equal(pushed.code, 0, pushed.stderr);
  assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Archive after landing' })).ok, true);
  const launch = await ui.request({ type: 'session.launch', name: 'impl-merge', role: 'implementer', harness: 'claude-code', item: 'T-1' }, 30000);
  assert.equal(launch.ok, true, launch.error);
  const p = (launch.value as { process: HarnessProcessView }).process;
  await writeFile(join(p.cwd, 'README.md'), 'implemented\n');
  execFileSync('git', ['add', 'README.md'], { env: fixtureEnvironment(p.cwd, process.env), cwd: p.cwd });
  execFileSync('git', ['commit', '-qm', 'Implement fixture work'], { env: fixtureEnvironment(p.cwd, process.env), cwd: p.cwd });
  assert.equal((await ui.request({ type: 'session.stop', session: p.name }, 30000)).ok, true);
  const merged = await cland(root, 'merge', 'T-1', '--override', 'Exercise archive after a real merge', '--json');
  assert.equal(merged.code, 0, merged.stderr);
  assert.equal((JSON.parse(merged.stdout) as { item: string }).item, 'T-1');
  await clock.advance(1001);
  const archived = await eventually('merged Implementer archives on item window', async () => {
    const list = (await ui.request({ type: 'session.list', archived: true })).value as List;
    return list.processes.find(row => row.name === p.name);
  });
  assert.equal(archived.archivedBy, 'rule');
});

