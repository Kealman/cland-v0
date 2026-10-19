import { onCleanup } from './process-cleanup.ts';
import { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nativeProjectHub, cland, connectUi, killDaemon, inProcessSpoke, startDaemon, tempProject, type CliResult } from './harness.ts';
import { preparedProject } from './prepared-project.ts';
// Native Git is retained only by the named T3 landing/checkout/recovery seams.
const projectHub: typeof nativeProjectHub = (t, root, env) => nativeProjectHub(t, root, env, { harnesses: 'fake' });
export const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

export const ok = (r: CliResult) => { assert.equal(r.code, 0, r.stderr || r.stdout); return r; };

export const json = <T>(r: CliResult): T => JSON.parse(ok(r).stdout) as T;

export async function project(t: TestContext, env: Record<string, string> = {}, serve: typeof projectHub | typeof startDaemon = projectHub) {
  const root = await preparedProject(t, 'territory', 'cland-merge-');
  const served = await serve(t, root, env);
  const { discovery } = served;
  const ui = await connectUi(t, discovery);
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', sessionId: 'reviewer-id', role: 'reviewer' });
  onCleanup(t, () => rev.close());
  await rev.waitForPresence(['rev']);
  return { root, ui, rev, discovery, stop: 'stop' in served ? served.stop : () => killDaemon(discovery.pid) };
}

export async function task(root: string, title = 'Ship the parser', file = 'parser.txt') {
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--size', 'M', title, '--json'));
  const { worktree } = json<{ worktree: { path: string; branch: string } }>(await cland(root, 'task', 'claim', item.id, '--json'));
  await writeFile(join(worktree.path, file), 'first\n');
  git(worktree.path, 'add', file);
  git(worktree.path, 'commit', '-qm', 'First step');
  await writeFile(join(worktree.path, file), 'finished\n');
  git(worktree.path, 'commit', '-qam', 'Second step');
  return { id: item.id, ...worktree };
}

export async function review(rev: Awaited<ReturnType<typeof inProcessSpoke>>, id: string, result = 'clear', run = 'rev-1') {
  const r = await rev.call<{ ok: boolean; error?: string }>('task.comment', { id, verdict: 'review', scope: 'full', result, run });
  assert.equal(r.ok, true, r.error);
}

export async function refused(ui: Awaited<ReturnType<typeof connectUi>>, root: string, id: string, code: string, files?: string[]) {
  const refs = git(root, 'show-ref');
  const r = await ui.request({ type: 'merge', item: id }, 30_000);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal((r as { code?: string }).code, code, r.error);
  if (files) assert.deepEqual((r as { files?: string[] }).files, files);
  assert.equal(git(root, 'show-ref'), refs, 'a gate refusal moves no ref');
  return r;
}

export async function indexLockProject(t: TestContext, failure: 'transient-lock' | 'persistent-lock' | 'crash-before-ref' = 'transient-lock', serve: typeof projectHub | typeof startDaemon = projectHub) {
  const bin = await tempProject(t, 'cland-index-lock-bin-');
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  await writeFile(join(bin, 'index-lock.mjs'), `#!${process.execPath}\nimport { spawnSync } from 'node:child_process';\nimport { existsSync, writeFileSync, rmSync } from 'node:fs';\nconst args = process.argv.slice(2);\nconst marker = '.cland/checkout-mutated';\nconst failed = '.cland/write-tree-failed';\nif (process.env.CLAND_TEST_KILL_BEFORE_REF === '1' && args[0] === 'update-ref' && args[1] === 'refs/heads/dev') { writeFileSync('.cland/before-ref-crash', 'crashed'); process.kill(process.ppid, 'SIGKILL'); process.exit(1); }\nconst fail = process.env.CLAND_TEST_KILL_BEFORE_REF !== '1' && args[0] === 'write-tree' && existsSync(marker) && !existsSync(failed);\nif (fail) { writeFileSync('.git/index.lock', 'held'); writeFileSync(failed, 'failed'); }\nconst result = spawnSync(${JSON.stringify(realGit)}, args, { stdio: 'inherit' });\nif (args[0] === 'read-tree' && args[1] === '-m' && result.status === 0) writeFileSync(marker, 'changed');\nif (fail && process.env.CLAND_TEST_KEEP_INDEX_LOCK !== '1') rmSync('.git/index.lock');\nprocess.exit(result.status ?? 1);\n`, { mode: 0o755 });
  // Only intercepted operations pay for a Node process. Other commands still
  // execute real Git, without compiling the fault-injection fixture each time.
  const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
  await writeFile(join(bin, 'git'), `#!/bin/sh
case "$1" in
  read-tree|write-tree|update-ref) exec ${quote(process.execPath)} ${quote(join(bin, 'index-lock.mjs'))} "$@" ;;
esac
exec ${quote(realGit)} "$@"
`, { mode: 0o755 });
  return project(t, { PATH: `${bin}:${process.env.PATH ?? ''}`, CLAND_TEST_KEEP_INDEX_LOCK: failure === 'persistent-lock' ? '1' : '0', CLAND_TEST_KILL_BEFORE_REF: failure === 'crash-before-ref' ? '1' : '0' }, serve);
}
