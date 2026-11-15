// T2: published CLI commands against a socket on projectHub, fake provider, no native host.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, projectHub, cland } from './harness.ts';
import { defaultConfig, renderConfig, parseConfig } from '../src/init/config.ts';
import { FakeClock } from './fake-clock.ts';
import { hostsPath, source, poolSteps } from '../../site/test/hosts-docs-source.ts';

test('published pool commands configure a second fake pool and host status lists it', async t => {
  const steps = poolSteps(source(hostsPath));
  assert.ok(steps.length >= 5, 'visible walkthrough must be nonempty');
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const initial = defaultConfig('Hosts docs');
  initial.verification.lockPath = join(root, 'suite.lock');
  const config = renderConfig(initial) + '\n[hosts.first]\nprovider="fake"\nmin_hosts=0\n';
  await writeFile(join(root, '.cland/config.toml'), config);
  const hub = await projectHub(t, root, { CLAND_FAKE_HOST_ROOT: join(root, 'machines') }, { clock: new FakeClock(Date.now()) });
  let status = '';
  for (const step of steps) {
    assert.match(step, /^cland /);
    const args = step.slice(6).replace('<provider>', 'fake').split(/\s+/);
    const result = await cland(root, ...args);
    assert.equal(result.code, 0, `${step}: ${result.stderr}`);
    if (step === 'cland host status') status = result.stdout;
  }
  assert.match(status, /first: 0 hosts/);
  assert.match(status, /second: 0 hosts.*slots 0\/0/);
  const saved = parseConfig(await readFile(join(root, '.cland/config.toml'), 'utf8'), 'Hosts docs');
  assert.deepEqual(saved.hosts.pools.second, { provider: 'fake', size: 's-4vcpu-8gb', region: 'lon1', transport: 'ssh', slots: 8, minHosts: 0, maxHosts: 2, idleStop: '20m', idleStopMs: 1200000, spread: false });
  await hub.stop();
});
