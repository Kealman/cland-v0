// Shared filesystem fixture for init's module tests and process contracts.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clandWithEnv } from './harness.ts';
import { captureCli } from './cli-in-process.ts';
import { runInit, runUpdate } from '../src/cli/init.ts';
import { provision } from '../src/init/provision.ts';
export const REPO = fileURLToPath(new URL('../../', import.meta.url));
const SOURCE_SKILLS = join(REPO, '.agents', 'skills');
export const VERSION = (JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;
export function assertNoMachinePath(text: string, machine: string, file: string): void {
  const escaped = machine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // An absolute path starts outside another path and ends at a component boundary (including a child slash).
  const path = new RegExp(`(?:^|[^\\w./~-])${escaped}(?=$|[^\\w.~-])`);
  assert.ok(!path.test(text), `${file} names ${machine}`);
}

export type Change = { path: string; action: string; note?: string };

export const sh = (cwd: string, command: string, env: Record<string, string> = {}): Promise<{ code: number; stdout: string; stderr: string }> =>
  new Promise((resolve) =>
    execFile('sh', ['-c', command], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' }, (err, stdout, stderr) => resolve({ code: err ? Number(err.code ?? 1) : 0, stdout, stderr })),
  );

export async function gitRepo(root: string): Promise<void> {
  const r = await sh(root, 'git init -q && git config user.email t@example.com && git config user.name t');
  assert.equal(r.code, 0, r.stderr);
}

export async function run(root: string, command: 'init' | 'update', env: Record<string, string> = {}): Promise<Change[]> {
  // Version is a module constant: the old-release fixture needs a fresh module graph.
  if (env.CLAND_VERSION_OVERRIDE) return runCli(root, command, env);
  if (env.CLAND_SKILLS_SOURCE_OVERRIDE) return provision(root, { skillsSource: env.CLAND_SKILLS_SOURCE_OVERRIDE, territory: command === 'init' });
  const r = await captureCli(write => command === 'init' ? runInit(['--json'], root, write) : runUpdate(['--json'], root, write));
  assert.equal(r.code, 0, `cland ${command}: ${r.stderr}`);
  return (JSON.parse(r.stdout) as { changes: Change[] }).changes;
}

/** What `git status` shows as new or changed, one path per file (untracked folders expanded). */
export async function gitStatus(root: string): Promise<string[]> {
  const r = await sh(root, 'git status --porcelain -uall');
  return r.stdout
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3))
    .sort();
}

/** Every file and symlink under `root` but `.git/` and the hub's volatile state, by its content hash (a link: its target). */
export async function tree(root: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const walk = async (rel: string) => {
    for (const e of await readdir(join(root, rel), { withFileTypes: true })) {
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (path === '.git' || /^\.cland\/(hub\.db|hub\.json|hub\.lock|hub\.sock|secret|log)/.test(path)) continue;
      if (e.isSymbolicLink()) out.set(path, `-> ${await readlink(join(root, path))}`);
      else if (e.isDirectory()) await walk(path);
      else out.set(path, createHash('sha256').update(await readFile(join(root, path))).digest('hex'));
    }
  };
  await walk('');
  return out;
}

export const changed = (a: Map<string, string>, b: Map<string, string>): string[] =>
  [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k)).sort();

/** The skills cland ships, and every file of theirs as a project path. */
export async function shipped(): Promise<{ names: string[]; files: string[] }> {
  const names: string[] = [];
  const files: string[] = [];
  for (const e of await readdir(SOURCE_SKILLS, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    names.push(e.name);
    for (const f of await readdir(join(SOURCE_SKILLS, e.name), { recursive: true, withFileTypes: true })) {
      if (f.isFile()) files.push(`.agents/skills/${join(f.parentPath, f.name).slice(SOURCE_SKILLS.length + 1)}`);
    }
  }
  return { names: names.sort(), files: files.sort() };
}

export async function runCli(root: string, command: 'init' | 'update', env: Record<string, string> = {}): Promise<Change[]> {
  const r = await clandWithEnv(root, env, command, '--json');
  assert.equal(r.code, 0, r.stderr);
  const report = JSON.parse(r.stdout) as { version: string; changes: Change[] };
  assert.equal(report.version, env.CLAND_VERSION_OVERRIDE || VERSION);
  return report.changes;
}
