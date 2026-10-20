// Candidate-owned probe; inspect the pinned test shell without launching a browser.
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';

const packageRoot = fileURLToPath(new URL('../../node_modules/playwright-core/', import.meta.url));
export const browserCache = join(packageRoot, '.local-browsers');
export type WebPrerequisite = { available: true; executablePath: string } | { available: false; reason: string };

export async function webPrerequisite(): Promise<WebPrerequisite> {
  let browsers: { browsers: Array<{ name: string; revision: string }> };
  try { browsers = JSON.parse(await readFile(join(packageRoot, 'browsers.json'), 'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { available: false, reason: 'playwright-core is not installed; run npm install' };
    throw error;
  }
  const revision = browsers.browsers.find(browser => browser.name === 'chromium-headless-shell')?.revision;
  if (!revision || !/^\d+$/.test(revision)) throw new Error('pinned Playwright package has no Headless Shell revision');
  // These are the pinned package's Headless Shell layouts, never branded Chrome.
  const layouts: Record<string, string[]> = {
    'darwin-arm64': ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell'],
    'darwin-x64': ['chrome-headless-shell-mac-x64', 'chrome-headless-shell'],
    'linux-x64': ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
    'linux-arm64': ['chrome-headless-shell-linux-arm64', 'chrome-headless-shell'],
  };
  const layout = layouts[`${process.platform}-${process.arch}`];
  if (!layout) return { available: false, reason: `Headless Shell test fixture does not support ${process.platform}/${process.arch}` };
  const directory = join(browserCache, `chromium_headless_shell-${revision}`);
  const executablePath = join(directory, ...layout);
  try { await access(executablePath, constants.X_OK); }
  catch (error) {
    if (['ENOENT', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) return { available: false, reason: 'pinned Chrome Headless Shell is missing or not executable; run npm run test:web:install' };
    throw error;
  }
  if (process.platform !== 'linux') return { available: true, executablePath };
  const root = await mkdtemp(join(tmpdir(), 'wp-'));
  try {
    const env = fixtureEnvironment(root, process.env, { TMPDIR: root, TMP: root, TEMP: root });
    const shellDirectory = join(directory, layout[0]!);
    const binaries = [executablePath, ...(await readdir(shellDirectory)).filter(name => /\.so(?:\.\d+)*$/.test(name)).map(name => join(shellDirectory, name))];
    const missing = new Set<string>();
    const deadline = Date.now() + 15_000;
    for (const binary of binaries) {
      let stdout: string;
      try { stdout = (await promisify(execFile)('ldd', [binary], { cwd: root, env, timeout: Math.max(1, Math.min(3000, deadline - Date.now())), maxBuffer: 128 * 1024 })).stdout; }
      catch (error) {
        const result = error as { stdout?: string; stderr?: string; code?: string | number };
        stdout = result.stdout ?? '';
        if (!/=>\s+not found/.test(stdout)) {
          return { available: false, reason: `cannot inspect Linux Headless Shell libraries (${basename(binary)}; ldd ${result.code === 'ENOENT' ? 'not installed' : 'failed or timed out'})` };
        }
      }
      for (const match of stdout.matchAll(/^\s*(\S+)\s+=>\s+not found\s*$/gm)) missing.add(match[1]!);
    }
    return missing.size ? { available: false, reason: `Linux Headless Shell libraries missing: ${[...missing].sort().join(', ')}; T-993 prepares browser-capable executors` } : { available: true, executablePath };
  } finally { await rm(root, { recursive: true, force: true }); }
}
