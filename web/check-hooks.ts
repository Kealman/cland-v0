// T0 fixture for the actual configured linter, outside web/src and the live HOME.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment } from '../hub/test/fixture-environment.ts';

const root = await mkdtemp(join(tmpdir(), 'cland-hooks-'));
try {
  const fixture = join(root, 'Broken.tsx');
  await writeFile(fixture, `import { useState } from 'react';\nexport function Broken({ enabled }: { enabled: boolean }) {\n  if (enabled) { useState(0); }\n  return null;\n}\n`);
  const cli = fileURLToPath(new URL('../bin/oxlint', import.meta.resolve('oxlint')));
  const result = spawnSync(process.execPath, [cli, '-c', fileURLToPath(new URL('./.oxlintrc.json', import.meta.url)), fixture], { cwd: root, encoding: 'utf8', env: fixtureEnvironment(root, { PATH: process.env.PATH }) });
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /react-hooks\(rules-of-hooks\)/);
  console.log('web hooks: conditional-hook fixture rejected by configured oxlint');
} finally { await rm(root, { recursive: true, force: true }); }
