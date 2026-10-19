import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
const CLAND_PATHS = ['.cland', '.agents', '.claude', 'AGENTS.md', 'CLAUDE.md', 'docs/agents'];
const clandOwned = (path: string) => (path === '.DS_Store' || path.endsWith('/.DS_Store')) || CLAND_PATHS.some(own => path === own || path.startsWith(`${own}/`));

export type ProjectKind = 'empty' | 'existing';
export type ProjectGit = (args: readonly string[], options: { cwd: string; env: NodeJS.ProcessEnv; maxBuffer: number }) => Promise<{ stdout: string }>;
const gitFiles: ProjectGit = (args, options) => promisify(execFile)('git', args, options);
export const kindOfFiles = (files: readonly string[]): ProjectKind => files.some(file => !clandOwned(file)) ? 'existing' : 'empty';

/** Tracked and non-ignored untracked files count; cland's own paths do not. */
export async function projectKind(root: string, env: NodeJS.ProcessEnv, git: ProjectGit = gitFiles): Promise<ProjectKind> {
  try {
    const { stdout } = await git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, env, maxBuffer: 16 * 1024 * 1024 });
    return kindOfFiles(stdout.split('\0').filter(Boolean));
  } catch {
    return kindOfFiles((await readdir(root)).filter(file => file !== '.git'));
  }
}
