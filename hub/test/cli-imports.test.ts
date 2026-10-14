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

const COUNTER = fileURLToPath(new URL('./fixtures/cli-imports/counter.ts', import.meta.url));

// Run the actual CLI, with caller discovery and Node preloads excluded.
function countedCommand(root: string, args: string[], failure?: string) {
  const counts = join(root, 'imports.json');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_') && key !== 'NODE_OPTIONS'));
  const result = spawnSync(process.execPath, ['--import', COUNTER, CLI, ...args], {
    cwd: root,
    env: { ...env, CLAND_TEST_IMPORT_COUNTS: counts, ...(failure ? { CLAND_TEST_IMPORT_FAILURE: failure } : {}) },
    encoding: 'utf8', timeout: 10_000,
  });
  assert.ifError(result.error);
  const urls: string[] = JSON.parse(readFileSync(counts, 'utf8'));
  return { result, urls };
}

test('CLI commands load only their own source closure within the import budgets', (t) => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'cland-cli-counts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // Measured with this registerHooks fixture on Node 24, running the real CLI in an
  // empty temporary project without a hub: task list loads 13 modules; hub status loads 16.
  // Command budgets add a rounded-up 10% margin.
  const commands: Array<{ args: string[]; code: number; budget: number; commands: string[] }> = [
    { args: ['--help'], code: 0, budget: 10, commands: [] },
    { args: ['--version'], code: 0, budget: 10, commands: [] },
    { args: [], code: 0, budget: 10, commands: [] },
    { args: ['task', 'list', '--json'], code: 1, budget: 15, commands: ['task.ts', 'task-import.ts', 'socket-client.ts', 'actor.ts'] },
    { args: ['hub', 'status'], code: 1, budget: 18, commands: ['hub.ts', 'socket-client.ts', 'actor.ts'] },
  ];
  for (const { args, code, budget, commands: allowed } of commands) {
    const { result, urls } = countedCommand(root, args);
    assert.equal(result.status, code, result.stderr);
    t.diagnostic(`cland ${args.join(' ')}: ${urls.length} hub/src modules`);
    assert.ok(urls.length > 0, 'the counter observed source imports');
    assert.ok(urls.length <= budget, `loaded ${urls.length} modules (budget ${budget}): ${urls.join(', ')}`);
    const cliModules = urls.filter(url => url.includes('/src/cli/') && !url.endsWith('/usage.ts'));
    assert.deepEqual(cliModules.map(url => url.slice(url.lastIndexOf('/') + 1)).sort(), [...allowed].sort());
  }
});

test('subcommand import failures retain each dispatch error line and exit code', (t) => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'cland-cli-failures-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const commands: Array<[string, string, number]> = [
    ['account', 'account', 1], ['executor', 'executor', 1], ['verify', 'suite', 1], ['suite', 'suite', 1],
    ['open', 'open', 1], ['--headless', 'qa', 2], ['--qa', 'qa', 2], ['init', 'init', 1], ['update', 'init', 1],
    ['doctor', 'doctor', 2], ['hub', 'hub', 1], ['subscribe', 'subscriptions', 1],
    ['unsubscribe', 'subscriptions', 1], ['subscriptions', 'subscriptions', 1], ['artifact', 'artifact', 1],
    ['task', 'task', 1], ['session', 'session', 1], ['push', 'push', 1], ['sync', 'release', 1],
    ['release', 'release', 1], ['merge', 'merge', 1], ['worktree', 'worktree', 1], ['crew', 'crew', 1],
    ['role', 'role', 1], ['inbox', 'inbox', 1], ['topic', 'inbox', 1], ['hook', 'hook', 0],
  ];
  for (const [command, module, code] of commands) {
    const { result } = countedCommand(root, [command], `../src/cli/${module}.ts`);
    assert.equal(result.status, code, `${command}: ${result.stderr}`);
    assert.equal(result.stdout, '', command);
    assert.equal(result.stderr, `${command === 'hook' ? 'cland hook' : 'cland'}: test subcommand import failure\n`, command);
  }
  // The internal fixture path has no dispatch catch: retain its unhandled-error exit.
  const { result } = countedCommand(root, ['--qa-fixture'], '../src/cli/qa-fixture.ts');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error: test subcommand import failure/);
});
