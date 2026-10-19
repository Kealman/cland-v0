// Empty-folder init's Git bootstrap. Existing repositories keep their history and index.
import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { territoryGit } from '../territory.ts';
import { readText, Report, writeIfChanged } from './files.ts';
import { readManifest } from './skills.ts';

const CLAND_PATHS = ['AGENTS.md', '.cland', '.agents', '.claude', 'docs/agents'];

/** Create main only outside any repository and without adopting the project's own files. */
export function createRepository(report: Report, root: string): boolean {
  try {
    territoryGit(root, ['rev-parse', '--git-dir']);
    return false;
  } catch { /* no repository yet */ }
  const allowed = new Set(['AGENTS.md', '.cland', '.agents', '.claude', 'docs', '.DS_Store']);
  if (readdirSync(root).some(name => !allowed.has(name))) return false;
  if (readdirSync(root).includes('docs') && readdirSync(join(root, 'docs')).some(name => name !== 'agents')) return false;
  territoryGit(root, ['init', '-q', '-b', 'main']);
  report.add(join(root, '.git'), 'created', 'git init -b main');
  // Finder metadata is explicitly allowed beside the empty project, but is never part of its history.
  const exclude = join(root, '.git', 'info', 'exclude');
  writeIfChanged(report, exclude, `${readText(exclude) ?? ''}\n/.DS_Store\n`);
  return true;
}

/** Commit the managed set, respecting .cland/.gitignore and bypassing machine commit hooks/signing. */
export function commitClandFiles(report: Report, root: string): void {
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
  if (!provisioned.length) return;
  const candidates = territoryGit(root, ['--literal-pathspecs', 'ls-files', '--others', '--exclude-standard', '-z', '--', ...provisioned]).split('\0').filter(Boolean);
  if (!candidates.length) return;
  territoryGit(root, ['--literal-pathspecs', 'add', '--', ...candidates]);
  const files = territoryGit(root, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
  const paths = CLAND_PATHS.map(path => path === 'AGENTS.md' ? path : `${path}/`).join(', ');
  territoryGit(root, ['-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'Initial commit: cland init', '-m', paths]);
  const head = territoryGit(root, ['rev-parse', '--short', 'HEAD']);
  report.add(join(root, '.git', 'refs', 'heads', 'main'), 'created', `first commit ${head}: ${paths} (${files.length} files)`);
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
