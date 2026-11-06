// T1: image plans are rendered as text; no installer, shell or provider runs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { renderRecipe } from '../src/image/recipe.ts';

test('x86_64 builder preserves the committed recipe bytes and snapshot digest', async () => {
  const template = await readFile(new URL('../src/executor/droplet/provision.sh', import.meta.url), 'utf8');
  assert.equal(createHash('sha256').update(template).digest('hex'), '3cf36474d3b4e6a42c2a9edcbfb68b44b7c08b405f82f99f755651f502f7ef3d');
  assert.equal(renderRecipe({ arch: 'x86_64', node: 'v24.13.0' }), template.replace('__NODE_VERSION__', 'v24.13.0'));
});

for (const [arch, nodeArch] of [['x86_64', 'x64'], ['arm64', 'arm64']] as const) {
  test(`${arch} base downloads and verifies exact Node bytes without project packages`, () => {
    const script = renderRecipe({ arch, node: 'v24.13.0' });
    assert.match(script, /NODE_VERSION=v24\.13\.0\n/);
    assert.ok(script.includes(`https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-${nodeArch}.tar.xz`));
    assert.ok(script.includes(`SHASUMS256.txt" | grep " node-$NODE_VERSION-linux-${nodeArch}.tar.xz\\$" | sha256sum -c -`));
    assert.ok(script.includes(`tar -xJf "node-$NODE_VERSION-linux-${nodeArch}.tar.xz"`));
    for (const name of ['git', 'curl', 'ca-certificates', 'jq', 'lsof', 'procps', 'xz-utils', 'locales', 'build-essential', 'python3']) {
      assert.ok(script.split(/\s+/).includes(name), name);
    }
    assert.match(script, /systemctl disable --now apt-daily.timer apt-daily-upgrade.timer unattended-upgrades.service/);
    assert.match(script, /useradd --create-home --shell \/bin\/bash runner/);
    assert.doesNotMatch(script, /nvim|libasound|libatk|libatspi|libcairo|libcups|libdbus|libdrm|libgbm|libglib|libnspr|libnss|libpango|libx11|libxcb|libxcomposite|libxdamage|libxext|libxfixes|libxkbcommon|libxrandr/);
  });
}

test('unknown architectures and unsafe version pins refuse before rendering', () => {
  assert.throws(() => renderRecipe({ arch: 'riscv64' as 'arm64', node: 'v24.13.0' }), /architecture/);
  for (const node of ['v24.13.0;touch /tmp/unsafe', 'latest', '24']) {
    assert.throws(() => renderRecipe({ arch: 'x86_64', node }), /Node/);
  }
});

test('agent recipe pins all harnesses and installs OpenCode only from the v2 installer before ready', () => {
  const script = renderRecipe({ arch: 'arm64', node: 'v24.13.0', harnesses: { opencode: '2.0.25', codex: '0.160.1', 'claude-code': '2.1.295' } });
  assert.match(script, /https:\/\/opencode.ai\/v2\/install \| bash -s -- --version 2\.0\.25/);
  assert.match(script, /npm install -g @openai\/codex@0\.160\.1/);
  assert.match(script, /https:\/\/claude.ai\/install.sh \| bash -s -- 2\.1\.295/);
  assert.doesNotMatch(script, /opencode-ai/);
  assert.ok(script.indexOf('https://opencode.ai/v2/install') < script.indexOf('touch /var/lib/cland-ready'));
  assert.match(script, /runuser -u runner -- bash -o pipefail/);
});

test('agent defaults use doctor minimums and reject unpinned or injected harness versions', () => {
  const script = renderRecipe({ arch: 'x86_64', node: 'v24.13.0', harnesses: {} });
  assert.match(script, /--version 2\.0\.24/);
  assert.match(script, /@openai\/codex@0\.160\.0/);
  assert.match(script, /bash -s -- 2\.1\.294/);
  for (const pin of ['latest', '2.0.24; id', '1.9.0']) {
    assert.throws(() => renderRecipe({ arch: 'x86_64', node: 'v24.13.0', harnesses: { opencode: pin } }), /harness|OpenCode/);
  }
});

test('baked harness installer stubs remain discoverable with a login-disk HOME', async t => {
  const { mkdtemp, mkdir, writeFile, symlink, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const { fixtureEnvironment } = await import('./fixture-environment.ts');
  const { installedHarnesses } = await import('../src/doctor/harnesses.ts');
  const root = await mkdtemp(join(tmpdir(), 'cland-recipe-lookup-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = join(root, 'usr/local/bin');
  await mkdir(bin, { recursive: true });
  const env = fixtureEnvironment(join(root, 'login-disk'), {}, { PATH: bin });
  for (const source of ['/home/runner/.opencode/bin/opencode', '/home/runner/.local/bin/claude']) {
    await mkdir(dirname(join(root, source)), { recursive: true });
    await writeFile(join(root, source), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  }
  assert.deepEqual(installedHarnesses(env), [], 'user-level stubs are hidden by account HOME before stable links');
  const script = renderRecipe({ arch: 'x86_64', node: 'v24.13.0', harnesses: {} });
  assert.match(script, /npm install -g @openai\/codex@[\d.]+ --prefix \/usr\/local\n/);
  assert.ok(script.indexOf('test -x /usr/local/bin/codex') > 0 && script.indexOf('test -x /usr/local/bin/codex') < script.indexOf('touch /var/lib/cland-ready'));
  // Model the npm output at the explicit global prefix; no npm process runs.
  await writeFile(join(bin, 'codex'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const links = [...script.matchAll(/^ln -sf (\/home\/runner\/\S+) (\/usr\/local\/bin\/\S+)$/gm)];
  assert.deepEqual(links.map(([, source, target]) => [source, target]), [
    ['/home/runner/.opencode/bin/opencode', '/usr/local/bin/opencode'],
    ['/home/runner/.local/bin/claude', '/usr/local/bin/claude'],
  ]);
  for (const [line, source, target] of links) {
    const guard = `test -x ${source}`;
    assert.ok(script.indexOf(guard) > 0 && script.indexOf(guard) < script.indexOf(line));
    assert.ok(script.indexOf(line) < script.indexOf('touch /var/lib/cland-ready'));
    // Interpret only the recipe's two link declarations inside a scratch root.
    // Installer outputs are inert stubs; no shell, harness or network runs.
    await symlink(join(root, source!), join(root, target!));
  }
  assert.deepEqual(installedHarnesses(env), ['claude-code', 'codex', 'opencode']);
});
