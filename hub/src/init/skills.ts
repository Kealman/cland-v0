// The curated skill set cland ships: cland's own skills and the upstream skills it keeps, recording their
// origins and cland's changes in their headers. Their source of truth is this repository's `.agents/skills/`,
// the live copies cland's own sessions use, read relative to the cland package. An installed cland provisions
// exactly what it was built with and nothing is duplicated.
//
// In a project, each skill goes to `.agents/skills/<name>/`, and `.claude/skills` is a symlink to
// `../.agents/skills` (Claude Code, Codex and OpenCode all see one set). A project that already has its own
// `.claude/skills/` folder keeps it and gets one symlink per cland skill in it instead. `.agents/skills/.cland-manifest.json`
// records what cland installed, file by file, with the SHA-256 of the bytes cland wrote. Earlier manifests
// list paths without hashes and remain readable. `cland update` compares the whole skill with its install hashes:
// an untouched copy is refreshed, an edited copy is kept whole. A skill folder the manifest does not list is
// the project's own and is never written.
//
// The manifest is trusted only once validated (review of #39): it carries the mark, each skill name is
// `[a-z0-9-]+`, each hash is 64 lowercase hex characters, and each path is relative, with no empty, `.` or `..`
// segment, resolving inside `.agents/skills/<name>/`. A manifest failing any of that is reported, and nothing is installed, rewritten or
// removed. A file added, changed or deleted in the project keeps the entire hashed skill and its original hashes;
// a project copy matching the current shipped skill adopts its hashes. Legacy path lists retain per-file ownership
// until migrated. Nothing is written or removed through a symlink
// (`files.ts`). Skill files need no "managed by cland" mark of their own: the manifest's mark covers every file it lists.
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANAGED_BY } from '../project.ts';
import { readText, refuseSymlink, symlinkNote, symlinkOnPath, writeAtomic, writeIfChanged, type Report } from './files.ts';

/** The skills cland ships: this repository's `.agents/skills/` (`CLAND_SKILLS_SOURCE_OVERRIDE`: tests simulating a release). */
export const SKILLS_SOURCE = process.env.CLAND_SKILLS_SOURCE_OVERRIDE || fileURLToPath(new URL('../../../.agents/skills', import.meta.url));

export const MANIFEST = '.cland-manifest.json';
/** What `.claude/skills` points at when it is cland's symlink. */
export const SKILLS_LINK = `..${sep}.agents${sep}skills`;

export type ManifestFiles = string[] | Record<string, string>;
export type Manifest = { managed: string; skills: Record<string, ManifestFiles> };

const paths = (files: ManifestFiles): string[] => Array.isArray(files) ? files : Object.keys(files);
const hashBytes = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

/** Compare complete skill copies, including their file sets. */
function sameHashes(a: Record<string, string> | null, b: Record<string, string>): boolean {
  return a !== null && Object.keys(a).length === Object.keys(b).length && Object.entries(b).every(([rel, hash]) => a[rel] === hash);
}

/** Inspect the project's whole skill without following links or ignoring added entries. */
function installedHashes(report: Report, dir: string): Record<string, string> | null {
  if (exists(dir) !== 'dir') return null;
  const hashes: Record<string, string> = Object.create(null) as Record<string, string>;
  const walk = (sub: string): boolean => {
    for (const e of readdirSync(join(dir, sub), { withFileTypes: true })) {
      const rel = sub ? join(sub, e.name) : e.name;
      if (e.isSymbolicLink()) {
        refuseSymlink(report, join(dir, rel));
        return false;
      }
      if (e.isDirectory()) { if (!walk(rel)) return false; }
      else if (e.isFile()) hashes[rel] = hashBytes(readFileSync(join(dir, rel)));
      else return false;
    }
    return true;
  };
  return walk('') ? hashes : null;
}

/** A skill's name, as a manifest may list it: one folder of `.agents/skills/`. */
export const SKILL_NAME = /^[a-z0-9-]+$/;

const exists = (path: string): 'dir' | 'link' | 'file' | null => {
  try {
    const s = lstatSync(path);
    return s.isSymbolicLink() ? 'link' : s.isDirectory() ? 'dir' : 'file';
  } catch {
    return null;
  }
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

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
    .filter((e) => e.isDirectory() && SKILL_NAME.test(e.name) && exists(join(source, e.name, 'SKILL.md')) === 'file')
    .map((e) => e.name)
    .sort();
}

