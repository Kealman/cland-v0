import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { DependencyInstall } from './protocol.ts';

/** The package.json fields whose change moves node_modules. Version, scripts, name and other metadata do not. */
const INSTALL_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'overrides', 'workspaces'] as const;

/** A changed manifest's content on the integration base and on the candidate. */
export type ManifestContents = { before: string | null; after: string | null };

const isManifest = (file: string): boolean => /(^|\/)package\.json$/.test(file);
const isLockfile = (file: string): boolean => /(^|\/)package-lock\.json$/.test(file);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** True when a changed package.json moves an install field. Missing or unreadable content counts as a change. */
function manifestDependenciesChanged(before: string | null, after: string | null): boolean {
  if (before === null || after === null) return true;
  try {
    const oldManifest: unknown = JSON.parse(before);
    const newManifest: unknown = JSON.parse(after);
    if (!isRecord(oldManifest) || !isRecord(newManifest)) return true;
    return INSTALL_FIELDS.some(field => !isDeepStrictEqual(oldManifest[field], newManifest[field]));
  } catch { return true; }
}

/**
 * The root install a landing requires: a changed lockfile, or a package.json whose install fields moved.
 * `contents` supplies a changed manifest's two sides; an absent answer keeps the conservative warning.
 */
export function dependencyInstall(root: string, files: readonly string[], contents: (file: string) => ManifestContents | undefined = () => undefined): DependencyInstall | undefined {
  const changed = [...new Set(files.filter(file => {
    if (isLockfile(file)) return true;
    if (!isManifest(file)) return false;
    const pair = contents(file);
    return pair === undefined || manifestDependenciesChanged(pair.before, pair.after);
  }))].sort();
  return changed.length ? { files: changed, command: 'npm install', cwd: root } : undefined;
}

/** The root install for a candidate between two revisions, reading each changed manifest at both. */
export async function dependencyInstallBetween(root: string, files: readonly string[], revisions: { before: string; after: string }, read: (revision: string, path: string) => Promise<string | null>): Promise<DependencyInstall | undefined> {
  const manifests = new Map<string, ManifestContents>();
  for (const file of new Set(files.filter(isManifest))) {
    const [before, after] = await Promise.all([
      read(revisions.before, file).catch(() => null),
      read(revisions.after, file).catch(() => null),
    ]);
    manifests.set(file, { before, after });
  }
  return dependencyInstall(root, files, file => manifests.get(file));
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
