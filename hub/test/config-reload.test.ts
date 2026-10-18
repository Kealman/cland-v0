// T3: SIGHUP reload preserves the live hub PID and refuses restart-only fields.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, eventually, startDaemon, tempProject } from './harness.ts';

const config = (root: string, budget: number) => `[verification]\nlock_path=${JSON.stringify(join(root, "suite.lock"))}\nremote_budget=${budget}\n`;

// SIGHUP concerns the actual hub process, so this fixture deliberately uses startDaemon.
test('SIGHUP reloads the pair without changing the hub PID, and startup fields refuse atomically', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const path = join(root, '.cland/config.toml');
  const before = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout);
  await writeFile(path, config(root, 7));
  process.kill(discovery.pid, 'SIGHUP');
  const after = await eventually('SIGHUP publication visible', async () => {
    const s = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout);
    return s.verification.remoteBudget === 7 ? s : undefined;
  });
  assert.equal(after.pid, before.pid);
  assert.notEqual(after.config.loadedAt, before.config.loadedAt);
  for (const [change, field] of [['[tracker]\nlevels=["epic"]\n', 'tracker.levels'], ['[inbox]\nidle_minutes=1\n', 'inbox.idle_minutes']] as const) {
    await writeFile(path, config(root, 8) + change);
    const refused = await cland(root, 'hub', 'reload');
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, new RegExp(`${field}.*restart required`));
  }
  const retained = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout);
  assert.equal(retained.verification.remoteBudget, 7);
  assert.deepEqual(retained.config, after.config);
  assert.match((await cland(root, 'hub', 'status')).stdout, /config: loaded .*source commit/);
});
