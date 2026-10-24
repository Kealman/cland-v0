// T1: formula rendering and opt-in configuration; native publication has its own T3 receipt.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { releaseDescription } from '../src/cli/release.ts';
import { renderFormula } from '../src/homebrew.ts';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';

test('Homebrew is opt-in and survives managed config rendering', () => {
  assert.equal(defaultConfig('example').release.homebrew.tap, '');
  const config = parseConfig('[release.homebrew]\ntap = "Kealman/homebrew-tap"', 'example');
  assert.equal(parseConfig(renderConfig(config), 'example').release.homebrew.tap, 'Kealman/homebrew-tap');
  for (const tap of ['../tap', 'owner/repo/extra', 'https://github.com/owner/tap', 'owner/repo', 'x/homebrew-tap\n']) {
    assert.throws(() => parseConfig(`[release.homebrew]\ntap = ${JSON.stringify(tap)}`, 'example'), /release.homebrew.tap/);
  }
});

test('formula pins tag bytes, Node 24, shared build and runtime wrapper', async () => {
  const template = await readFile(new URL('../../packaging/homebrew/cland.rb.in', import.meta.url), 'utf8');
  const formula = renderFormula(template, { version: 'v0.2.0', url: 'https://codeload.github.com/Kealman/cland-v0/tar.gz/refs/tags/v0.2.0', sha256: 'a'.repeat(64) });
  assert.ok(formula.includes('version "0.2.0"'));
  assert.ok(formula.includes('sha256 "' + 'a'.repeat(64) + '"'));
  assert.ok(formula.includes('url "https://codeload.github.com/Kealman/cland-v0/tar.gz/refs/tags/v0.2.0"'));
  assert.ok(formula.includes('depends_on "node@24"'));
  assert.ok(formula.includes('system "sh", "packaging/build-install.sh"'));
  assert.ok(formula.includes('write_env_script libexec/"hub/bin/cland.ts", PATH: "#{node}:$PATH"'));
  assert.ok(formula.includes('cland doctor'));
  assert.ok(!formula.includes('@@'));
  assert.throws(() => renderFormula(template, { version: 'v0.2.0', url: 'https://example.test/"bad', sha256: 'bad' }));
});


test('prebuilt Web publication is opt-in and survives config rendering', () => {
  assert.equal(defaultConfig('example').release.webBundle, false);
  const config = parseConfig('[release]\nweb_bundle = true', 'example');
  assert.equal(parseConfig(renderConfig(config), 'example').release.webBundle, true);
  assert.throws(() => parseConfig('[release]\nweb_bundle = "yes"', 'example'), /release.web_bundle/);
});


test('the release CLI accepts the previous wire response without Web asset fields', () => {
  const result = JSON.parse('{"version":"v0.2.0","commit":"abc","notes":"Approved notes","refs":["abc:refs/heads/main"],"dryRun":true}');
  assert.equal(releaseDescription(result), 'Would release v0.2.0 at abc\nApproved notes\ngithub abc:refs/heads/main\n');
});
