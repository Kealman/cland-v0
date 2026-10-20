import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { glob, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, posix, relative, resolve } from 'node:path';
import { coverageSelection, type CoverageRecording } from './suite-coverage.ts';
import { defaultConfig, parseConfig } from './init/config.ts';
import { fetchSuiteDev, selectionFailure } from './suite-dev-fetch.ts';

export type SuiteMode = 'hub-only' | 'hub-selected' | 'nvim-only' | 'full';
export type SuiteSelection = { tiers?: Array<'T1' | 'T2' | 'T3' | 'T4'>; mode: SuiteMode; files: string[]; reason: string; fallback?: string; loadGateKnownTests?: string[]; loadGateFiles?: string[]; loadGateTests?: string[]; loadGate?: boolean; soak?: boolean; loadGateBaseline?: { run: string | null; tests: string[] }; fetchedDev?: string; tests?: string[]; functions?: string[]; coverage?: { artifact: string; path: string; head: string }; nvimFull?: boolean; nvimTests?: string[]; recordCoverage?: CoverageRecording; shard?: { files: string[]; nvim: boolean } };
export type SuiteRequest = 'auto' | 'all' | 'hub' | 'nvim';

/** Task receipts cover hermetic rules; process evidence belongs to the merge batch. */
export function taskSuiteSelection(selection: SuiteSelection, branch: string, requested: SuiteRequest, queueEnabled: boolean): SuiteSelection {
  if (!queueEnabled || !branch.startsWith('t/') || requested === 'all') return selection;
  const fallback = selection.mode === 'full' || selection.mode === 'hub-only';
  const { nvimTests: _nvimTests, ...whole } = selection;
  return { ...(fallback ? whole : selection), mode: selection.mode === 'hub-only' ? 'full' : selection.mode,
    reason: fallback ? `${selection.reason}; task fallback runs all T2` : selection.reason,
    tiers: ['T1', 'T2'], loadGate: true };
}

/** Narrow an admitted package plan for one configured tier command. */
export function tierSuiteSelection(selection: SuiteSelection, tier: NonNullable<SuiteSelection['tiers']>[number]): SuiteSelection {
  const narrowed = { ...selection, tiers: [tier], soak: tier === 'T4' };
  // Task coverage narrows components only; the unit command still proves all rules.
  if (tier === 'T1' && selection.tiers?.join(',') === 'T1,T2' && !selection.shard) {
    const { tests: _tests, nvimTests: _nvimTests, ...whole } = narrowed;
    return { ...whole, mode: 'full', nvimFull: true };
  }
  return narrowed;
}

// Cross-package baselines, kept together so widening smoke coverage is one edit.
export const HUB_SMOKE = ['hub/test/scenarios/message-tracer.test.ts', 'hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/scenarios/startup-smoke.test.ts'];
export const NVIM_SMOKE = ['nvim/test/scenarios/workbench.test.ts'];
const HUB_TARGETS = ['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts'];
const NVIM_TARGETS = ['nvim/test/**/*.test.ts'];

export function suitePhases(mode: SuiteMode): Array<{ name: string; targets: string[] }> {
  return [
    { name: mode === 'nvim-only' ? 'hub smoke' : 'hub', targets: mode === 'nvim-only' ? HUB_SMOKE : HUB_TARGETS },
    { name: mode === 'hub-only' || mode === 'hub-selected' ? 'Neovim smoke' : 'Neovim', targets: mode === 'hub-only' || mode === 'hub-selected' ? NVIM_SMOKE : NVIM_TARGETS },
  ];
}

export function describeSelection(selection: SuiteSelection, filesBytes = Infinity): string {
  const list = (items: string[]) => {
    let shown = items;
    if (Number.isFinite(filesBytes)) {
      shown = [];
      let bytes = 2; // JSON array brackets
      for (const item of items) {
        const next = Buffer.byteLength(JSON.stringify(item), 'utf8') + (shown.length ? 1 : 0);
        if (bytes + next > filesBytes) break;
        shown.push(item); bytes += next;
      }
    }
    const omitted = items.length - shown.length;
    return `${JSON.stringify(shown)}${omitted ? `; ${omitted} more (${items.length} total; full list in log)` : ''}`;
  };
  return `mode ${selection.mode}; ${selection.reason}${selection.fallback && selection.fallback !== selection.reason ? `; ${selection.fallback}` : ''}; deciding files ${list(selection.files)}${selection.functions ? `; deciding functions ${list(selection.functions)}` : ''}${selection.nvimTests ? `; Neovim tests ${list(selection.nvimTests)}` : ''}${selection.coverage ? `; coverage ${selection.coverage.artifact} at ${selection.coverage.head}` : ''}`;
}

