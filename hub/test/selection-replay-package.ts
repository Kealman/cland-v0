import { chooseSuiteMode, type SuiteMode } from '../src/suite-selection.ts';

export function replayCount(options: readonly string[]): number {
  const at = options.indexOf('--count');
  const count = at < 0 ? 40 : Number(options[at + 1]);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('--count must be a positive integer');
  return count;
}

// Git and output are boundaries so recorded landings can be replayed in-process.
export function replayPackage(options: readonly string[], commits: readonly string[], context: {
  range: string;
  selectorRef?: string | undefined;
  imports: string[];
  git: (...args: string[]) => string;
  choose?: typeof chooseSuiteMode;
  log: (line: string) => void;
}): void {
  const { range, selectorRef, imports, git, log, choose = chooseSuiteMode } = context;
  const count = replayCount(options);
  const rows = commits.slice(0, count);
  if (rows.length < count) throw new Error(`need ${count} task landings, found ${rows.length}`);
  const counts: Record<SuiteMode, number> = { full: 0, 'hub-only': 0, 'hub-selected': 0, 'nvim-only': 0, 'web-only': 0 };
  log(`Selector: ${selectorRef ?? 'working source'}; range: ${range}; ${rows.length} task landings`);
  log('| Commit | Item | Mode | Deciding file or rule |');
  log('| --- | --- | --- | --- |');
  for (const line of rows) {
    const [sha, subject] = line.split('\t');
    if (!sha || !subject) throw new Error(`invalid git log row: ${line}`);
    const paths = git('diff', '--name-only', '-z', '--no-renames', `${sha}^1`, sha).split('\0').filter(Boolean);
    const mode = choose(paths, imports);
    counts[mode]++;
    const deciding = mode === 'full'
      ? paths.find(path => choose([path], imports) === 'full') ?? 'mixed nvim and non-nvim paths'
      : mode === 'nvim-only' ? 'all paths under nvim/' : 'all paths outside nvim/';
    log(`| ${sha.slice(0, 8)} | ${subject.match(/\((T-\d+)\)$/)?.[1]} | ${mode} | ${deciding} |`);
  }
  log(`Split: full ${counts.full} / hub-only ${counts['hub-only']} / nvim-only ${counts['nvim-only']}`);
}
