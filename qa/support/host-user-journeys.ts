import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, startDaemon, clandWithEnv, pidAlive, eventually } from '../../hub/test/harness.ts';
import { beforeDirectories, onCleanup } from '../../hub/test/process-cleanup.ts';
import { fixtureEnvironment } from '../../hub/test/fixture-environment.ts';
import { Store } from '../../hub/src/hub/store.ts';
import { poolImageKey } from '../../hub/src/host/provider/pool-image.ts';
import { fakeDigitalOcean } from '../../hub/test/fakes/digitalocean/fake-api.ts';
import type { JourneyScope } from './native-journey.ts';

/** Literal doctor journey: every row comes from the same CLI-started hub. */
export async function combinedDoctor(t: TestContext, scope: JourneyScope) {
  const { root, env, api } = await scope.setup('complete doctor fixture acquisition', async () => {
    const root = await tempProject(t, 'qd-', '/tmp');
    scope.adoptRoot(root);
    const env = fixtureEnvironment(root, process.env, { CLAND_TEST_ORPHAN_ROOT: root });
    await mkdir(join(root, '.cland/run/hosts'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="digitalocean"\nmin_hosts=0\n');
    await writeFile(join(root, 'package-lock.json'), 'original lock');
    const key = await poolImageKey(root, env, 'digitalocean');
    await writeFile(join(root, '.cland/run/hosts/agents-image.json'), JSON.stringify({ key }));
    await writeFile(join(root, 'package-lock.json'), 'changed lock');
    const store = new Store(join(root, '.cland/hub.db'));
    try {
      store.hosts.logins.insert({ name: 'expired', harness: 'codex', account: 'fixture', kind: 'disk', provider: 'digitalocean', region: 'lon1', volumeId: 'fixture-volume', snapshotIds: [], lastSignIn: null });
      store.hosts.logins.markSignedOut('expired', { host: null, reason: 'fixture expiration' });
    } finally { store.close(); }
    const api = await fakeDigitalOcean('cland-test-doctor-journey', { testContext: t });
    onCleanup(t, () => api.close());
    // There is deliberately no provider credential, even a synthetic one, in this hub.
    // No provider can be constructed by doctor; zero HTTP requests is an independent check.
    const daemon = await startDaemon(t, root, env as Record<string, string>);
    beforeDirectories(t, async () => {
      const stopped = await clandWithEnv(root, env as Record<string, string>, 'hub', 'stop');
      assert.equal(stopped.code, 0, stopped.stderr);
      await eventually('doctor scratch hub PID reaped', () => !pidAlive(daemon.discovery.pid) || undefined, 15000);
      assert.equal(pidAlive(daemon.discovery.pid), false);
    });
    return { root, env, api };
  });
  await scope.step('doctor command and exact warnings', async () => {
    const result = await clandWithEnv(root, env as Record<string, string>, 'doctor', '--json');
    const checks = JSON.parse(result.stdout).checks as Array<{ name: string; verdict: string; detail: string; fix?: string }>;
    for (const expected of [
      { name: 'host agents image', verdict: 'warn', detail: 'stale: lock', fix: 'cland host prepare agents' },
      { name: 'host login expired', verdict: 'warn', detail: 'signed-out', fix: 'cland login signin expired' },
      { name: 'host digitalocean token', verdict: 'warn', detail: 'absent', fix: 'cland secret set digitalocean.token; cland hub stop && cland hub start' },
    ]) assert.deepEqual(checks.find(row => row.name === expected.name), expected);
    assert.deepEqual(api.requests, []);
    t.diagnostic(JSON.stringify({ checks: checks.filter(row => ['host agents image', 'host login expired', 'host digitalocean token'].includes(row.name)), providerRequests: api.requests.length, platform: process.platform }));
  });
}
