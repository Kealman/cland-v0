import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fixture } from './remote-fixture.ts';
import { projectHub } from './harness.ts';

test('integrated remote delivery keeps the submitted bundle across tracker and rulebook commits', async t => {
  const f = await fixture(t, { hub: projectHub });
  await f.git('checkout', 'dev');
  await f.git('merge', '--ff-only', 'task-candidate');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const head = await f.git('rev-parse', 'HEAD');
  f.api.beforeCreate(async () => {
    for (const path of ['.cland/tasks/note.md', '.cland/RULES.md']) {
      await writeFile(join(f.root, path), 'administrative change\n');
      await f.git('add', '-f', path);
    }
    await f.git('commit', '-m', 'administrative change during acquisition');
    await writeFile(join(f.root, '.cland/RULES.md'), 'later uncommitted rulebook change\n');
  });
  const run = await f.launch();
  const result = await f.result(run.id);
  assert.match(result.text, /exit 0[\s\S]*Executor droplet/, result.text);
  const advanced = await f.git('rev-parse', 'HEAD');
  assert.notEqual(advanced, head);
  for (const directory of f.api.machineDirs.values()) {
    const cwd = join(directory, 'home/runner/cland');
    assert.equal((await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd })).stdout.trim(), head);
    await assert.rejects(readFile(join(cwd, '.cland/RULES.md')), { code: 'ENOENT' });
  }
  assert.equal(f.api.machineDirs.size, 1);
  const reused = await f.launch();
  assert.equal(reused.cached?.run, run.id);
  assert.match((await f.result(reused.id)).text, /exit 0/);
  assert.deepEqual(f.api.droplets, []);
});
