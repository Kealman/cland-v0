// Observe the real command's import graph, including dynamic imports and erased TypeScript types.
// This guard does not depend on whether the running Node version warns about node:sqlite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));

test('database-free CLI commands never resolve node:sqlite in their import graph', (t) => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'cland-cli-imports-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const imports = join(root, 'sqlite-imports.log');
  const preload = `data:text/javascript,${encodeURIComponent(`
    import { registerHooks } from 'node:module';
    import { appendFileSync } from 'node:fs';
    registerHooks({ resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      if (resolved.url === 'node:sqlite') {
        appendFileSync(${JSON.stringify(imports)}, context.parentURL + ' -> node:sqlite\\n');
      }
      return resolved;
    } });
  `)}`;
  // Neither hub discovery nor warning settings from the caller may affect these child processes.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_') && key !== 'NODE_OPTIONS' && key !== 'NODE_NO_WARNINGS'));
  const run = (args: string[]) => {
    writeFileSync(imports, '');
    const result = spawnSync(process.execPath, ['--import', preload, ...args], { cwd: root, env, encoding: 'utf8', timeout: 10_000 });
    assert.ifError(result.error);
    return result;
  };

  // Prove the observer sees SQLite, rather than passing because a hook never ran.
  const control = run(['--input-type=module', '--eval', "await import('node:sqlite')"]);
  assert.equal(control.status, 0, control.stderr);
  assert.match(readFileSync(imports, 'utf8'), / -> node:sqlite\n/);

  const commands: Array<[string[], number]> = [
    [[], 0],
    [['--help'], 0],
    [['--version'], 0],
    [['unknown-command'], 2],
    [['inbox'], 1],
    [['inbox', '--json'], 1],
    [['topic', 'answer', 'some-ask', '1'], 1],
    [['topic', 'answer', 'some-ask', '--text', 'answer'], 1],
    [['task', 'list'], 1],
    [['session', 'list'], 1],
    [['role', 'list'], 1],
    [['worktree', 'list'], 1],
    [['merge', 'T-1'], 1],
    [['push'], 1],
    [['release', 'v0.1.0', '--dry-run'], 1],
    [['sync'], 1],
    [['artifact', 'list'], 1],
    [['subscribe', 'session', 'coord', '--event', 'session.state'], 1],
    [['unsubscribe', 'subscription-id'], 1],
    [['subscriptions'], 1],
    [['hook', 'Stop'], 0],
    [['hub', 'status'], 1],
    [['hub', 'stop'], 0],
    [['hub', 'audit'], 0],
    [['hub', 'journal'], 0],
    [['hub', 'subscriptions'], 1],
    [['hub', 'unmute', 'a', 'b'], 1],
    [['--headless', '--qa', '--help'], 0],
  ];
  for (const [args, code] of commands) {
    const result = run([CLI, ...args]);
    const command = `cland ${args.join(' ')}`;
    assert.equal(readFileSync(imports, 'utf8'), '', `${command} imported SQLite`);
    assert.equal(result.status, code, `${command}: ${result.stderr}`);
  }
});
