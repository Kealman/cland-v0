// Validate resource references, not upstream diagnostic/namespace or licence strings.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// React diagnostic/namespace URLs and OFL licence strings are metadata, not request targets.
// C5 deliberately allows those upstream strings; only resource references are forbidden.
function externalResource(path: string, source: string): boolean {
  if (/\.(html|css)$/.test(path)) return /(?:https?:)?\/\//i.test(source);
  const target = '(?:(?:https?|wss?):)?\\/\\/';
  const call = `(?:\\b(?:fetch|WebSocket|EventSource|import)\\s*\\(\\s*|\\bfrom\\s*)["'\x60]${target}`;
  const xhr = `\\.open\\s*\\(\\s*["'\x60][^"'\x60]*["'\x60]\\s*,\\s*["'\x60]${target}`;
  return new RegExp(`${call}|${xhr}`, 'i').test(source);
}
for (const [path, source] of [
  ['index.html', '<link href="https://example.invalid/font.css">'],
  ['style.css', 'src: url(//example.invalid/font.woff2)'],
  ['main.js', 'fetch("https://example.invalid/data")'],
  ['main.js', 'import("//example.invalid/module.js")'],
  ['main.js', 'new WebSocket("wss://example.invalid/ws")'],
  ['main.js', 'new EventSource("https://example.invalid/events")'],
  ['main.js', 'xhr.open("GET", "https://example.invalid/data")'],
]) assert.ok(externalResource(path!, source!), `${path}: external resource fixture`);
assert.equal(externalResource('style.css', "src: url('/fonts/local.woff2')"), false);
assert.equal(externalResource('main.js', 'const diagnostic = "https://react.dev/errors/1"'), false);

export async function checkAssets(dist: string): Promise<void> {
  async function visit(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (/\.(html|css)$/.test(path)) {
        assert.equal(externalResource(path, await readFile(path, 'utf8')), false, `${path}: external resource URL`);
      } else if (/\.js$/.test(path)) {
        assert.equal(externalResource(path, await readFile(path, 'utf8')), false, `${path}: external resource URL`);
      }
    }
  }
  await visit(dist);
  for (const family of ['golos-text', 'jetbrains-mono']) {
    for (const subset of ['latin', 'cyrillic']) {
      const font = await readFile(join(dist, 'fonts', `${family}-${subset}.woff2`));
      assert.equal(font.subarray(0, 4).toString(), 'wOF2', `${family} ${subset}: WOFF2 signature`);
      assert.ok(font.length > 1000, 'font bytes must be present');
    }
    assert.match(await readFile(join(dist, 'fonts', `${family}-OFL.txt`), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
  }
}
