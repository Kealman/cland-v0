import { withInitGitIdentity } from './git-identity-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { verificationFixture, type FixtureStack } from './verification-fixture.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';
// Worker-local seeds are private. Copy every file (including objects), never hardlink
// or share mutable Git/.cland state. The package runner sweeps the worker's tmpdir.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, type TestContext } from 'node:test';
import { tempProject } from './harness.ts';
import { ownDirectory } from './process-cleanup.ts';
import { provisionTerritory } from '../src/territory.ts';
import { Report } from '../src/init/files.ts';
import { provision } from '../src/init/provision.ts';

type Shape = 'repository' | 'territory' | 'release' | 'verification' | 'native-territory';
const seeds = new Map<string, Promise<string>>();
const cleanups: Array<() => Promise<void>> = [];
after(async () => { for (const cleanup of cleanups.reverse()) await cleanup(); });
const git = (root: string, ...args: string[]) => execFileSync('git', args, { env: fixtureEnvironment(root, process.env), cwd: root, encoding: 'utf8' });

async function build(shape: Shape, stack: FixtureStack): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), `cland-prepared-${process.pid}-${shape}-`)));
  cleanups.push(ownDirectory(undefined, root));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  if (shape === 'native-territory') await writeFile(join(root, '.gitignore'), '.cland/\n');
  if (shape === 'verification') await verificationFixture(root, stack);
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Initial');
  if (shape === 'release') {
    await mkdir(`${root}-github`);
    cleanups.push(ownDirectory(undefined, `${root}-github`));
    git(root, 'clone', '-q', '--bare', '.', `${root}-github`);
    git(root, 'remote', 'add', 'origin', `${root}-github`);
  }
  if (shape === 'native-territory') provisionTerritory(new Report(root), root);
  else if (shape !== 'repository') {
    // These fixtures deliberately start with an empty tracker; init's category contract
    // belongs to init-categories/first-commit, not every consumer's item numbering.
    await withInitGitIdentity(root, () => provision(root, { territory: true, categories: false, env: fixtureEnvironment(root, process.env) }));
  }
  if (shape === 'verification') {
    const path = join(root, '.cland/config.toml');
    const config = parseConfig(await readFile(path, 'utf8'), 'fixture');
    config.verification.prepare = stack.prepare ?? '';
    config.verification.check = stack.stack === 'other' ? stack.check : 'npm run typecheck';
    config.verification.test = stack.stack === 'other' ? stack.test : 'npm test';
    await writeFile(path, renderConfig(config));
  }
  return root;
}

/** Fill an already owned empty tempProject with a private copy of a prepared shape. */
export async function copyPreparedProject(root: string, shape: Shape = 'territory', github?: string, stack: FixtureStack = {}): Promise<void> {
  assert.deepEqual(await readdir(root), [], 'prepared copies need an empty owned project');
  const key = JSON.stringify({ shape, ...stack });
  let seed = seeds.get(key);
  if (!seed) {
    seed = build(shape, stack);
    seeds.set(key, seed);
  }
  const source = await seed;
  await cp(source, root, { recursive: true, verbatimSymlinks: true });
  if (shape === 'release') {
    assert.ok(github, 'a release fixture needs its own GitHub stand-in');
    await cp(`${source}-github`, github, { recursive: true, verbatimSymlinks: true });
  }
  // Only Git config contains operational absolute paths; hooks and skills use
  // relative paths. Reflog messages are historical and need no relocation.
  const config = join(root, '.git/config');
  let text = await readFile(config, 'utf8');
  if (github) text = text.replaceAll(`${source}-github`, github);
  await writeFile(config, text.replaceAll(source, root));
}

/** Same lifetime/process ownership as tempProject; default is provisioned with an empty tracker. */
export async function preparedProject(t: TestContext, shape: Exclude<Shape, 'release'> = 'territory', prefix = 'cland-proj-', stack: FixtureStack = {}): Promise<string> {
  const root = await tempProject(t, prefix);
  await copyPreparedProject(root, shape, undefined, stack);
  return root;
}

export async function preparedReleaseProject(t: TestContext, prefix = 'cland-release-'): Promise<{ root: string; github: string }> {
  const root = await tempProject(t, prefix);
  const github = await tempProject(t, 'cland-github-');
  await copyPreparedProject(root, 'release', github);
  return { root, github };
}
