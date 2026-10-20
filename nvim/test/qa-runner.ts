import { withoutExecutorCredentials } from '../../shared/executor-credentials.ts';
// Shared headless QA CLI fixture; all children belong to the calling test.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ownProcess } from '../../hub/test/process-cleanup.ts';
const CLI = fileURLToPath(new URL('../../hub/bin/cland.ts', import.meta.url));

type Line = { case: string; result: string; duration_ms: number; build: string; hub: string; message?: string; evidence: unknown };
type Run = { code: number | null; stdout: string; stderr: string; line: Line };

/** Run `cland --headless --qa …`, optionally under a command prefix (a sandbox); the one JSON line parsed. */
export function qa(t: TestContext, args: string[], options: { prefix?: string[]; env?: Record<string, string>; cwd?: string; started?: (child: ChildProcess) => void } = {}): Promise<Run> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_')) env[k] = v;
  if (process.env.CLAND_NVIM) env.CLAND_NVIM = process.env.CLAND_NVIM;
  Object.assign(env, options.env);
  // Node restores a deleted coverage variable; disable writes sandbox profiles may deny.
  if (options.prefix?.includes('/usr/bin/sandbox-exec')) env.NODE_V8_COVERAGE = '';
  const argv = [...(options.prefix ?? []), process.execPath, CLI, '--headless', '--qa', ...args];
  const child = spawn(argv[0] as string, argv.slice(1), { cwd: options.cwd ?? process.cwd(), env: withoutExecutorCredentials(env), stdio: ['ignore', 'pipe', 'pipe'] });
  ownProcess(t, child.pid);
  t.after(() => void child.kill('SIGKILL'));
  options.started?.(child);
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (c: string) => (stdout += c));
  child.stderr.setEncoding('utf8').on('data', (c: string) => (stderr += c));
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      const lines = stdout.split('\n').filter(Boolean);
      try {
        assert.equal(lines.length, 1, `one JSON line on stdout, got:\n${stdout}\nstderr:\n${stderr}`);
        resolve({ code, stdout, stderr, line: JSON.parse(lines[0] as string) as Line });
      } catch (err) {
        reject(err);
      }
    });
  });
}
