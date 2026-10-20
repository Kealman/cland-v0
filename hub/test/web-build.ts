// The package runner calls this once, outside the per-file browser fixtures.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webBundleState } from '../src/web-bundle.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';

export async function ensureWebBuild(cwd: string): Promise<void> {
  if ((await webBundleState(cwd)).state === 'current') {
    console.log('Web bundle: current (check/prepare build receipt)');
    return;
  }
  const root = await mkdtemp(join(tmpdir(), 'wb-'));
  try {
    const child = spawn(process.execPath, [join(cwd, 'web/build.ts')], { cwd: join(cwd, 'web'), env: fixtureEnvironment(root, process.env), stdio: 'inherit' });
    const code = await new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
    if (code !== 0) throw new Error(`Web bundle build failed (${code})`);
    console.log('Web bundle: built once before browser workers');
  } finally { await rm(root, { recursive: true, force: true }); }
}
