// Coverage artifacts are portable between worktrees and executors; only their
// durable artifact pointers live in the project's volatile run directory.
import { readFile, readdir, rename, stat, mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LogFn } from './log.ts';
import { projectRoot } from './project.ts';

export type CoveredFunction = { name: string; start: number; end: number; startLine: number; endLine: number; tests: string[] };
export type CoverageMap = { version: 1; head: string; tree: string; created: string; testFiles: string[]; files: Record<string, { functions: CoveredFunction[] }> };
export type CoverageRecording = { head: string; tree: string; run: string };
export type CoveragePointer = { artifact: string; path: string; created?: string; head?: string };
type CoverageCandidate = { pointer: CoveragePointer; created: number } | { pointer: CoveragePointer; map: CoverageMap };
/** The loader owns one parsed map until release, including selection/diff work. */
export type CoverageMapReader = { read(path: string): Promise<CoverageMap>; release?(map: CoverageMap): void };
const mapReader: CoverageMapReader = { read: async path => parseCoverageMap(await readFile(path, 'utf8')) };
type Git = (...args: string[]) => Promise<string>;
type Hunk = { old: number; removed: number; added: number; next: number };

export function coveragePointers(root: string): string { return join(root, '.cland/run/coverage-maps'); }

export function parseCoverageMap(text: string): CoverageMap {
  const map = JSON.parse(text) as CoverageMap;
  const path = (value: unknown) => typeof value === 'string' && /^hub\/(?:src|test)\/.+\.test\.ts$/.test(value) && !value.split('/').some(part => part === '..' || part === '.');
  if (map?.version !== 1 || !/^[a-f0-9]{40,64}$/.test(map.head) || !/^[a-f0-9]{40,64}$/.test(map.tree) || !Number.isFinite(Date.parse(map.created)) || !Array.isArray(map.testFiles) || !map.testFiles.every(path) || !map.files || typeof map.files !== 'object' || Array.isArray(map.files)) throw new Error('invalid coverage map');
  for (const [file, entry] of Object.entries(map.files)) {
    if (!/^hub\/src\/.+\.ts$/.test(file) || file.split('/').some(part => part === '..' || part === '.') || !Array.isArray(entry?.functions)) throw new Error('invalid coverage source');
    for (const fn of entry.functions) {
      if (typeof fn.name !== 'string' || ![fn.start, fn.end, fn.startLine, fn.endLine].every(Number.isSafeInteger) || fn.start < 0 || fn.end <= fn.start || fn.startLine < 1 || fn.endLine < fn.startLine || !Array.isArray(fn.tests) || !fn.tests.every(test => path(test) && map.testFiles.includes(test))) throw new Error('invalid coverage function');
    }
  }
  return map;
}

/** Combine disjoint tier command receipts from the same admitted tree. */
export function mergeCoverageMaps(previous: CoverageMap, next: CoverageMap): CoverageMap {
  if (previous.head !== next.head || previous.tree !== next.tree) throw new Error('tier coverage provenance mismatch');
  const merged = structuredClone(next);
  merged.testFiles = [...new Set([...previous.testFiles, ...next.testFiles])].sort();
  for (const [file, entry] of Object.entries(previous.files)) {
    const target = merged.files[file] ??= { functions: [] };
    for (const fn of entry.functions) {
      const prior = target.functions.find(f => f.start === fn.start && f.end === fn.end);
      if (prior) prior.tests = [...new Set([...prior.tests, ...fn.tests])].sort();
      else target.functions.push(structuredClone(fn));
    }
  }
  return merged;
}

/** Merge shard files into one accumulator, owning one incoming map at a time. */
export async function mergeCoverageFiles(paths: string[], merged: CoverageMap, reader: CoverageMapReader = mapReader): Promise<CoverageMap> {
  for (const path of paths) {
    const map = await reader.read(path);
    try {
      if (map.head !== merged.head || map.tree !== merged.tree) throw new Error('shard coverage provenance mismatch');
      merged.testFiles.push(...map.testFiles);
      for (const [file, entry] of Object.entries(map.files)) {
        const target = merged.files[file] ??= { functions: [] };
        for (const fn of entry.functions) {
          const prior = target.functions.find(f => f.start === fn.start && f.end === fn.end);
          if (prior) prior.tests = [...new Set([...prior.tests, ...fn.tests])].sort();
          else target.functions.push(fn);
        }
      }
    } finally { reader.release?.(map); }
  }
  merged.testFiles.sort();
  return merged;
}

