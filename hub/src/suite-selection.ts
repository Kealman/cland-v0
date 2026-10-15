import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { glob, readFile } from 'node:fs/promises';
import { dirname, posix, relative, resolve } from 'node:path';

export type SuiteMode = 'hub-only' | 'nvim-only' | 'full';
export type SuiteSelection = { mode: SuiteMode; files: string[]; reason: string; fetchedDev?: string; shard?: { files: string[]; nvim: boolean } };
export type SuiteRequest = 'auto' | 'all' | 'hub' | 'nvim';

// Cross-package baselines, kept together so widening smoke coverage is one edit.
export const HUB_SMOKE = ['hub/test/tracer.test.ts', 'hub/test/daemon.test.ts'];
export const NVIM_SMOKE = ['nvim/test/client.test.ts', 'nvim/test/sessions.test.ts'];
const HUB_TARGETS = ['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts'];
const NVIM_TARGETS = ['nvim/test/**/*.test.ts'];

export function suitePhases(mode: SuiteMode): Array<{ name: string; targets: string[] }> {
  return [
    { name: mode === 'nvim-only' ? 'hub smoke' : 'hub', targets: mode === 'nvim-only' ? HUB_SMOKE : HUB_TARGETS },
    { name: mode === 'hub-only' ? 'Neovim smoke' : 'Neovim', targets: mode === 'hub-only' ? NVIM_SMOKE : NVIM_TARGETS },
  ];
}

export function describeSelection(selection: SuiteSelection, filesBytes = Infinity): string {
  let shown = selection.files;
  if (Number.isFinite(filesBytes)) {
    shown = [];
    let bytes = 2; // JSON array brackets
    for (const path of selection.files) {
      const next = Buffer.byteLength(JSON.stringify(path), 'utf8') + (shown.length ? 1 : 0);
      if (bytes + next > filesBytes) break;
      shown.push(path); bytes += next;
    }
  }
  const omitted = selection.files.length - shown.length;
  return `mode ${selection.mode}; ${selection.reason}; deciding files ${JSON.stringify(shown)}${omitted ? `; ${omitted} more (${selection.files.length} total; full list in log)` : ''}`;
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
    if (/^(?:hub\/src\/cli\/(?:crew|roles?)\.ts|hub\/src\/adapters\/contract\.ts|nvim\/lua\/cland\/(?:hub|state)\.lua|hub\/src\/protocol\.ts)$/.test(path)) return full(`shared contract ${path}`);
    if (/(?:^|\/)(?:package(?:-lock)?\.json|tsconfig[^/]*\.json)$/.test(path)) return full(`package configuration ${path}`);
    if (['hub/test/run-suite.ts', 'hub/src/suite-selection.ts', 'hub/src/suite-shards.ts', 'hub/src/suite-durations.ts', 'hub/test/duration-reporter.ts'].includes(path)) return full(`suite infrastructure ${path}`);
    if (nvimHubImports.includes(path)) return full(`nvim test import ${path}`);
  }
  const nvim = paths.filter(path => path.startsWith('nvim/')).length;
  if (nvim && nvim !== paths.length) return full('mixed nvim and non-nvim paths');
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

export async function nvimHubImports(cwd: string): Promise<string[]> {
  const paths = new Set<string>();
  const visited = new Set<string>();
  const pending: string[] = [];
  for await (const test of glob('nvim/test/**/*.test.ts', { cwd })) pending.push(test);
  while (pending.length) {
    const test = pending.pop()!;
    if (visited.has(test)) continue;
    visited.add(test);
    for (const specifier of importSpecifiers(await readFile(resolve(cwd, test), 'utf8'))) {
      if (!specifier.startsWith('.')) continue;
      const path = relative(cwd, resolve(cwd, dirname(test), specifier)).split('\\').join(posix.sep);
      if (path.startsWith('hub/')) paths.add(path);
      else if (path.startsWith('nvim/test/')) pending.push(path);
    }
  }
  return [...paths].sort();
}

const exec = promisify(execFile);
export async function selectPackageSuite(cwd: string, requested: SuiteRequest = 'auto', env: NodeJS.ProcessEnv = process.env): Promise<SuiteSelection> {
  let files: string[] = [];
  try {
    const git = async (...args: string[]) => (await exec('git', args, { cwd, env, timeout: 10_000, maxBuffer: 8 * 1024 * 1024 })).stdout;
    // Never select against a stale dev ref, even if an old origin/dev exists.
    await git('fetch', 'origin', '+refs/heads/dev:refs/remotes/origin/dev');
    const branch = (await git('branch', '--show-current')).trim();
    const paths = await Promise.all([
      git('diff', '--name-only', '-z', '--no-renames', 'origin/dev...HEAD'),
      git('diff', '--name-only', '-z', '--no-renames', 'HEAD'),
      git('ls-files', '--others', '--exclude-standard', '-z'),
    ]);
    files = [...new Set(paths.flatMap(output => output.split('\0').filter(Boolean)))].sort();
    if (branch === 'dev') return { mode: 'full', files, reason: 'integrated dev always runs full', fetchedDev: (await git('rev-parse', 'origin/dev')).trim() };
    if (requested === 'all') return { mode: 'full', files, reason: '--all / all forces full' };
    const { mode, reason } = chooseSuite(files, await nvimHubImports(cwd));
    if (requested !== 'auto' && mode !== `${requested}-only`) return { mode: 'full', files, reason: `diff does not qualify for requested ${requested} phase` };
    return { mode, files, reason };
  } catch (error) {
    return { mode: 'full', files, reason: `fetch/diff unavailable: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}` };
  }
}

export function selectionFromEnv(): SuiteSelection | undefined {
  const text = process.env.CLAND_SUITE_SELECTION;
  if (!text) return undefined;
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || !('mode' in value) || !['full', 'hub-only', 'nvim-only'].includes(String(value.mode)) || !('files' in value) || !Array.isArray(value.files) || !value.files.every(path => typeof path === 'string') || !('reason' in value) || typeof value.reason !== 'string') throw new Error('invalid suite selection');
  if ('shard' in value) {
    const shard = value.shard;
    if (!shard || typeof shard !== 'object' || !('files' in shard) || !Array.isArray(shard.files) || !shard.files.every(file => typeof file === 'string') || !('nvim' in shard) || typeof shard.nvim !== 'boolean') throw new Error('invalid suite shard selection');
  }
  return value as SuiteSelection;
}
