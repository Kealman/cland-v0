// The skills cland ships (spec 4.9, decision #17): the vendored Matt Pocock set with cland's patches, and later
// cland's own. Their source of truth is this repository's `.agents/skills/` — the live copies cland's own
// sessions use, recorded in `skills-lock.json` and patched per `skills/PATCHES.md` — read relative to the cland
// package, so an installed cland provisions exactly what it was built with and nothing is duplicated.
//
// In a project, each skill goes to `.agents/skills/<name>/`, and `.claude/skills` is a symlink to
// `../.agents/skills` (Claude Code, Codex and OpenCode all see one set). A project that already has its own
// `.claude/skills/` folder keeps it and gets one symlink per cland skill in it instead. `.agents/skills/.cland-manifest.json`
// lists what cland installed, file by file: `cland update` refreshes those and only those; a skill folder the
// manifest does not list is the project's own and is never written.
import { lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANAGED_BY } from '../project.ts';
import { readText, writeIfChanged, type Report } from './files.ts';

/** The skills cland ships: this repository's `.agents/skills/`. */
export const SKILLS_SOURCE = fileURLToPath(new URL('../../../.agents/skills', import.meta.url));

export const MANIFEST = '.cland-manifest.json';
/** What `.claude/skills` points at when it is cland's symlink. */
export const SKILLS_LINK = `..${sep}.agents${sep}skills`;

type Manifest = { managed: string; skills: Record<string, string[]> };

const exists = (path: string): 'dir' | 'link' | 'file' | null => {
  try {
    const s = lstatSync(path);
    return s.isSymbolicLink() ? 'link' : s.isDirectory() ? 'dir' : 'file';
  } catch {
    return null;
  }
};

/** Every regular file under `dir`, relative to it, in a stable order. */
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (sub: string) => {
    for (const e of readdirSync(join(dir, sub), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = sub ? join(sub, e.name) : e.name;
      if (e.isDirectory()) walk(rel);
      else if (e.isFile()) out.push(rel);
    }
  };
  walk('');
  return out;
}

/** The skills shipped: each folder of the source holding a `SKILL.md`. */
export function shippedSkills(source = SKILLS_SOURCE): string[] {
  return readdirSync(source, { withFileTypes: true })
    .filter((e) => e.isDirectory() && exists(join(source, e.name, 'SKILL.md')) === 'file')
    .map((e) => e.name)
    .sort();
}

function readManifest(path: string): Manifest | null {
  const text = readText(path);
  if (text === null) return null;
  try {
    const m = JSON.parse(text) as Partial<Manifest>;
    return typeof m.skills === 'object' && m.skills !== null ? { managed: String(m.managed ?? ''), skills: m.skills } : null;
  } catch {
    return null;
  }
}

/** Remove a file and the folders it leaves empty, up to (not including) `stop`. */
function removeFile(path: string, stop: string): void {
  rmSync(path, { force: true });
  for (let dir = dirname(path); dir !== stop && dir.startsWith(stop); dir = dirname(dir)) {
    try {
      rmdirSync(dir);
    } catch {
      break;
    }
  }
}

/** Install or refresh the shipped skills in `<root>/.agents/skills/`; returns the names cland manages there. */
export function provisionSkills(report: Report, root: string, source = SKILLS_SOURCE): string[] {
  const target = join(root, '.agents', 'skills');
  const manifestPath = join(target, MANIFEST);
  // cland's own repository: the source is the project's own folder
  try {
    if (realpathSync(target) === realpathSync(source)) {
      report.add(target, 'kept', "cland's own repository: the skills' source");
      return [];
    }
  } catch {
    /* no target yet */
  }
  const previous = readManifest(manifestPath)?.skills ?? {};
  const manifest: Manifest = { managed: `${MANAGED_BY} — cland update rewrites the skills listed here; a skill folder not listed is the project's own`, skills: {} };
  for (const name of shippedSkills(source)) {
    const dir = join(target, name);
    if (!(name in previous) && exists(dir) !== null) {
      report.add(dir, 'kept', 'a skill of the project\'s own by that name: cland\'s is not installed');
      continue;
    }
    const files = filesUnder(join(source, name));
    let wrote = false;
    for (const rel of files) {
      const from = readFileSync(join(source, name, rel));
      const to = join(dir, rel);
      let current: Buffer | null = null;
      try {
        current = readFileSync(to);
      } catch {
        /* absent */
      }
      if (current !== null && current.equals(from)) continue;
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, from);
      wrote = true;
    }
    // files an earlier version installed that this one no longer ships
    for (const rel of previous[name] ?? []) {
      if (!files.includes(rel)) {
        removeFile(join(dir, rel), target);
        wrote = true;
      }
    }
    report.add(dir, wrote ? (name in previous ? 'updated' : 'created') : 'unchanged');
    manifest.skills[name] = files;
  }
  // skills an earlier version installed that this one no longer ships
  for (const [name, files] of Object.entries(previous)) {
    if (name in manifest.skills) continue;
    for (const rel of files) removeFile(join(target, name, rel), target);
    report.add(join(target, name), 'removed', 'no longer shipped by cland');
  }
  writeIfChanged(report, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return Object.keys(manifest.skills);
}

/**
 * `.claude/skills`: a symlink to `../.agents/skills` when the project has none; one symlink per managed skill
 * inside the project's own `.claude/skills/` folder when it has one; there, a link of cland's to a skill no longer
 * installed is removed.
 */
export function provisionClaudeSkills(report: Report, root: string, managed: readonly string[]): void {
  const link = join(root, '.claude', 'skills');
  const kind = exists(link);
  if (kind === null) {
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(SKILLS_LINK, link);
    report.add(link, 'created', `symlink to ${SKILLS_LINK}`);
    return;
  }
  if (kind === 'link') {
    const to = readlinkSync(link);
    if (to === SKILLS_LINK || to === `${SKILLS_LINK}${sep}`) report.add(link, 'unchanged');
    else report.add(link, 'kept', `a symlink of the project's own (to ${to})`);
    return;
  }
  if (kind === 'file') {
    report.add(link, 'kept', 'a file of the project\'s own: no skills linked for Claude Code');
    return;
  }
  // the project's own folder: one link per cland skill, theirs untouched
  const ours = (name: string) => join('..', '..', '.agents', 'skills', name);
  for (const name of managed) {
    const each = join(link, name);
    const k = exists(each);
    if (k === null) {
      symlinkSync(ours(name), each);
      report.add(each, 'created', `symlink to ${ours(name)}`);
    } else if (k === 'link' && readlinkSync(each) === ours(name)) report.add(each, 'unchanged');
    else report.add(each, 'kept', 'the project\'s own');
  }
  // links to skills cland no longer manages
  for (const e of readdirSync(link, { withFileTypes: true })) {
    if (!e.isSymbolicLink() || managed.includes(e.name)) continue;
    const each = join(link, e.name);
    if (readlinkSync(each) === ours(e.name) && exists(join(root, '.agents', 'skills', e.name)) === null) {
      rmSync(each);
      report.add(each, 'removed', 'no longer shipped by cland');
    }
  }
}
