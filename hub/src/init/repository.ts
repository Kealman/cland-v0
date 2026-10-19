// Init's first-commit bootstrap. Repositories with history keep their history and index.
import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { territoryGit } from '../territory.ts';
import { readText, Report, symlinkOnPath, writeIfChanged } from './files.ts';
import { readManifest } from './skills.ts';

const CLAND_PATHS = ['AGENTS.md', '.cland', '.agents', '.claude', 'docs/agents'];

/** Inventory existing leaves before provisioning; never adopt a file init merely updates or merges. */
export function existingClandFiles(root: string): Set<string> {
  const files = new Set<string>();
  function visit(path: string): void {
    try {
      const stat = lstatSync(join(root, path));
      if (stat.isDirectory()) for (const name of readdirSync(join(root, path))) visit(`${path}/${name}`);
      else files.add(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  for (const path of CLAND_PATHS) {
    if (symlinkOnPath(root, join(root, path)) === null) visit(path);
  }
  return files;
}

/** Create main outside any repository; return whether init must make a first commit. */
export function createRepository(report: Report, root: string): boolean {
  try {
    territoryGit(root, ['rev-parse', '--git-dir']);
  } catch {
    territoryGit(root, ['init', '-q', '-b', 'main']);
    report.add(join(root, '.git'), 'created', 'git init -b main');
    const exclude = join(root, '.git', 'info', 'exclude');
    writeIfChanged(report, exclude, `${readText(exclude) ?? ''}\n/.DS_Store\n`);
    return true;
  }
  try {
    territoryGit(root, ['rev-parse', '--verify', 'HEAD']);
    return false;
  } catch { return true; } // An unborn branch needs the same first commit.
}

/** Commit the managed set, respecting .cland/.gitignore and bypassing machine commit hooks/signing. */
export function commitClandFiles(report: Report, root: string, existing: ReadonlySet<string> = new Set()): string | null {
  const skills = readManifest(join(root, '.agents', 'skills'));
  const kept = report.changes.filter(change => change.action === 'kept').map(change => change.path);
  const provisioned = report.changes.filter(change =>
    (change.action === 'created' || change.action === 'updated' || change.action === 'unchanged') &&
    CLAND_PATHS.some(path => change.path === path || change.path.startsWith(`${path}/`)),
  ).flatMap(change => {
    // Skill reports name a directory; only its validated manifest leaves belong to cland.
    const skill = /^\.agents\/skills\/([a-z0-9-]+)$/.exec(change.path)?.[1];
    if (!skill) return [change.path];
    const owned = skills.kind === 'ok' ? skills.manifest.skills[skill] : undefined;
    return owned ? (Array.isArray(owned) ? owned : Object.keys(owned)).map(file => `${change.path}/${file}`) : [];
  }).filter(path => {
    if (existing.has(path)) return false;
    if (kept.some(own => path === own || path.startsWith(`${own}/`))) return false;
    try {
      const stat = lstatSync(join(root, path));
      return stat.isFile() || stat.isSymbolicLink();
    } catch (error) {
      // Territory reports also include named operations, not filesystem leaves.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  });
  if (!provisioned.length) return null;
  const candidates = territoryGit(root, ['--literal-pathspecs', 'ls-files', '--others', '--exclude-standard', '-z', '--', ...provisioned]).split('\0').filter(Boolean);
  const ignored = territoryGit(root, ['--literal-pathspecs', 'ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--', ...provisioned]).split('\0').filter(Boolean);
  for (const path of ignored) {
    const change = report.changes.find(change => change.path === path);
    if (change) change.note = [change.note, 'not committed: ignored by Git'].filter(Boolean).join('; ');
    else report.add(join(root, path), 'kept', 'not committed: ignored by Git');
  }
  if (!candidates.length) return null;
  territoryGit(root, ['--literal-pathspecs', 'add', '--', ...candidates]);
  const branch = territoryGit(root, ['symbolic-ref', '--short', 'HEAD']);
  const paths = CLAND_PATHS.map(path => path === 'AGENTS.md' ? path : `${path}/`).join(', ');
  // Git's guessed login/hostname identity is not an explicit identity. Inspect keys,
  // including empty/partial settings, so those remain Git's to validate unchanged.
  const configured = territoryGit(root, ['config', '--list', '--name-only', '-z']).split('\0')
    .some(key => /^(user|author|committer)\.(name|email)$/.test(key));
  const identityEnv = ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'EMAIL'];
  const fallback = !configured && !identityEnv.some(key => process.env[key] !== undefined);
  const identity = fallback ? ['-c', 'user.name=cland', '-c', 'user.email=cland@local'] : [];
  // --only builds Git's temporary index for these paths, retaining every other staged entry.
  territoryGit(root, ['--literal-pathspecs', ...identity, '-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'commit', '--only', '-q', '-m', 'Initial commit: cland init', '-m', paths, '--', ...candidates]);
  const head = territoryGit(root, ['rev-parse', '--short', 'HEAD']);
  const attribution = fallback ? ' as cland <cland@local>: no Git identity is set' : '';
  report.add(join(root, '.git', 'refs', 'heads', branch), 'created', `first commit ${head}: ${paths} (${candidates.length} files)${attribution}`);
  return territoryGit(root, ['rev-parse', 'HEAD']);
}

/** Keep the original write action and the final observation when the territory runs twice. */
export function foldReport(report: Report, again: Report): void {
  for (const change of again.changes) {
    const previous = report.changes.find(entry => entry.path === change.path);
    if (!previous) report.changes.push(change);
    else {
      if (previous.action === 'unchanged') previous.action = change.action;
      if (change.note === undefined) delete previous.note;
      else previous.note = change.note;
    }
  }
}
