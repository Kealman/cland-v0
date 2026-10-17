// Shared in-process task parser/tracker fixture; no native process edges.
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { projectHub, tempProject, type CliResult } from './harness.ts';
import { runTask } from '../src/cli/task.ts';
import { FakeClock } from './fake-clock.ts';

/** `cland <args>` in `cwd` with `input` on stdin (for `--body-file -`), with no `CLAND_*` variable from the test's environment. */
export async function cland(cwd: string, input: string, ...args: string[]): Promise<CliResult> {
  assert.equal(args.shift(), 'task');
  args = args.map((arg, i) => args[i - 1] === '--body-file' && arg !== '-' ? resolve(cwd, arg) : arg);
  let stdout = '';
  let stderr = '';
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_')));
  const code = await runTask(args, cwd, { out: text => { stdout += text; }, err: text => { stderr += text; }, stdin: () => input }, env);
  return { code, stdout, stderr };
}

export const ok = (r: CliResult): CliResult => {
  assert.equal(r.code, 0, `exit ${r.code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
};

export type Item = {
  id: string;
  kind: string;
  title: string;
  state: string;
  labels: string[];
  assignee: string | null;
  parent: string | null;
  blocked_by: string[];
  claim: { session: string } | null;
};
export type View = Item & { path: string; body: string; comments: Array<{ author: string; text: string }> };

/** `cland task <args> --json`, parsed. */
export const task = async <T>(root: string, args: string[], input = ''): Promise<T> => JSON.parse(ok(await cland(root, input, 'task', ...args, '--json')).stdout) as T;
export const create = async (root: string, args: string[], body = ''): Promise<string> => (await task<{ item: View }>(root, ['create', ...args, '--body-file', '-'], body)).item.id;
export const list = async (root: string, ...args: string[]): Promise<Item[]> => (await task<{ items: Item[] }>(root, ['list', ...args])).items;
export const view = async (root: string, id: string): Promise<View> => (await task<{ item: View }>(root, ['view', id])).item;

const frontmatter = (text: string): Record<string, unknown> => parseYaml(/^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '') as Record<string, unknown>;
export async function itemFile(root: string, id: string): Promise<{ fm: Record<string, unknown>; text: string }> {
  const dir = join(root, '.cland', 'tasks');
  const name = (await readdir(dir)).find((n) => n.startsWith(`${id}-`) && n.endsWith('.md'));
  assert.ok(name, `no file for ${id} in .cland/tasks`);
  const text = await readFile(join(dir, name), 'utf8');
  return { fm: frontmatter(text), text };
}

export async function project(t: TestContext): Promise<string> {
  const root = await tempProject(t, 'cland-skills-');
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  return root;
}

