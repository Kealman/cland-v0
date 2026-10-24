// Older selector refs expect loaded maps; keep comparisons bounded too.
import { readFile } from 'node:fs/promises';
import { coverageMaps, coverageSelection, parseCoverageMap } from '../src/suite-coverage.ts';

export async function legacyCoverageSelection(selector: typeof coverageSelection, cwd: string, files: string[], base: string,
  git: Parameters<typeof coverageSelection>[3], age: number,
  replay: { maps: Awaited<ReturnType<typeof coverageMaps>>; at: number; nearest: boolean }): Promise<Awaited<ReturnType<typeof coverageSelection>>> {
  let last: Awaited<ReturnType<typeof coverageSelection>> = { fallback: 'coverage map missing' };
  for (const nearest of replay.nearest ? [false, true] : [false]) {
    const candidates = nearest ? [...replay.maps].sort((a, b) => Math.abs(a.created - replay.at) - Math.abs(b.created - replay.at)) : replay.maps;
    for (const candidate of candidates) {
      let map;
      try { map = parseCoverageMap(await readFile(candidate.pointer.path, 'utf8')); }
      catch { continue; }
      const result = await selector(cwd, files, base, git, age, { maps: [{ map, pointer: candidate.pointer }], at: replay.at, nearest });
      if ('fallback' in result && result.fallback === 'coverage map has no ancestor of task merge base') { last = result; continue; }
      return result;
    }
  }
  return last;
}
