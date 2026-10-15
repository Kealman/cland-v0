// Coverage artifacts are portable between worktrees and executors; only their
// durable artifact pointers live in the project's volatile run directory.
import { readFile, readdir, rename } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot } from './project.ts';

export type CoveredFunction = { name: string; start: number; end: number; startLine: number; endLine: number; tests: string[] };
export type CoverageMap = { version: 1; head: string; tree: string; created: string; testFiles: string[]; files: Record<string, { functions: CoveredFunction[] }> };
export type CoverageRecording = { head: string; tree: string; run: string };
export type CoveragePointer = { artifact: string; path: string };
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

export async function coverageMaps(root: string): Promise<Array<{ map: CoverageMap; pointer: CoveragePointer }>> {
  const dir = coveragePointers(root);
  const names = await readdir(dir).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const maps = [];
  for (const name of names.filter(name => name.endsWith('.json'))) {
    try {
      const pointer = JSON.parse(await readFile(join(dir, name), 'utf8')) as CoveragePointer;
      if (typeof pointer.artifact !== 'string' || typeof pointer.path !== 'string') continue;
      maps.push({ pointer, map: parseCoverageMap(await readFile(pointer.path, 'utf8')) });
    } catch { /* A deleted or damaged artifact is not selection evidence. */ }
  }
  return maps.sort((a, b) => Date.parse(b.map.created) - Date.parse(a.map.created));
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

export async function coverageSelection(cwd: string, files: string[], mergeBase: string, git: Git, maxAgeMs: number, replay?: { maps: Awaited<ReturnType<typeof coverageMaps>>; at: number; nearest: boolean }): Promise<{ tests: string[]; functions: string[]; map: CoveragePointer & { head: string; retrospective?: boolean }; nvimFull: boolean } | { fallback: string }> {
  for (const file of files) {
    if (/\.test\.ts$/.test(file) && /^hub\/(?:src|test)\//.test(file)) continue;
    if (!/^hub\/src\/.+\.ts$/.test(file)) return { fallback: `coverage unsupported path ${file}` };
    if (/^hub\/src\/(?:protocol\.ts|adapters\/contract\.ts|suite[^/]*\.ts|verification-tree\.ts|executor\/|hub\/(?:suites|suite-worker)\.ts)/.test(file)) return { fallback: `coverage shared infrastructure ${file}` };
  }
  const maps = replay?.maps ?? await coverageMaps(projectRoot(cwd));
  if (!maps.length) return { fallback: 'coverage map missing' };
  let chosen: typeof maps[number] | undefined;
  let retrospective = false;
  for (const candidate of maps) {
    if (replay && Date.parse(candidate.map.created) > replay.at) continue;
    try { await git('merge-base', '--is-ancestor', candidate.map.head, mergeBase); chosen = candidate; break; }
    catch { /* Maps from another branch or after the merge base cannot select. */ }
  }
  if (!chosen && replay?.nearest) {
    chosen = [...maps].sort((a, b) => Math.abs(Date.parse(a.map.created) - replay.at) - Math.abs(Date.parse(b.map.created) - replay.at))[0];
    retrospective = true;
  }
  if (!chosen) return { fallback: 'coverage map has no ancestor of task merge base' };
  const { map, pointer } = chosen;
  const age = retrospective ? 0 : (replay?.at ?? Date.now()) - Date.parse(map.created);
  if (age < 0 || age > maxAgeMs) return { fallback: `coverage map stale (age ${Math.floor(age / 1000)}s; limit ${maxAgeMs / 1000}s)` };
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
      if (!h.removed && h.old === 0) return { fallback: `coverage top-level insertion: ${file}:1` };
      const start = mapLine(Math.max(1, h.old), intervening);
      const end = mapLine(Math.max(1, h.old + Math.max(1, h.removed) - 1), intervening);
      if (start === null || end === null || intervening.some(i => i.added && i.next > h.old && i.next <= h.old + h.removed - 1)) return { fallback: `coverage hunk changed since map: ${file}:${h.old}` };
      // Insertion anchors must be inside a function, rather than its final line:
      // adding a new top-level function cannot borrow its neighbour's coverage.
      const deciding = entry.functions.filter(fn => h.removed ? fn.startLine <= end && fn.endLine >= start : fn.startLine <= start && fn.endLine > start);
      // Every removed line needs function coverage; a hunk spanning import or
      // top-level code cannot be justified by a neighbouring function alone.
      for (let line = start; line <= end; line++) if (!deciding.some(fn => fn.startLine <= line && fn.endLine >= line)) return { fallback: `coverage top-level or unknown function: ${file}:${line}` };
      if (!deciding.length || deciding.some(fn => !fn.tests.length)) return { fallback: `coverage function untested: ${file}:${start}` };
      for (const fn of deciding) { functions.add(`${file}:${fn.startLine}-${fn.endLine} ${fn.name || '(anonymous)'}`); for (const test of fn.tests) tests.add(test); }
    }
  }
  for (const test of tests) if (!await readFile(join(cwd, test)).then(() => true, () => false)) return { fallback: `coverage test missing: ${test}` };
  return { tests: [...tests].sort(), functions: [...functions].sort(), map: { ...pointer, head: map.head, ...(retrospective ? { retrospective: true } : {}) }, nvimFull: false };
}

type RawCoverage = { result: Array<{ url: string; functions: Array<{ functionName: string; ranges: Array<{ startOffset: number; endOffset: number; count: number }> }> }> };
/** Reduce one directory per test, including all of its descendant processes. */
export async function reduceCoverage(cwd: string, raw: string, recording: CoverageRecording, testFiles: string[]): Promise<CoverageMap> {
  const map: CoverageMap = { version: 1, head: recording.head, tree: recording.tree, created: new Date().toISOString(), testFiles: [...testFiles].sort(), files: {} };
  const sources = new Map<string, string>();
  const receipts = await readdir(raw);
  for (const test of testFiles) {
    const dir = join(raw, Buffer.from(test).toString('base64url'));
    const owner = JSON.parse(await readFile(join(dir, 'owner.json'), 'utf8')) as { pid: number };
    if (!Number.isSafeInteger(owner.pid) || owner.pid < 1) throw new Error(`coverage owner missing for ${test}`);
    const own = receipts.filter(name => name.startsWith(`coverage-${owner.pid}-`) && name.endsWith('.json'));
    if (!own.length) throw new Error(`coverage test receipt missing for ${test}`);
    for (const name of own) await rename(join(raw, name), join(dir, name));
    const names = await readdir(dir);
    if (!names.some(name => /^coverage-.*\.json$/.test(name))) throw new Error(`coverage missing for ${test}`);
    for (const name of names.filter(name => /^coverage-.*\.json$/.test(name))) {
      const result = JSON.parse(await readFile(join(dir, name), 'utf8')) as RawCoverage;
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
