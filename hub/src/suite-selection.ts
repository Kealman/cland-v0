import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export type SuiteMode = 'hub-only' | 'nvim-only' | 'full';
export type SuiteSelection = { mode: SuiteMode; files: string[]; reason: string };
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

export function chooseSuiteMode(paths: readonly string[]): SuiteMode {
  if (!paths.length) return 'full';
  // Positive allowlists: newly added shared infrastructure stays full by default.
  const hubLocal = (path: string) => /^(?:hub\/src\/(?:tracker|adapters)\/.+\.ts|hub\/src\/cli\/(?!suite\.ts$|socket-client\.ts$).+\.ts|hub\/(?:src|test)\/.+\.test\.ts)$/.test(path);
  const nvimLocal = (path: string) => /^(?:nvim\/lua\/.+\.lua|nvim\/init\.lua|nvim\/bin\/.+\.(?:ts|lua)|nvim\/test\/.+\.test\.ts)$/.test(path);
  if (paths.some(path => /^(?:hub\/src\/cli\/(?:crew|roles?)\.ts|hub\/src\/adapters\/contract\.ts|nvim\/lua\/cland\/(?:hub|state)\.lua)$/.test(path))) return 'full';
  if (paths.some(path => /(?:^|\/)(?:package(?:-lock)?\.json|tsconfig[^/]*\.json)$/.test(path) || path.split('/').some(part => part === '..' || part === '.'))) return 'full';
  if (paths.every(hubLocal)) return 'hub-only';
  if (paths.every(nvimLocal)) return 'nvim-only';
  return 'full';
}

const exec = promisify(execFile);
export async function selectPackageSuite(cwd: string, requested: SuiteRequest = 'auto'): Promise<SuiteSelection> {
  let files: string[] = [];
  try {
    const git = async (...args: string[]) => (await exec('git', args, { cwd, timeout: 10_000, maxBuffer: 8 * 1024 * 1024 })).stdout;
    // Never select against a stale dev ref, even if an old origin/dev exists.
    await git('fetch', 'origin', '+refs/heads/dev:refs/remotes/origin/dev');
    const branch = (await git('branch', '--show-current')).trim();
    const paths = await Promise.all([
      git('diff', '--name-only', '-z', '--no-renames', 'origin/dev...HEAD'),
      git('diff', '--name-only', '-z', '--no-renames', 'HEAD'),
      git('ls-files', '--others', '--exclude-standard', '-z'),
    ]);
    files = [...new Set(paths.flatMap(output => output.split('\0').filter(Boolean)))].sort();
    if (branch === 'dev') return { mode: 'full', files, reason: 'integrated dev always runs full' };
    if (requested === 'all') return { mode: 'full', files, reason: '--all / all forces full' };
    const mode = chooseSuiteMode(files);
    if (requested !== 'auto' && mode !== `${requested}-only`) return { mode: 'full', files, reason: `diff does not qualify for requested ${requested} phase` };
    return { mode, files, reason: !files.length ? 'empty diff against fetched dev' : mode === 'full' ? 'mixed, shared or ambiguous paths' : 'package-local diff against fetched dev' };
  } catch (error) {
    return { mode: 'full', files, reason: `fetch/diff unavailable: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}` };
  }
}

export function selectionFromEnv(): SuiteSelection | undefined {
  const text = process.env.CLAND_SUITE_SELECTION;
  if (!text) return undefined;
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || !('mode' in value) || !['full', 'hub-only', 'nvim-only'].includes(String(value.mode)) || !('files' in value) || !Array.isArray(value.files) || !value.files.every(path => typeof path === 'string') || !('reason' in value) || typeof value.reason !== 'string') throw new Error('invalid suite selection');
  return value as SuiteSelection;
}
