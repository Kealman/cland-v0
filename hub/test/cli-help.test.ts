// T2: the real CLI's help is the subprocess boundary under test.
import './cover-quiet.ts';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { VERSION } from '../src/version.ts';
import { frozenUsage } from './cli-usage-fixture.ts';
import { clandCliLaunch } from './tier-cli.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('cland --help retains its pre-refactor output byte for byte', t => {
  const root = mkdtempSync(join(tmpdir(), 'cland-help-bytes-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const actual = clandCliLaunch(() => execFileSync(process.execPath, [fileURLToPath(new URL('../bin/cland.ts', import.meta.url)), '--help'], {
    cwd: root, env: fixtureEnvironment(root, process.env), timeout: 5000,
  }));
  const exports: Record<string, string> = frozenUsage();
  const expected = readFileSync(new URL('./fixtures/cli-usage/help.txt', import.meta.url), 'utf8')
    .replace('<VERSION>', VERSION).replace(/<([A-Z_]+_USAGE)>/g, (_, name: string) => {
      assert.ok(Object.hasOwn(exports, name), `known frozen help block: ${name}`);
      return exports[name]!;
    });
  assert.deepEqual(actual, Buffer.from(expected));
});
