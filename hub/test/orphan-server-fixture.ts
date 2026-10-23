// Shared real-server fixture for lifecycle and T4 performance tests.
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, open, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { eventually } from './harness.ts';
import { ownDirectory, ownProcess } from './process-cleanup.ts';

export const OPENCODE_FAKE = fileURLToPath(new URL('./fakes/opencode/opencode', import.meta.url));
export async function fakeOpenCode(t: import('node:test').TestContext) {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'fake-opencode-')));
  ownDirectory(t, home);
  return { env: { CLAND_OPENCODE_BIN: OPENCODE_FAKE, FAKE_OPENCODE_HOME: home, FAKE_OPENCODE_TURN_MS: '30', CLAND_ADAPTER_POLL_MS: '50' } };
}
export async function leftoverOpenCode(t: import('node:test').TestContext, root: string, bin: string, env: Record<string, string>, cwd = root, name = 'leftover') {
  const dir = join(root, '.cland', 'opencode', name);
  await mkdir(dir, { recursive: true });
  const log = join(dir, 'serve.log');
  const fd = await open(log, 'a');
  // cland-allow-child-env: native orphan server preserves the caller-owned scratch HOME/XDG database identity over the sealed fixture worker
  const child = spawn(bin, ['serve', '--hostname', '127.0.0.1', '--port', '0'], { cwd, detached: true, stdio: ['ignore', fd.fd, fd.fd], env: { ...process.env, ...env } });
  ownProcess(t, child.pid);
  await fd.close();
  await eventually('OpenCode listening', async () => /listening on/.test(await readFile(log, 'utf8')) ? true : undefined, 20_000);
  return child.pid!;
}
