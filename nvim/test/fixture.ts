// Neovim fixture ownership: stop clients before removing their scratch directories.
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as poll } from 'node:timers/promises';
import type { TestContext } from 'node:test';
import { assertTestAdmission } from '../../test-support/admission.ts';
let admission: Promise<void> | undefined;
/** Keep cached initialization behind a fresh caller-owned async promise. */
export async function ensureFixtureAdmission(): Promise<void> {
  return admission ??= assertTestAdmission();
}
type Step = () => unknown | Promise<unknown>;
const cleanups = new WeakMap<TestContext, { clients: Step[]; directories: Step[] }>();
function cleanup(t: TestContext) {
  let steps = cleanups.get(t);
  if (!steps) {
    steps = { clients: [], directories: [] };
    cleanups.set(t, steps);
    const owned = steps;
    t.after(async () => {
      const errors: unknown[] = [];
      for (const step of owned.clients) {
        try { await step(); } catch (error) { errors.push(error); }
      }
      // Preserve a fixture if any writer's exit could not be observed.
      if (!errors.length) for (const step of owned.directories) {
        try { await step(); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, 'Neovim fixture cleanup failed');
    });
  }
  return steps;
}
export function beforeDirectories(t: TestContext, step: Step): void { cleanup(t).clients.push(step); }
export function ownDirectory(t: TestContext, path: string): void {
  cleanup(t).directories.push(() => rm(path, { recursive: true, force: true }));
}
export async function tempProject(t: TestContext, prefix = 'cland-proj-', parent = tmpdir()): Promise<string> {
  await ensureFixtureAdmission();
  const root = await realpath(await mkdtemp(join(parent, prefix)));
  ownDirectory(t, root);
  return root;
}
export function testWaitMs(fallbackMs = 15_000): number {
  const configured = Number(process.env.CLAND_TEST_WAIT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : fallbackMs;
}
/** Bounded observation of an RPC/control condition, never an elapsed-time assertion. */
export async function eventually<T>(what: string, check: () => Promise<T | undefined> | T | undefined, timeoutMs = testWaitMs()): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (Date.now() < deadline && value !== undefined) return value;
      if (value !== undefined) last = `late observation: ${JSON.stringify(value)}`;
    }
    catch (error) { last = error; }
    if (Date.now() >= deadline) break;
    await poll(50); // lint-allow-wall-clock: bounded polling of a client/control observation
  }
  throw new Error(`${what}: not within ${timeoutMs} ms${last ? ` (last error: ${String(last)})` : ''}`);
}
