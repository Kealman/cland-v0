import type { ReceiptStep } from '../../hub/test/receipt-fixture-case.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
// Shared headless QA CLI fixture; all children belong to the calling test.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ownProcess } from '../../hub/test/process-cleanup.ts';
import { tempProject } from '../../hub/test/harness.ts';
const CLI = fileURLToPath(new URL('../../hub/bin/cland.ts', import.meta.url));

type Line = { case: string; result: string; duration_ms: number; build: string; hub: string; message?: string; evidence: unknown };
type Run = { code: number | null; stdout: string; stderr: string; line: Line };

/** Run `cland --headless --qa …`, optionally under a command prefix (a sandbox); the one JSON line parsed. */
export async function qa(t: TestContext, args: string[], options: { prefix?: string[]; env?: Record<string, string>; cwd?: string; rootAllocated?: (root: string) => void; started?: (child: ChildProcess) => void } = {}): Promise<Run> {
  const root = await tempProject(t, 'cland-qa-cli-');
  options.rootAllocated?.(root);
  const env: Record<string, string> = {};
  if (process.env.CLAND_NVIM) env.CLAND_NVIM = process.env.CLAND_NVIM;
  Object.assign(env, options.env);
  // Node restores a deleted coverage variable; disable writes sandbox profiles may deny.
  if (options.prefix?.includes('/usr/bin/sandbox-exec')) env.NODE_V8_COVERAGE = '';
  const argv = [...(options.prefix ?? []), process.execPath, CLI, '--headless', '--qa', ...args];
  const child = spawn(argv[0] as string, argv.slice(1), { cwd: options.cwd ?? root, env: fixtureEnvironment(root, process.env, env), stdio: ['ignore', 'pipe', 'pipe'] });
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

/** Enroll the original QA call before observing setup. A close that wins during
 * allocation also stops a late child as soon as its native owner is captured. */
export async function ownedQa(t: TestContext, step: ReceiptStep, adoptRoot: (root: string) => void, release: (action: () => void) => void,
  args: string[], options: NonNullable<Parameters<typeof qa>[2]> & { completionMs?: number } = {}, runQa: typeof qa = qa) {
  const { completionMs, ...runOptions } = options;
  const setup = Promise.withResolvers<void>();
  let closing = false, child: ChildProcess | undefined;
  const stop = () => { if (child?.pid !== undefined && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); };
  release(() => { closing = true; stop(); });
  const original = step('original QA run', () => runQa(t, args, {
    ...runOptions,
    rootAllocated: root => {
      adoptRoot(root);
      if (closing) throw new Error('QA acquisition closed before launch');
      options.rootAllocated?.(root);
    },
    started: value => {
      child = value;
      if (closing) stop();
      options.started?.(value);
      setup.resolve();
    },
  }), completionMs);
  void original.catch(error => setup.reject(error));
  await step('QA native ownership setup', () => setup.promise);
  return step('QA native completion and result', () => original, completionMs);
}

/** Capture the native handle and enroll its close before awaiting RPC setup. */
export function ownedDumpClient<T>(t: TestContext, step: ReceiptStep, release: (action: () => void) => void,
  start: (started: (child: ChildProcess) => void) => Promise<T>): Promise<T> {
  let closing = false, child: ChildProcess | undefined;
  const stop = () => { if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); };
  release(() => { closing = true; stop(); });
  return step('QA dump client setup', () => start(value => {
    child = value;
    const receipt = new Promise<void>(resolve => value.once('close', () => resolve()));
    const joined = step('QA dump child close receipt', () => receipt);
    void joined.catch(() => {});
    t.after(() => joined);
    if (closing) stop();
  }));
}