/** Why `rel` cannot be a file of skill `name` under `target`, or null when it can. */
function badPath(target: string, name: string, rel: unknown): string | null {
  if (typeof rel !== 'string' || rel === '') return `skill "${name}" lists a path that is not a non-empty string`;
  if (isAbsolute(rel) || rel.includes('\\')) return `skill "${name}" lists ${JSON.stringify(rel)}: not a relative path`;
  if (rel.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) return `skill "${name}" lists ${JSON.stringify(rel)}: an empty, "." or ".." segment`;
  const base = resolve(target, name);
  if (!resolve(base, rel).startsWith(`${base}${sep}`)) return `skill "${name}" lists ${JSON.stringify(rel)}: outside .agents/skills/${name}/`;
  return null;
}

export type ManifestRead = { kind: 'absent' } | { kind: 'ok'; manifest: Manifest } | { kind: 'invalid'; why: string };

/** The manifest in `target` (`.agents/skills/`), validated: its mark, its structure, its names and its paths. */
export function readManifest(target: string): ManifestRead {
  const text = readText(join(target, MANIFEST));
  if (text === null) return { kind: 'absent' };
  let m: unknown;
  try {
    m = JSON.parse(text);
  } catch (err) {
    return { kind: 'invalid', why: `not valid JSON (${err instanceof Error ? err.message : String(err)})` };
  }
  if (!isRecord(m)) return { kind: 'invalid', why: 'not a JSON object' };
  if (typeof m.managed !== 'string' || !/managed by cland\b/.test(m.managed)) return { kind: 'invalid', why: 'no "managed by cland" mark in its "managed" field: not cland\'s' };
  if (!isRecord(m.skills)) return { kind: 'invalid', why: '"skills" is not an object' };
  const skills: Record<string, ManifestFiles> = {};
  for (const [name, files] of Object.entries(m.skills)) {
    if (!SKILL_NAME.test(name)) return { kind: 'invalid', why: `skill name ${JSON.stringify(name)} is not [a-z0-9-]+` };
    if (!Array.isArray(files) && !isRecord(files)) return { kind: 'invalid', why: `skill "${name}" has no list or map of files` };
    for (const rel of Array.isArray(files) ? files : Object.keys(files)) {
      const why = badPath(target, name, rel);
      if (why !== null) return { kind: 'invalid', why };
    }
    if (!Array.isArray(files)) {
      for (const [rel, hash] of Object.entries(files)) {
        if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) return { kind: 'invalid', why: `skill "${name}" lists ${JSON.stringify(rel)} with a hash that is not 64 lowercase hex characters` };
      }
    }
    skills[name] = files as ManifestFiles;
  }
  return { kind: 'ok', manifest: { managed: m.managed, skills } };
}

/** Remove a managed file and the folders it leaves empty, up to (not including) `stop`; nothing through a link. */
function removeFile(report: Report, path: string, stop: string): boolean {
  if (refuseSymlink(report, path)) return false;
  rmSync(path, { force: true });
  for (let dir = dirname(path); dir !== stop && dir.startsWith(stop); dir = dirname(dir)) {
    try {
      rmdirSync(dir);
    } catch {
      break;
    }
  }
  return true;
}