/** List only small pointers. Never parse artifacts just to order candidates. */
export async function coverageMaps(root: string): Promise<Array<{ pointer: CoveragePointer; created: number }>> {
  return (await coveragePointerEntries(root)).map(({ pointer, created }) => ({ pointer, created }));
}

async function coveragePointerEntries(root: string): Promise<Array<{ path: string; pointer: CoveragePointer; created: number }>> {
  const dir = coveragePointers(root);
  const names = await readdir(dir).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const pointers: Array<{ path: string; pointer: CoveragePointer; created: number }> = [];
  for (const name of names.filter(name => name.endsWith('.json'))) {
    try {
      const path = join(dir, name);
      const pointer = JSON.parse(await readFile(path, 'utf8')) as CoveragePointer;
      if (typeof pointer.artifact !== 'string' || typeof pointer.path !== 'string') continue;
      const created = typeof pointer.created === 'string' ? Date.parse(pointer.created) : NaN;
      pointers.push({ path, pointer, created: Number.isFinite(created) ? created : (await stat(path)).mtimeMs });
    } catch { /* A deleted or damaged pointer is not selection evidence. */ }
  }
  return pointers.sort((a, b) => b.created - a.created || a.pointer.path.localeCompare(b.pointer.path));
}

/** Called serially by the hub's publication queue. Artifact files remain owned
 * by artifact lifecycle/retention; only rebuildable lookup pointers expire. */
export async function registerCoverageMap(root: string, run: string, pointer: Required<CoveragePointer>, keep: number, log: LogFn): Promise<void> {
  if (!Number.isSafeInteger(keep) || keep < 1) throw new Error('coverage map retention must be a positive integer');
  if (!/^[a-zA-Z0-9_-]+$/.test(run)) throw new Error('invalid coverage run id');
  const dir = coveragePointers(root);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, `${run}.json`);
  await writeFile(`${path}.tmp`, JSON.stringify(pointer), { mode: 0o600 });
  await rename(`${path}.tmp`, path);
  for (const entry of (await coveragePointerEntries(root)).slice(keep)) {
    await unlink(entry.path);
    log({ event: 'coverage-pointer-expired', pointer: entry.path, artifact: entry.pointer.artifact, path: entry.pointer.path, retained: keep });
  }
}

