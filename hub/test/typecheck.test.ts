// T3 compiler contract: real npm/compiler processes resolve the pinned aliases
// from a root install, an inherited worktree install and a worktree-local install.
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { fixtureSource, sourceFixtureFiles } from './source-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

const source = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const modules = dirname(dirname(require.resolve('typescript/package.json')));

test('typecheck resolves pinned compilers in roots and linked worktrees', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-typecheck-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = fixtureEnvironment(root, process.env);
  await mkdir(env.HOME!, { recursive: true });
  // Keep the real workspace scripts, launcher and configs. Compiler resolution
  // uses minimal hub/Neovim/wire sources plus the declared UI workspace and guards.
  const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8')) as { workspaces: string[]; scripts: Record<string, string> };
  const assets = ['package.json', ...manifest.workspaces.map(workspace => `${workspace}/package.json`),
    ...[...manifest.scripts.typecheck!.matchAll(/-p\s+(\S+\.json)/g)].map(match => match[1]!)];
  const workspaceSources: string[] = [];
  for (const workspace of manifest.workspaces) {
    const files = await readdir(join(source, workspace));
    assets.push(...files.filter(file => /^tsconfig.*\.json$/.test(file)).map(file => `${workspace}/${file}`));
    if (workspace === 'hub') continue; // The compiler fixture supplies a minimal hub source below.
    await cp(join(source, workspace), join(root, workspace), { recursive: true,
      filter: path => !['node_modules', 'dist'].includes(path.split('/').at(-1)!),
    });
    const workspaceManifest = JSON.parse(await readFile(join(source, workspace, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    // Seed the closure from every configured compiler input, including nested
    // tests and tools that import modules outside their workspace.
    for (const [, config] of workspaceManifest.scripts.typecheck!.matchAll(/-p\s+(\S+\.json)/g)) {
      const parsed = ts.getParsedCommandLineOfConfigFile(join(source, workspace, config!), {}, {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
      });
      assert.ok(parsed);
      assert.deepEqual(parsed.errors, []);
      workspaceSources.push(...parsed.fileNames.map(file => relative(source, file)));
    }
  }
  // The web token guard compares the shipped palette at this runtime-loaded path.
  assets.push('nvim/lua/cland/hl.lua');
  const generated = ['hub/src/fixture.ts', 'nvim/bin/fixture.ts', 'shared/wire/fixture.ts'];
  const read = fixtureSource(source);
  const readSource = async (file: string) => file === 'shared/wire/fixture.ts'
    ? 'export const protocolVersion: number = 1;\n'
    : generated.includes(file)
    ? "import { basename } from 'node:path';\nimport { assertTestAdmission } from '../../test-support/admission.ts';\nexport const name: string = basename(import.meta.filename);\nexport const admission: () => Promise<void> = assertTestAdmission;\n"
    : read(file);
  for (const path of await sourceFixtureFiles(readSource, ['hub/bin/typecheck.ts', ...generated, ...workspaceSources], assets)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    if (assets.includes(path)) await cp(join(source, path), join(root, path));
    else await writeFile(join(root, path), (await readSource(path))!);
  }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', timeout: 30_000 });
  git('init', '-q');
  git('add', 'package.json', 'hub', 'nvim', 'shared', 'test-support', ...manifest.workspaces);
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Typecheck fixture');
  await symlink(modules, join(root, 'node_modules'), 'dir');
  const worktree = join(root, '.cland', 'worktrees', 'T-1');
  git('worktree', 'add', '--detach', worktree, 'HEAD');
  assert.equal(existsSync(join(worktree, 'node_modules')), false);
  const check = (cwd: string, ...args: string[]) => {
    const result = spawnSync('npm', ['run', 'typecheck', ...args], { cwd, env, encoding: 'utf8', timeout: 60_000 });
    assert.equal(result.status, 0, `${cwd}\n${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    return result.stdout;
  };
  check(root);
  check(worktree);
  // The two aliases share a bin name: prove this is 7, while API imports stay 5.9.
  assert.match(check(worktree, '--workspace', 'hub', '--', '--version'), /Version 7\.0\.2/);
  const api = createRequire(join(worktree, 'hub', 'package.json'))('typescript');
  assert.equal(api.version, '5.9.3');
  assert.equal(typeof api.createProgram, 'function');
  await symlink(modules, join(worktree, 'node_modules'), 'dir');
  check(worktree);
});