const CONFLICT = "conflict: a file of the project's own where this cland ships one; cland's is not installed (remove yours, then run cland update, to take cland's)";

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
  if (refuseSymlink(report, target) || refuseSymlink(report, manifestPath)) return [];
  const read = readManifest(target);
  if (read.kind === 'invalid') {
    report.add(manifestPath, 'kept', `an invalid manifest (${read.why}): no skill installed, updated or removed; fix it, or remove it and the skills it listed, then run cland update`);
    return [];
  }
  const previous = read.kind === 'ok' ? read.manifest.skills : {};
  const manifest: Manifest = { managed: `${MANAGED_BY} — cland update refreshes untouched skills listed here and keeps edited ones; a skill folder not listed is the project's own`, skills: {} };
  for (const name of shippedSkills(source)) {
    const dir = join(target, name);
    const before = Object.hasOwn(previous, name) ? previous[name] : undefined;
    if (before === undefined && exists(dir) !== null) {
      report.add(dir, 'kept', "a skill of the project's own by that name: cland's is not installed");
      continue;
    }
    const link = symlinkOnPath(root, dir);
    if (link !== null) {
      report.add(dir, 'kept', symlinkNote(link));
      if (before !== undefined) manifest.skills[name] = before;
      continue;
    }
    const files = filesUnder(join(source, name));
    if (before !== undefined && !Array.isArray(before) && exists(dir) !== null) {
      const shipped = Object.fromEntries(files.map(rel => [rel, hashBytes(readFileSync(join(source, name, rel)))]));
      const installed = installedHashes(report, dir);
      if (sameHashes(installed, shipped)) {
        report.add(dir, 'unchanged');
        manifest.skills[name] = shipped;
        continue;
      }
      if (!sameHashes(installed, before)) {
        report.add(dir, 'kept', `edited in the project${sameHashes(before, shipped) ? '' : '; cland ships a newer version'}`);
        manifest.skills[name] = before;
        continue;
      }
    }
    const owned = new Map<string, string | undefined>();
    const retain = (rel: string) => owned.set(rel, Array.isArray(before) ? undefined : before?.[rel]);
    const beforePaths = before === undefined ? [] : paths(before);
    let wrote = false;
    // Clear obsolete paths first: a release can replace a file with a directory or vice versa.
    for (const rel of beforePaths) {
      if (files.includes(rel)) continue;
      if (removeFile(report, join(dir, rel), target)) wrote = true;
      else retain(rel);
    }
    for (const rel of files) {
      const to = join(dir, rel);
      const had = beforePaths.includes(rel);
      if (refuseSymlink(report, to)) {
        if (had) retain(rel);
        continue;
      }
      const kind = exists(to);
      if (!had && kind !== null) {
        report.add(to, 'kept', CONFLICT);
        continue;
      }
      const from = readFileSync(join(source, name, rel));
      const hash = createHash('sha256').update(from).digest('hex');
      if (kind === 'file' && readFileSync(to).equals(from)) {
        owned.set(rel, hash);
        continue;
      }
      const refused = writeAtomic(report.root, to, from);
      if (refused !== null) {
        report.add(to, 'kept', symlinkNote(refused));
        if (had) retain(rel);
        continue;
      }
      owned.set(rel, hash);
      wrote = true;
    }
    report.add(dir, wrote ? (before !== undefined ? 'updated' : 'created') : 'unchanged');
    // A refused legacy path has no hash to carry forward. Keep its skill in the
    // legacy form until every retained file has a known hash.
    manifest.skills[name] = [...owned.values()].some(hash => hash === undefined)
      ? [...owned.keys()]
      : Object.fromEntries(owned) as Record<string, string>;
  }
  // skills an earlier version installed that this one no longer ships
  for (const [name, files] of Object.entries(previous)) {
    if (name in manifest.skills) continue;
    const dir = join(target, name);
    const link = symlinkOnPath(root, dir);
    if (link !== null) {
      report.add(dir, 'kept', symlinkNote(link));
      manifest.skills[name] = files;
      continue;
    }
    const left = paths(files).filter((rel) => !removeFile(report, join(dir, rel), target));
    if (left.length) manifest.skills[name] = Array.isArray(files) ? left : Object.fromEntries(left.map(rel => [rel, files[rel]!]));
    else report.add(dir, 'removed', 'no longer shipped by cland');
  }
  writeIfChanged(report, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return Object.keys(manifest.skills).filter((name) => exists(join(target, name)) === 'dir');
}

/**
 * `.claude/skills`: a symlink to `../.agents/skills` when the project has none; one symlink per managed skill
 * inside the project's own `.claude/skills/` folder when it has one; there, a link of cland's to a skill no longer
 * installed is removed. Nothing is created under a `.claude` that is itself a link.
 */
export function provisionClaudeSkills(report: Report, root: string, managed: readonly string[]): void {
  const link = join(root, '.claude', 'skills');
  const parentLink = symlinkOnPath(root, dirname(link));
  if (parentLink !== null) {
    report.add(link, 'kept', symlinkNote(parentLink));
    return;
  }
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
    report.add(link, 'kept', "a file of the project's own: no skills linked for Claude Code");
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
    else report.add(each, 'kept', "the project's own");
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
