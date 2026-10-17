// Replay task landings (cland uses squash commits) on a first-parent range.
// node hub/test/selection-replay.ts f174d9c^..83b74c6 [selector-ref]
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, symlink, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { findPackageJSON } from 'node:module';
import { pathToFileURL } from 'node:url';
import { chooseSuiteMode, nvimHubImports, nvimHubImporters, HUB_SMOKE, NVIM_SMOKE, type SuiteMode } from '../src/suite-selection.ts';

import { coverageMaps, coverageSelection } from '../src/suite-coverage.ts';
import { readDurationManifest } from '../src/suite-durations.ts';
import { readFile } from 'node:fs/promises';
import { projectRoot } from '../src/project.ts';

const options = process.argv.slice(2);
const coverage = options.includes('--coverage');
const nearest = options.includes('--nearest');
const countAt = options.indexOf('--count');
const count = countAt < 0 ? 40 : Number(options[countAt + 1]);
if (!Number.isSafeInteger(count) || count < 1) throw new Error('--count must be a positive integer');
if (countAt >= 0) options.splice(countAt, 2);
const failedAt = options.indexOf('--failures');
const failedPath = failedAt < 0 ? undefined : options[failedAt + 1];
if (failedAt >= 0) options.splice(failedAt, 2);
const [range, selectorRef] = options.filter(arg => !['--coverage', '--nearest'].includes(arg));
if (!range) throw new Error('usage: selection-replay.ts <first-parent-range> [selector-ref] [--coverage [--nearest] [--count 40] [--failures json]]');
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
let scratch: string | undefined;
let choose = chooseSuiteMode;
let readImports = nvimHubImports;
let readImporters: typeof nvimHubImporters | undefined = nvimHubImporters;
let selectCoverage = coverageSelection;
try {
  if (selectorRef) {
    scratch = await mkdtemp(join(tmpdir(), 'cland-selection-replay-'));
    const archive = execFileSync('git', ['archive', selectorRef, 'hub/src', 'hub/package.json'], { maxBuffer: 32 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', scratch], { input: archive });
    await symlink(dirname(dirname(findPackageJSON('smol-toml', import.meta.url)!)), join(scratch, 'node_modules'), 'dir');
    const module = join(scratch, 'hub/src/suite-selection.ts');
    const selector = await import(pathToFileURL(module).href);
    choose = selector.chooseSuiteMode;
    readImports = selector.nvimHubImports;
    readImporters = selector.nvimHubImporters;
    selectCoverage = (await import(pathToFileURL(join(scratch, 'hub/src/suite-coverage.ts')).href)).coverageSelection;
  }
  const imports = await readImports(process.cwd());
  const counts: Record<SuiteMode, number> = { full: 0, 'hub-only': 0, 'hub-selected': 0, 'nvim-only': 0 };
  const commits = git('log', '--first-parent', '--format=%H%x09%s', range).trim().split('\n')
    .filter(line => /\(T-\d+\)$/.test(line) && !line.includes('\tTracker:'));
  if (coverage) await replayCoverage(commits, range);
  else {
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
  }
} finally {
  if (scratch) await rm(scratch, { recursive: true, force: true });
}


// --nearest labels retrospective evidence explicitly; live admission always
// requires an ancestor map and maps every hunk, reporting old-map age. No source is altered for replay.
async function replayCoverage(commits: string[], range: string): Promise<void> {
  const root = projectRoot(process.cwd());
  const maps = await coverageMaps(root);
  const durations = (await readDurationManifest(process.cwd()))?.files ?? {};
  const history = await historicalFailures(root);
  const failures: Record<string, string[]> = failedPath ? JSON.parse(await readFile(resolve(failedPath), 'utf8')) : {};
  const total = Object.entries(durations).filter(([file]) => file.startsWith('hub/')).reduce((sum, [, value]) => sum + value.seconds, 0);
  const rows = commits.slice(0, count);
  let selectedCount = 0;
  let ownMissed = 0;
  let historicalMissed = 0;
  console.log(`Coverage replay: selector ${selectorRef ?? 'working source'}; ${range}; ${rows.length} task landings; ${maps.length} maps; ${nearest ? 'nearest map (retrospective, may postdate merge)' : 'ancestor maps at merge time'}; failure history ${history.logs} retained run logs${failedPath ? ' plus ' + failedPath : ''}`);
  console.log('| Commit | Item | Mode | Map | Hub test-time share | Own tests missed | Historical failures missed | Cause / deciding functions |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of rows) {
    const [sha, subject] = row.split('\t');
    if (!sha || !subject) throw new Error('invalid replay row');
    const dir = await mkdtemp(join(tmpdir(), 'cland-coverage-replay-'));
    await rm(dir, { recursive: true });
    git('worktree', 'add', '--quiet', '--detach', dir, sha);
    try {
      const changed = git('diff', '--name-only', '-z', '--no-renames', `${sha}^1`, sha).split('\0').filter(Boolean);
      const runGit = async (...args: string[]) => {
        // Task hunks are this landing alone, not the working checkout's diff
        // against current dev. Intervening map-to-parent diffs remain unchanged.
        if (args[0] === 'diff' && args[5] === `${sha}^1` && args[6] === '--') args.splice(6, 0, sha);
        return execFileSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      };
      const imports = await readImports(dir);
      const mode = choose(changed, imports);
      const at = Number(git('show', '-s', '--format=%ct', sha).trim()) * 1000;
      const localOnly = mode === 'hub-only' || mode === 'full' && choose(changed, []) === 'hub-only';
      const result = localOnly ? await selectCoverage(dir, changed, `${sha}^1`, runGit, 172800000, { maps, at, nearest }) : { fallback: `shared package rule: ${changed.filter(file => choose([file], imports) === 'full').join(', ') || 'mixed nvim and non-nvim paths'}` };
      const importers = readImporters && localOnly && mode === 'full' && !('fallback' in result && result.fallback.startsWith('coverage shared infrastructure')) ? await readImporters(dir) : undefined;
      const nvimSelected = importers ? new Set([...changed.flatMap(file => importers[file] ?? []), ...NVIM_SMOKE]) : undefined;
      const selected = 'fallback' in result ? null : new Set([...result.tests, ...HUB_SMOKE]);
      if (selected) selectedCount++;
      const own = changed.filter(file => /^(?:hub\/(?:src|test)|nvim\/test)\/.+\.test\.ts$/.test(file) && !git('diff', '--diff-filter=D', '--name-only', `${sha}^1`, sha).split('\n').includes(file));
      const item = subject.match(/\((T-\d+)\)$/)?.[1];
      const historyFiles = [...new Set([...(failures[sha] ?? failures[sha.slice(0, 8)] ?? []), ...(history.byItem.get(item ?? '') ?? [])])];
      const includes = (file: string) => file.startsWith('hub/')
        ? selected ? selected.has(file) : mode !== 'nvim-only' || HUB_SMOKE.includes(file)
        : nvimSelected ? nvimSelected.has(file) : mode === 'full' || mode === 'nvim-only' || NVIM_SMOKE.includes(file);
      const ownMisses = own.filter(file => !includes(file));
      const historyMisses = historyFiles.filter(file => !includes(file));
      ownMissed += ownMisses.length; historicalMissed += historyMisses.length;
      const seconds = selected ? [...selected].reduce((sum, file) => sum + (durations[file]?.seconds ?? 0), 0) : mode === 'nvim-only' ? HUB_SMOKE.reduce((sum, file) => sum + (durations[file]?.seconds ?? 0), 0) : total;
      const missingTimings = selected ? [...selected].filter(file => !durations[file]).length : 0;
      const share = !total ? 'unknown (no timings)' : missingTimings ? `unknown (${missingTimings} selected files lack timings)` : (100 * seconds / total).toFixed(1) + '%';
      let detail = 'fallback' in result ? result.fallback : [...result.functions, ...result.notes ?? []].join('; ') || 'changed tests only';
      if (nvimSelected) detail += `; Neovim importers plus smoke: ${[...nvimSelected].sort().join(', ')}`;
      if (historyMisses.length) detail += `; historical failures outside ${historyMisses.some(file => file.startsWith('nvim/')) ? 'package Neovim smoke' : selected ? 'changed-function coverage' : 'package hub smoke'}`;
      console.log(`| ${sha.slice(0, 8)} | ${subject.match(/\((T-\d+)\)$/)?.[1]} | ${selected ? 'hub-selected' : mode} | ${'map' in result ? `${result.map.artifact} at ${result.map.head.slice(0, 8)}${result.map.retrospective ? ' (nearest)' : ''}` : 'none'} | ${share} | ${ownMisses.join(', ') || '0'} | ${historyMisses.join(', ') || '0'} | ${detail.replaceAll('|', '/')} |`);
    } finally { git('worktree', 'remove', '--force', dir); }
  }
  console.log(`Replay bar: ${rows.length}/${count} landings; ${selectedCount} hub-selected; ${ownMissed} own misses; ${historicalMissed} historical misses; ${ownMissed + historicalMissed} misses total. Missing maps use package fallback. Shares use the current duration manifest; missing selected timings are unknown, and shares are not a wall-time claim.`);
  if (ownMissed || historicalMissed) process.exitCode = 1;
  else if (rows.length < count) { console.log(`Incomplete replay: ${count - rows.length} more task landings required.`); process.exitCode = 2; }
}


async function historicalFailures(root: string): Promise<{ logs: number; byItem: Map<string, Set<string>> }> {
  const dir = join(root, '.cland/run/suites');
  const byItem = new Map<string, Set<string>>();
  let logs = 0;
  for (const name of await readdir(dir).catch(() => [] as string[])) {
    const log = await readFile(join(dir, name, 'suite.log'), 'utf8').catch(() => '');
    const item = /^Branch .*?\b(T-\d+)\b/m.exec(log)?.[1];
    if (!item) continue;
    logs++;
    const failedNames = new Set([...log.matchAll(/^(?:✖ |\s*not ok \d+ - )(.+?)(?: \([\d.]+(?:ms|s)?\))?\s*$/gm)].map(match => match[1]!));
    const files = byItem.get(item) ?? new Set<string>();
    for (const match of log.matchAll(/^suite timing (.+)$/gm)) {
      try {
        const record = JSON.parse(match[1]!) as { file: string; name: string };
        if (failedNames.has(record.name)) files.add(record.file);
      } catch { /* Old logs without durable timing identities cannot be inferred. */ }
    }
    // Node's detailed failure block also names the source location, including
    // failures before a reporter could emit its timing record.
    for (const match of log.matchAll(/(?:location: |test at |file:\/\/|error at )[^\n]*?((?:hub\/(?:src|test)|nvim\/test)\/[^\s:'"()]+\.test\.ts)(?::\d+)?/g)) files.add(match[1]!);
    byItem.set(item, files);
  }
  return { logs, byItem };
}