function hunks(diff: string): Hunk[] {
  return [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map(match => ({ old: Number(match[1]), removed: Number(match[2] ?? 1), next: Number(match[3]), added: Number(match[4] ?? 1) }));
}

// Translate unchanged merge-base lines into the map's coordinates. Changes in
// the intervening history have no reliable attribution and therefore widen.
function mapLine(line: number, changes: Hunk[]): number | null {
  let delta = 0;
  for (const h of changes) {
    if (h.added ? line < h.next : line <= h.next) break;
    if (h.added && line < h.next + h.added) return null;
    delta += h.added - h.removed;
  }
  return line - delta;
}

export async function coverageSelection(cwd: string, files: string[], mergeBase: string, git: Git, maxAgeMs: number, replay?: { maps: CoverageCandidate[]; at: number; nearest: boolean }, reader: CoverageMapReader = mapReader): Promise<CoverageSelection> {
  for (const file of files) {
    if (/\.test\.ts$/.test(file) && /^hub\/(?:src|test)\//.test(file)) continue;
    if (!/^hub\/src\/.+\.ts$/.test(file)) return { fallback: `coverage unsupported path ${file}` };
    if (/^hub\/src\/(?:protocol\.ts|adapters\/contract\.ts|suite[^/]*\.ts|verification-tree\.ts|executor\/|hub\/(?:suites|suite-worker)\.ts)/.test(file)) return { fallback: `coverage shared infrastructure ${file}` };
  }
  const maps = replay?.maps ?? await coverageMaps(projectRoot(cwd));
  const created = (candidate: CoverageCandidate) => 'map' in candidate ? Date.parse(candidate.map.created) : candidate.created;
  let valid = false;
  for (const candidate of maps) {
    let map: CoverageMap;
    try { map = 'map' in candidate ? candidate.map : await reader.read(candidate.pointer.path); }
    catch { continue; } // Missing or damaged artifacts cannot provide evidence.
    try {
      valid = true;
      if (replay && Date.parse(map.created) > replay.at) continue;
      try { await git('merge-base', '--is-ancestor', map.head, mergeBase); }
      catch { continue; }
      return await selectCoverageMap(cwd, files, mergeBase, git, maxAgeMs, map, candidate.pointer, replay?.at ?? Date.now(), false);
    } finally { reader.release?.(map); }
  }
  if (replay?.nearest) {
    for (const candidate of [...maps].sort((a, b) => Math.abs(created(a) - replay.at) - Math.abs(created(b) - replay.at))) {
      let map: CoverageMap;
      try { map = 'map' in candidate ? candidate.map : await reader.read(candidate.pointer.path); }
      catch { continue; }
      try { return await selectCoverageMap(cwd, files, mergeBase, git, maxAgeMs, map, candidate.pointer, replay.at, true); }
      finally { reader.release?.(map); }
    }
  }
  return { fallback: valid ? 'coverage map has no ancestor of task merge base' : 'coverage map missing' };
}

type CoverageSelection = { tests: string[]; functions: string[]; map: CoveragePointer & { head: string; retrospective?: boolean }; nvimFull: boolean; notes: string[] } | { fallback: string };

async function selectCoverageMap(cwd: string, files: string[], mergeBase: string, git: Git, maxAgeMs: number, map: CoverageMap, pointer: CoveragePointer, at: number, retrospective: boolean): Promise<CoverageSelection> {
  const age = retrospective ? 0 : at - Date.parse(map.created);
  if (age < 0) return { fallback: `coverage map stale (age ${Math.floor(age / 1000)}s; limit ${maxAgeMs / 1000}s)` };
  const notes = new Set<string>();
  if (age > maxAgeMs) notes.add(`coverage map age ${Math.floor(age / 1000)}s exceeds limit ${maxAgeMs / 1000}s; all hunks map`);
  const tests = new Set<string>();
  const functions = new Set<string>();
  for (const file of files) {
    if (file.endsWith('.test.ts')) {
      if (await readFile(join(cwd, file)).then(() => true, () => false)) tests.add(file);
      continue;
    }
    const entry = map.files[file];
    if (!entry) return { fallback: `coverage source absent from map: ${file}` };
    const changes = hunks(await git('diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--unified=0', mergeBase, '--', file));
    if (!changes.length) return { fallback: `coverage has no mappable hunks: ${file}` };
    const intervening = hunks(await git('diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--unified=0', map.head, mergeBase, '--', file));
    for (const h of changes) {
      const start = mapLine(Math.max(1, h.old), intervening);
      const end = mapLine(Math.max(1, h.old + Math.max(1, h.removed) - 1), intervening);
      if (start === null || end === null || intervening.some(i => i.added && i.next > h.old && i.next <= h.old + h.removed - 1)) return { fallback: `coverage hunk changed since map: ${file}:${h.old}` };
      // Insertion anchors must be inside a function, rather than its final line:
      // adding a new top-level function cannot borrow its neighbour's coverage.
      const deciding = entry.functions.filter(fn => h.removed ? fn.startLine <= end && fn.endLine >= start : fn.startLine <= start && fn.endLine > start);
      // A top-level or untested edit widens to all evidence for this file.
      // Coordinate failures above still require the package fallback.
      let topLevel = !h.removed && h.old === 0 || !deciding.length;
      for (let line = start; line <= end && !topLevel; line++) topLevel = !deciding.some(fn => fn.startLine <= line && fn.endLine >= line);
      const untested = deciding.some(fn => !fn.tests.length);
      if (topLevel || untested) {
        const covering = entry.functions.flatMap(fn => fn.tests);
        if (!covering.length) return { fallback: `coverage file has no covering tests: ${file}` };
        for (const test of covering) tests.add(test);
        notes.add(`file covering tests widened: ${file}:${h.old} (${topLevel ? 'top-level or unknown function' : 'untested function'})`);
        continue;
      }
      for (const fn of deciding) { functions.add(`${file}:${fn.startLine}-${fn.endLine} ${fn.name || '(anonymous)'}`); for (const test of fn.tests) tests.add(test); }
    }
  }
  for (const test of tests) if (!await readFile(join(cwd, test)).then(() => true, () => false)) return { fallback: `coverage test missing: ${test}` };
  return { tests: [...tests].sort(), functions: [...functions].sort(), map: { ...pointer, head: map.head, ...(retrospective ? { retrospective: true } : {}) }, nvimFull: false, notes: [...notes].sort() };
}

type RawCoverage = { result: Array<{ url: string; functions: Array<{ functionName: string; ranges: Array<{ startOffset: number; endOffset: number; count: number }> }> }> };
/** Reduce one directory per test, including all of its descendant processes. */
export async function reduceCoverage(cwd: string, raw: string, recording: CoverageRecording, testFiles: string[]): Promise<CoverageMap> {
  const map: CoverageMap = { version: 1, head: recording.head, tree: recording.tree, created: new Date().toISOString(), testFiles: [...testFiles].sort(), files: {} };
  const sources = new Map<string, string>();
  const receipts = await readdir(raw);
  const skip = (path: string, reason: string) => process.stderr.write(`suite coverage: skipping ${path}: ${reason}\n`);
  const owners: Array<{ test: string; dir: string; pid: number; started: number }> = [];
  for (const test of testFiles) {
    const dir = join(raw, Buffer.from(test).toString('base64url'));
    try {
      const owner = JSON.parse(await readFile(join(dir, 'owner.json'), 'utf8')) as { pid: number; started: number };
      if (!Number.isSafeInteger(owner.pid) || owner.pid < 1 || !Number.isSafeInteger(owner.started) || owner.started < 0) throw new Error('invalid owner identity');
      owners.push({ test, dir, pid: owner.pid, started: owner.started });
    } catch (error) { skip(join(dir, 'owner.json'), String(error)); }
  }
  const claimed = new Set<string>();
  // V8 names receipts coverage-<pid>-<write timestamp>-<thread>.json. The
  // latest owner start before that timestamp bounds each reused PID's window.
  // Visit each receipt once, so no later test can try to rename it again.
  for (const name of receipts.filter(name => /^coverage-.*\.json$/.test(name))) {
    const match = /^coverage-(\d+)-(\d+)-(\d+)\.json$/.exec(name);
    const candidates = match ? owners.filter(owner => owner.pid === Number(match[1]) && owner.started <= Number(match[2])).sort((a, b) => b.started - a.started) : [];
    const owner = candidates[0];
    if (!owner || candidates[1]?.started === owner.started) { skip(join(raw, name), 'unclaimable receipt'); continue; }
    try { await rename(join(raw, name), join(owner.dir, name)); claimed.add(owner.test); }
    catch (error) { skip(join(raw, name), String(error)); }
  }
  for (const owner of owners) if (!claimed.has(owner.test)) skip(join(owner.dir, `coverage-${owner.pid}-*.json`), 'test receipt missing');
  for (const test of testFiles) {
    const dir = join(raw, Buffer.from(test).toString('base64url'));
    const names = await readdir(dir).catch(error => { skip(dir, String(error)); return []; });
    for (const name of names.filter(name => /^coverage-.*\.json$/.test(name))) {
      const path = join(dir, name);
      const content = await readFile(path).catch(error => { skip(path, String(error)); return null; });
      if (content === null) continue;
      let result: RawCoverage;
      try { result = JSON.parse(content.toString('utf8')) as RawCoverage; }
      catch {
        process.stderr.write(`suite coverage: skipping ${path} (${content.length} bytes): invalid JSON\n`);
        continue;
      }
      for (const script of result.result) {
        if (!script.url.startsWith('file:')) continue;
        const file = relative(cwd, fileURLToPath(script.url)).split('\\').join('/');
        if (!/^hub\/src\/.+\.ts$/.test(file) || file.endsWith('.test.ts')) continue;
        let source = sources.get(file);
        if (source === undefined) { source = await readFile(join(cwd, file), 'utf8'); sources.set(file, source); }
        const entry = map.files[file] ??= { functions: [] };
        for (const fn of script.functions) {
          const range = fn.ranges[0];
          if (!range || range.startOffset === 0 && range.endOffset >= source.length) continue; // module import execution
          if (range.startOffset < 0 || range.endOffset > source.length) throw new Error(`coverage offsets differ from source: ${file}`);
          let covered = entry.functions.find(f => f.start === range.startOffset && f.end === range.endOffset);
          if (!covered) {
            covered = { name: fn.functionName, start: range.startOffset, end: range.endOffset,
              startLine: source.slice(0, range.startOffset).split('\n').length, endLine: source.slice(0, Math.max(range.startOffset, range.endOffset - 1)).split('\n').length, tests: [] };
            entry.functions.push(covered);
          }
          if (range.count > 0 && !covered.tests.includes(test)) covered.tests.push(test);
        }
      }
    }
  }
  for (const entry of Object.values(map.files)) { entry.functions.sort((a, b) => a.start - b.start || a.end - b.end); for (const fn of entry.functions) fn.tests.sort(); }
  return map;
}
