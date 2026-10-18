// T3: a SIGTERMed test worker leaves no fixture hub or temp project behind.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { cleanupProcesses, onCleanup, ownProcess } from './process-cleanup.ts';
import { eventually, pidAlive, tempProject } from './harness.ts';

test('SIGTERM of a fixture worker reaps its detached hub before removing the temp project', async t => {
  const container = await tempProject(t, 'cland-worker-test-');
  onCleanup(t, () => cleanupProcesses(container)); // Recover only this test's fixtures, including failed startup.
  const source = `
    import test from 'node:test';
    import { spawn } from 'node:child_process';
    import { readFile } from 'node:fs/promises';
    import { join } from 'node:path';
    import { tempProject, CLI_ENTRY, isolateVerification, eventually } from ${JSON.stringify(new URL('./harness.ts', import.meta.url).href)};
    test('holds a fixture hub until interrupted', async t => {
      const root = await tempProject(t, 'cland-proj-', ${JSON.stringify(container)});
      await isolateVerification(root);
      // Raw foreground launches are used by daemon/orphan lifecycle tests. They
      // can be interrupted before a CLI result or readDiscovery records the PID.
      spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve'], {
        cwd: root, detached: true, stdio: 'ignore',
        env: {
          ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_'))),
          DIGITALOCEAN_TOKEN: '', CLAND_TEST_SKIP_ORPHAN_SWEEP: '1',
          CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'),
        },
      }).unref();
      let discovery;
      await eventually('fixture hub published discovery', async () => {
        discovery = JSON.parse(await readFile(join(root, '.cland/hub.json'), 'utf8'));
        return true;
      }, 5000);
      process.send({ root, pid: discovery.pid });
      await new Promise(() => {});
    });
  `;
  const worker = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  ownProcess(t, worker.pid);
  const [ready] = await once(worker, 'message', { signal: AbortSignal.timeout(5000) }) as [{ root: string; pid: number }];
  ownProcess(t, ready.pid); // The parent owns red-run recovery too; never sweep another fixture.
  assert.ok(pidAlive(ready.pid));
  assert.ok(existsSync(ready.root));
  const exit = once(worker, 'exit', { signal: AbortSignal.timeout(5000) });
  worker.kill('SIGTERM');
  assert.deepEqual(await exit, [143, null], 'worker ran its SIGTERM cleanup');
  await eventually('fixture hub reaped and temp project removed', () => !pidAlive(ready.pid) && !existsSync(ready.root) ? true : undefined, 1000);
  assert.equal(pidAlive(ready.pid), false, 'fixture hub must be reaped');
  assert.equal(existsSync(ready.root), false, 'temp project must be removed');
});
