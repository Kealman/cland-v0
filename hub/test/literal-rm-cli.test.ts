// T2: the shipped CLI itself is the subject: Bash hook stdin, exit code and stderr, without a hub.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { fixtureEnvironment } from './fixture-environment.ts';
import { assertTestAdmission } from '../src/test-admission.ts';
import { clandCliLaunch } from './tier-cli.ts';

test('managed literal-rm hook refuses before approval and allows retry without a running hub', async t => {
  await assertTestAdmission();
  const root = mkdtempSync(join(tmpdir(), 'cland-literal-rm-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const entry = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));
  const invoke = (input: string) => clandCliLaunch(() => spawnSync(process.execPath, [entry, 'hook', 'literal-rm'], {
    cwd: root, encoding: 'utf8', input, timeout: 10000,
    env: fixtureEnvironment(root, process.env),
  }));
  const refused = invoke(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'rm -rf "$target"' } }));
  assert.equal(refused.status, 2, refused.stderr);
  assert.equal(refused.signal, null);
  assert.match(refused.stderr, /every path written out literally/);
  assert.equal(refused.stdout, '');
  for (const input of [JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/example.AbC123' } }), '{']) {
    const allowed = invoke(input);
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.equal(allowed.stderr, '');
  }
});
