import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));
const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
const run = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

test('cland --version prints the version of the hub package', () => {
  for (const flag of ['--version', '-v']) {
    const r = run(flag);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, `${VERSION}\n`);
  }
});

test('cland with no command prints the help; an unknown command is a usage error', () => {
  const help = run();
  assert.equal(help.status, 0);
  assert.match(help.stdout, /usage: cland <command>/);
  const bad = run('serve');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown command "serve"/);
});
