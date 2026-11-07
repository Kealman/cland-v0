// T2: start and CLI reload use the real config boundary on sealed scratch project hubs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cland, connectUi, projectHub, tempProject } from './harness.ts';

for (const [value, message] of [['"outbound"', /0\.4\.x/], ['"tcp"', /ssh.*only.*0\.4\.0/], ['false', /ssh.*only.*0\.4\.0/]] as const) {
  test(`host transport ${value} refuses start and CLI reload`, async t => {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'), { recursive: true });
    const config = defaultConfig('Transport test');
    config.verification.lockPath = join(root, 'suite.lock');
    const valid = renderConfig(config);
    const invalid = `${valid}\n[hosts.first]\nprovider="fake"\ntransport="ssh"\n[hosts.second]\nprovider="fake"\ntransport=${value}\n`;
    const path = join(root, '.cland/config.toml');
    await writeFile(path, invalid);
    await assert.rejects(projectHub(t, root), message);
    await writeFile(path, valid);
    const hub = await projectHub(t, root);
    const ui = await connectUi(t, hub.discovery);
    const before = (await ui.request({ type: 'hub.status' })).value;
    await writeFile(path, invalid);
    const result = await cland(root, 'hub', 'reload');
    assert.notEqual(result.code, 0);
    assert.match(result.stderr + result.stdout, /hosts\.second\.transport/);
    assert.match(result.stderr + result.stdout, message);
    const after = (await ui.request({ type: 'hub.status' })).value;
    assert.deepEqual((after as { config: unknown }).config, (before as { config: unknown }).config);
    await writeFile(path, valid);
    assert.equal((await cland(root, 'hub', 'reload')).code, 0);
    await hub.stop();
  });
}

test('malformed non-transport hosts keys are refused by project config', () => {
  assert.throws(() => parseConfig('[hosts.one]\nprovider="fake"\nsize=false', 'fallback', {}), /hosts.one.size/);
});

test('quoted empty pool transport is refused at startup', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hosts.""]\ntransport="outbound"\n');
  await assert.rejects(projectHub(t, root), /letters, digits and hyphens/);
});
