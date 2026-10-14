// Replay task landings (cland uses squash commits) on a first-parent range.
// node hub/test/selection-replay.ts f174d9c^..83b74c6 [selector-ref]
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chooseSuiteMode, nvimHubImports, type SuiteMode } from '../src/suite-selection.ts';

const [range, selectorRef] = process.argv.slice(2);
if (!range) throw new Error('usage: selection-replay.ts <first-parent-range> [selector-ref]');
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
let scratch: string | undefined;
try {
  let choose = chooseSuiteMode;
  if (selectorRef) {
    scratch = await mkdtemp(join(tmpdir(), 'cland-selection-replay-'));
    const module = join(scratch, 'suite-selection.ts');
    await writeFile(module, git('show', `${selectorRef}:hub/src/suite-selection.ts`));
    choose = (await import(pathToFileURL(module).href)).chooseSuiteMode;
  }
  const imports = await nvimHubImports(process.cwd());
  const counts: Record<SuiteMode, number> = { full: 0, 'hub-only': 0, 'nvim-only': 0 };
  const commits = git('log', '--first-parent', '--format=%H%x09%s', range).trim().split('\n')
    .filter(line => /\(T-\d+\)$/.test(line) && !line.includes('\tTracker:'));
  console.log(`Selector: ${selectorRef ?? 'working source'}; range: ${range}; ${commits.length} task landings`);
  console.log('| Commit | Item | Mode | Deciding file or rule |');
  console.log('| --- | --- | --- | --- |');
  for (const line of commits) {
    const [sha, subject] = line.split('\t');
    if (!sha || !subject) throw new Error(`invalid git log row: ${line}`);
    const paths = git('diff', '--name-only', '-z', '--no-renames', `${sha}^1`, sha).split('\0').filter(Boolean);
    const mode = choose(paths, imports);
    counts[mode]++;
    const deciding = mode === 'full'
      ? paths.find(path => choose([path], imports) === 'full') ?? 'mixed nvim and non-nvim paths'
      : mode === 'nvim-only' ? 'all paths under nvim/' : 'all paths outside nvim/';
    console.log(`| ${sha.slice(0, 8)} | ${subject.match(/\((T-\d+)\)$/)?.[1]} | ${mode} | ${deciding} |`);
  }
  console.log(`Split: full ${counts.full} / hub-only ${counts['hub-only']} / nvim-only ${counts['nvim-only']}`);
} finally {
  if (scratch) await rm(scratch, { recursive: true, force: true });
}