/** Cache receipts are reusable only for identical effective package/test sets. */
export function sameSuiteSelection(previous: SuiteSelection | undefined, selection: SuiteSelection): boolean {
  return JSON.stringify(previous?.tiers) === JSON.stringify(selection.tiers)
    && previous?.soak === selection.soak
    && previous?.mode === selection.mode
    && (selection.mode !== 'hub-selected' || JSON.stringify([previous.tests, previous.nvimFull]) === JSON.stringify([selection.tests, selection.nvimFull]))
    && JSON.stringify(previous.nvimTests) === JSON.stringify(selection.nvimTests);
}

// Default for pure callers; package admission replaces it with imports read from source.
export const NVIM_HUB_IMPORTS = [
  'hub/test/harness.ts', 'hub/test/process-cleanup.ts', 'hub/src/protocol.ts',
  'hub/src/tracker/tracker.ts', 'hub/src/tracker/prefixes.ts', 'hub/src/tracker/plan.ts',
  'hub/src/tracker/kinds.ts', 'hub/src/tracker/criteria.ts', 'hub/src/init/config.ts',
  'hub/src/hub/store.ts', 'hub/src/hub/visibility.ts', 'hub/src/hub/visibility-preferences.ts',
];

function chooseSuite(paths: readonly string[], nvimHubImports: readonly string[]): Pick<SuiteSelection, 'mode' | 'reason'> {
  const full = (reason: string) => ({ mode: 'full' as const, reason });
  if (!paths.length) return full('empty diff against fetched dev');
  const invalid = paths.find(path => path.split('/').some(part => part === '.' || part === '..'));
  if (invalid) return full(`ambiguous path ${invalid}`);
  for (const path of paths) {
    if (/^(?:shared|test-support)\//.test(path)) return full(`suite infrastructure ${path}`);
    if (['hub/src/test-lint-policy.ts', 'hub/src/hub/suite-candidate.ts'].includes(path)) return full(`suite infrastructure ${path}`);
    if (/^(?:hub\/src\/cli\/(?:crew|roles?)\.ts|hub\/src\/adapters\/contract\.ts|nvim\/lua\/cland\/(?:hub|state)\.lua|hub\/src\/protocol\.ts)$/.test(path)) return full(`shared contract ${path}`);
    if (/(?:^|\/)(?:package(?:-lock)?\.json|tsconfig[^/]*\.json)$/.test(path)) return full(`package configuration ${path}`);
    if (['hub/test/harness.ts', 'hub/test/process-cleanup.ts', 'hub/test/run-suite.ts', 'hub/test/load-gate.ts', 'hub/test/load-gate-reporter.ts', 'hub/src/suite-load-diagnostics.ts', 'hub/src/suite-selection.ts', 'hub/src/suite-dev-fetch.ts', 'hub/src/suite-shards.ts', 'hub/src/suite-durations.ts', 'hub/src/suite-duration-budget.ts', 'hub/src/suite-duration-context.ts', 'hub/src/suite-test-identities.ts', 'hub/test/duration-reporter.ts'].includes(path)) return full(`suite infrastructure ${path}`);
  }
  const nvim = paths.filter(path => path.startsWith('nvim/')).length;
  if (nvim && nvim !== paths.length) return full('mixed nvim and non-nvim paths');
  const imported = paths.find(path => !path.startsWith('hub/src/') && nvimHubImports.includes(path)) ?? paths.find(path => nvimHubImports.includes(path));
  if (imported) return full(`nvim test import ${imported}`);
  if (nvim) return { mode: 'nvim-only', reason: 'all paths under nvim/' };
  return { mode: 'hub-only', reason: 'all paths outside nvim/' };
}

export function chooseSuiteMode(paths: readonly string[], nvimHubImports: readonly string[] = NVIM_HUB_IMPORTS): SuiteMode {
  return chooseSuite(paths, nvimHubImports).mode;
}

// Tokenize comments and strings as units so examples in either cannot become imports.
// Covers static imports, re-exports and literal dynamic imports. Unresolved
// template imports fail closed rather than hiding a possible shared dependency.
export function importSpecifiers(source: string): string[] {
  const tokens = source.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[\w$]+|[^\s]/g)?.filter(token => !token.startsWith('//') && !token.startsWith('/*')) ?? [];
  const specifiers: string[] = [];
  const literal = (token: string | undefined) => {
    if (!token || !/^["'`]/.test(token)) return undefined;
    if (token.startsWith('`') && token.includes('${')) throw new Error('interpolated dynamic import cannot be resolved safely');
    return token.slice(1, -1).replace(/\\(["'`\\])/g, '$1');
  };
  for (let i = 0; i < tokens.length; i++) {
    const reexport = tokens[i] === 'export' && ['*', '{', 'type'].includes(tokens[i + 1] ?? '');
    if ((tokens[i] !== 'import' && !reexport) || tokens[i - 1] === '.') continue;
    // A default binding named `type` is a value (`import type from ...`).
    if (tokens[i + 1] === 'type' && tokens[i + 2] !== 'from' && tokens[i + 2] !== '=') continue;
    // Inline type specifiers leave an empty import/export that executes the module.
    let specifier = literal(tokens[i + 1]);
    if (tokens[i + 1] === '(') specifier = literal(tokens[i + 2]);
    else if (!specifier && tokens[i + 1] !== '.') {
      for (let j = i + 1; j < tokens.length && tokens[j] !== ';' && tokens[j] !== 'import'; j++) {
        if (tokens[j] === 'from') { specifier = literal(tokens[j + 1]); break; }
      }
    }
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
}

/** Runtime hub dependencies, attributed to each Neovim test through its helpers. */
export async function nvimHubImporters(cwd: string, files?: readonly string[]): Promise<Record<string, string[]>> {
  const importers = new Map<string, Set<string>>();
  const dependencies = new Map<string, string[]>();
  for await (const test of files ?? glob('nvim/test/**/*.test.ts', { cwd })) {
    const visited = new Set<string>();
    const pending = [test];
    while (pending.length) {
      const source = pending.pop()!;
      if (visited.has(source)) continue;
      visited.add(source);
      let paths = dependencies.get(source);
      if (!paths) {
        paths = importSpecifiers(await readFile(resolve(cwd, source), 'utf8')).filter(specifier => specifier.startsWith('.'))
          .map(specifier => relative(cwd, resolve(cwd, dirname(source), specifier)).split('\\').join(posix.sep));
        dependencies.set(source, paths);
      }
      for (const path of paths) {
        if (path.startsWith('hub/')) {
          const tests = importers.get(path) ?? new Set<string>();
          tests.add(test); importers.set(path, tests);
        } else if (/^(?:nvim|shared|test-support)\//.test(path) && /\.ts$/.test(path)) pending.push(path);
      }
    }
  }
  return Object.fromEntries([...importers].sort(([a], [b]) => a.localeCompare(b)).map(([path, tests]) => [path, [...tests].sort()]));
}

export async function nvimHubImports(cwd: string, files?: readonly string[]): Promise<string[]> {
  return Object.keys(await nvimHubImporters(cwd, files)).sort();
}

const exec = promisify(execFile);
export async function selectPackageSuite(cwd: string, requested: SuiteRequest = 'auto', env: NodeJS.ProcessEnv = process.env): Promise<SuiteSelection> {
  let task = false;
  let branch = '';
  let dev: string | undefined;
  let fallback: string | undefined;
  const select = async (): Promise<SuiteSelection> => {
    let files: string[] = [];
    try {
      const git = async (...args: string[]) => (await exec('git', args, { cwd, env: { ...env, GIT_TERMINAL_PROMPT: '0' }, timeout: args[0] === 'fetch' ? 5000 : 10_000, maxBuffer: 8 * 1024 * 1024 })).stdout;
      branch = (await git('branch', '--show-current')).trim();
      task = branch.startsWith('t/');
      try { dev = await fetchSuiteDev(cwd, git); }
      catch (error) {
        const cause = selectionFailure(error, env);
        try {
          const known = (await git('rev-parse', '--verify', 'refs/remotes/origin/dev^{commit}')).trim();
          await git('merge-base', known, 'HEAD');
          dev = known;
          fallback = `selection fallback: last known origin/dev ${known}; fetch unavailable: ${cause}`;
        } catch {
          fallback = `selection fallback: full; fetch unavailable: ${cause}; no usable origin/dev merge base`;
          return { mode: 'full', files, reason: fallback };
        }
      }
      const paths = await Promise.all([
        git('diff', '--name-only', '-z', '--no-renames', `${dev}...HEAD`),
        git('diff', '--name-only', '-z', '--no-renames', 'HEAD'),
        git('ls-files', '--others', '--exclude-standard', '-z'),
      ]);
      files = [...new Set(paths.flatMap(output => output.split('\0').filter(Boolean)))].sort();
      if (branch === 'dev') return { mode: 'full', files, reason: 'integrated dev always runs full' };
      if (requested === 'all') return { mode: 'full', files, reason: '--all / all forces full' };
      const importers = await nvimHubImporters(cwd);
      const { mode, reason } = chooseSuite(files, Object.keys(importers));
      if (requested !== 'auto' && mode !== `${requested}-only`) return { mode: 'full', files, reason: `diff does not qualify for requested ${requested} phase` };
      // Shared contracts and test infrastructure keep both package fallbacks.
      if (mode === 'hub-only' || mode === 'full' && reason.startsWith('nvim test import hub/src/')) {
        const nvimTests = reason.startsWith('nvim test import hub/src/') ? [...new Set([...files.flatMap(file => importers[file] ?? []), ...NVIM_SMOKE])].sort() : undefined;
        const nvimReason = nvimTests ? '; Neovim importers plus smoke' : '';
        const text = await readFile(resolve(cwd, '.cland/config.toml'), 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
        const config = text === null ? defaultConfig('suite') : parseConfig(text, 'suite', env);
        const selected = await coverageSelection(cwd, files, (await git('merge-base', dev, 'HEAD')).trim(), git, config.verification.coverageMaxAgeMs);
        if ('fallback' in selected && selected.fallback.startsWith('coverage shared infrastructure')) return { mode, files, reason: `${reason}; ${selected.fallback}` };
        if ('fallback' in selected) return { mode, files, reason: `${reason}; ${selected.fallback}${nvimReason}`, ...(nvimTests ? { nvimTests } : {}) };
        return { mode: 'hub-selected', files, reason: `function coverage selects hub tests${selected.notes.length ? '; ' + selected.notes.join('; ') : ''}${nvimReason}`, tests: [...new Set([...selected.tests, ...HUB_SMOKE])].sort(), functions: selected.functions, coverage: selected.map, nvimFull: false, ...(nvimTests ? { nvimTests } : {}) };
      }
      return { mode, files, reason };
    } catch (error) {
      fallback = `selection fallback: full; fetch/diff unavailable: ${selectionFailure(error, env)}`;
      return { mode: 'full', files, reason: fallback };
    }
  };
  const selection = await select();
  if (dev && !fallback) selection.fetchedDev = dev;
  if (fallback) selection.fallback = fallback;
  if (task) selection.loadGate = true;
  // Older candidate packages without tier assignments retain their package contract.
  const tiered = await readFile(resolve(cwd, 'hub/test/tiers.json'), 'utf8').then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
  if (!tiered || !task || requested === 'all') return selection;
  const source = await readFile(resolve(cwd, '.cland/config.toml'), 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  const config = source === null ? defaultConfig('suite') : parseConfig(source, 'suite', env);
  return taskSuiteSelection(selection, branch, requested, config.merge.queue);
}

/** Keep large stage identity sets below OS argument/environment size limits. */
export function selectionTransport(selection: SuiteSelection | undefined, path: string): { env: NodeJS.ProcessEnv; file?: string } {
  const text = JSON.stringify(selection ?? null);
  return Buffer.byteLength(text) > 64 * 1024
    ? { env: { CLAND_SUITE_SELECTION_FILE: path }, file: text }
    : { env: { CLAND_SUITE_SELECTION: text } };
}

export function selectionFromEnv(env: NodeJS.ProcessEnv = process.env): SuiteSelection | undefined {
  const text = env.CLAND_SUITE_SELECTION_FILE ? readFileSync(env.CLAND_SUITE_SELECTION_FILE, 'utf8') : env.CLAND_SUITE_SELECTION;
  if (!text) return undefined;
  const value = JSON.parse(text) as Record<string, unknown> | null;
  if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'mode') || !['full', 'hub-only', 'hub-selected', 'nvim-only'].includes(String(value.mode)) || !Object.hasOwn(value, 'files') || !Array.isArray(value.files) || !value.files.every(path => typeof path === 'string') || !Object.hasOwn(value, 'reason') || typeof value.reason !== 'string') throw new Error('invalid suite selection');
  if (value.mode === 'hub-selected' && (!Object.hasOwn(value, 'tests') || !Array.isArray(value.tests) || !value.tests.length || !value.tests.every(file => typeof file === 'string' && /^hub\/(?:src|test)\/.+\.test\.ts$/.test(file) && !file.split('/').some(part => part === '..' || part === '.')))) throw new Error('invalid selected hub tests');
  if (Object.hasOwn(value, 'nvimTests') && (!Array.isArray(value.nvimTests) || !value.nvimTests.length || !value.nvimTests.every(file => typeof file === 'string' && /^nvim\/test\/.+\.test\.ts$/.test(file) && !file.split('/').some(part => part === '..' || part === '.')))) throw new Error('invalid selected Neovim tests');
  if (Object.hasOwn(value, 'shard')) {
    const shard = value.shard as Record<string, unknown> | null;
    if (!shard || typeof shard !== 'object' || !Object.hasOwn(shard, 'files') || !Array.isArray(shard.files) || !shard.files.every(file => typeof file === 'string') || !Object.hasOwn(shard, 'nvim') || typeof shard.nvim !== 'boolean') throw new Error('invalid suite shard selection');
  }
  return value as SuiteSelection;
}
