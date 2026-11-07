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
    const invalid = `${valid}\n[hosts.first]\ntransport="ssh"\n[hosts.second]\ntransport=${value}\n`;
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

test('ssh, omitted transport and malformed non-transport hosts keys preserve config behavior', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Preserved');
  config.verification.lockPath = join(root, 'suite.lock');
  const text = `${renderConfig(config)}\n[hosts.one]\ntransport="ssh"\nsize=false\n[hosts.two]\nprovider=42\n[hosts]\nmalformed=17\n`;
  assert.deepEqual(parseConfig(text, 'fallback', {}), config);
  await writeFile(join(root, '.cland/config.toml'), text);
  const hub = await projectHub(t, root);
  assert.equal((await cland(root, 'hub', 'reload')).code, 0);
  await hub.stop();
});

test('quoted empty pool transport is refused at startup', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hosts.""]\ntransport="outbound"\n');
  await assert.rejects(projectHub(t, root), /letters, digits and hyphens/);
});
