import { fixtureEnvironment } from './fixture-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject } from './harness.ts';

test('150 ms of malformed parsing plus 150 ms of failure logging counts as one 300 ms roles continuation', { timeout: 10_000 }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland', 'roles.toml');
  await writeFile(path, ''); // existing startup file: RolesFile must not rewrite it
  const tomlUrl = import.meta.resolve('smol-toml');
  const source = `
    import { mock } from 'node:test';
    import * as toml from ${JSON.stringify(tomlUrl)};
    let clock = 0;
    const { default: ignored, ...namedExports } = toml;
    mock.module(${JSON.stringify(tomlUrl)}, { namedExports: { ...namedExports, parse: text => {
      if (text === '[broken') clock += 150;
      return toml.parse(text);
    } } });
    const { RolesFile, ROLES_REFRESH_MS } = await import(${JSON.stringify(new URL('../src/roles/config.ts', import.meta.url).href)});
    const { RequestGuard } = await import(${JSON.stringify(new URL('../src/hub/budget.ts', import.meta.url).href)});
    const events = [];
    const unreadable = Promise.withResolvers();
    let text = '[implementer.launch]\\nharness = "codex"\\n';
    const guard = new RequestGuard({ now: () => clock, log: entry => events.push(entry) });
    const roles = new RolesFile(${JSON.stringify(path)}, entry => {
      if (entry.event === 'roles-unreadable') clock += 150;
      events.push(entry);
      if (entry.event === 'roles-unreadable') unreadable.resolve();
    }, async () => text, guard.resumer('roles.refresh'));
    mock.timers.enable({ apis: ['setInterval'] });
    await roles.start();
    const initial = roles.get();
    text = '[broken';
    mock.timers.tick(ROLES_REFRESH_MS);
    // stop() suppresses pending refreshes, so wait for this refresh's failure receipt first.
    await unreadable.promise;
    await roles.stop();
    process.stdout.write(JSON.stringify({ clock, counters: guard.counters, events, kept: roles.get() === initial }));
    mock.timers.reset();
    mock.restoreAll();
  `;
  const { stdout } = await promisify(execFile)(process.execPath, ['--experimental-test-module-mocks', '--input-type=module', '-e', source], { env: fixtureEnvironment(root, process.env), signal: t.signal });
  const result = JSON.parse(stdout) as { clock: number; counters: { slow: number }; events: Array<Record<string, unknown>>; kept: boolean };
  assert.equal(result.clock, 300);
  assert.equal(result.kept, true);
  assert.equal(result.counters.slow, 1);
  assert.deepEqual(result.events.filter(entry => entry.event === 'slow-request').map(entry => [entry.tool, entry.phase, entry.ms]), [['roles.refresh', 'resumed', 300]]);
});
