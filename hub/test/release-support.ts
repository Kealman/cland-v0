import { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dispatcherUi, projectHub, cland, connectUi, startDaemon, tempProject, type CliResult } from './harness.ts';
import { preparedReleaseProject } from './prepared-project.ts';

export const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
export const ok = (r: CliResult) => { assert.equal(r.code, 0, r.stderr || r.stdout); return r; };
export const json = <T>(r: CliResult): T => JSON.parse(ok(r).stdout) as T;

export async function project(t: TestContext, env: Record<string, string> = {}, serve: typeof projectHub | typeof startDaemon = projectHub, validation = false) {
  const { root, github } = await preparedReleaseProject(t, 'cland-release-');
  const served = await serve(t, root, env);
  const { discovery } = served;
  const ui = validation && 'dispatcher' in served ? await dispatcherUi(t, served.dispatcher, root) : await connectUi(t, discovery);
  return { root, github, ui, discovery, territory: join(root, '.cland', 'territory.git') };
}

export async function merged(root: string, title: string, file: string) {
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--size', 'M', title, '--json'));
  const { worktree } = json<{ worktree: { path: string } }>(await cland(root, 'task', 'claim', item.id, '--json'));
  await writeFile(join(worktree.path, file), 'finished\n');
  git(worktree.path, 'add', file);
  git(worktree.path, 'commit', '-qm', title);
  ok(await cland(root, 'merge', item.id, '--override', 'test fixture'));
  return item.id;
}

export async function clean(root: string) {
  git(root, 'add', '.');
  git(root, 'commit', '--allow-empty', '-qm', 'Commit tracker and project setup');
}

export async function collaborator(t: TestContext, github: string, file: string, content: string) {
  const clone = await tempProject(t, 'cland-collaborator-');
  git(clone, 'clone', '-q', github, '.');
  git(clone, 'config', 'user.name', 'Collaborator');
  git(clone, 'config', 'user.email', 'collaborator@example.com');
  await writeFile(join(clone, file), content);
  git(clone, 'add', file);
  git(clone, 'commit', '-qm', 'Work on GitHub');
  git(clone, 'push', '-q', 'origin', 'main');
  return git(clone, 'rev-parse', 'HEAD');
}
