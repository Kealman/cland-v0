import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DependencyInstall } from './protocol.ts';

/** Merges never mutate an install shared by running hubs and task worktrees. */
export function dependencyInstall(root: string, files: readonly string[]): DependencyInstall | undefined {
  const changed = [...new Set(files.filter(file => /(^|\/)package(?:-lock)?\.json$/.test(file)))].sort();
  return changed.length ? { files: changed, command: 'npm install', cwd: root } : undefined;
}

export function dependencyInstallText(install: DependencyInstall): string {
  return `dependencies out of date: ${install.files.join(', ')} changed; run npm install in root ${install.cwd} (required; stop shared readers before updating node_modules)`;
}

/** Only missing packages present in the candidate's lockfile get an install hint. */
export async function missingDependencyHint(cwd: string, output: string, root = cwd): Promise<string | undefined> {
  if (!/\b(?:ERR_)?MODULE_NOT_FOUND\b/.test(output)) return;
  const missing = [...output.matchAll(/Cannot find (?:module|package) ['"]([^'"\n]+)['"]/g)].map(match => {
    const specifier = match[1]!.replaceAll('\\', '/').split('/node_modules/').at(-1)!;
    if (/^(?:\.|\/|[A-Za-z]:)/.test(specifier)) return null;
    return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;
  }).filter((name): name is string => name !== null);
  if (!missing.length) return;
  try {
    const lock = JSON.parse(await readFile(join(cwd, 'package-lock.json'), 'utf8'));
    const paths = Object.keys(lock.packages ?? {});
    const name = missing.find(name => paths.some(path => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)) || Object.hasOwn(lock.dependencies ?? {}, name));
    if (name) return `dependencies out of date: run npm install (in root ${root}; missing locked dependency ${name}; candidate ${cwd}; stop shared readers before updating node_modules)`;
  } catch { /* An absent/unreadable lockfile cannot establish a dependency diagnosis. */ }
}
