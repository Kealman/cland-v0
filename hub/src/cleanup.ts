import type { Resumed } from './hub/worktrees.ts';

// Keep the primary error object (including domain codes and recovery instructions) when cleanup fails too.
function cleanupFailure(primary: unknown, secondary: unknown): Error {
  const detail = secondary instanceof Error ? secondary.message : String(secondary);
  if (primary instanceof Error) {
    primary.message += `; cleanup failed: ${detail}`;
    return primary;
  }
  return new Error(`${String(primary)}; cleanup failed: ${detail}`, { cause: primary });
}

export function withCleanup<T>(operation: () => T, cleanup: () => void): T {
  let result: T;
  try { result = operation(); }
  catch (primary) {
    try { cleanup(); }
    catch (secondary) { throw cleanupFailure(primary, secondary); }
    throw primary;
  }
  cleanup();
  return result;
}

export async function withCleanupAsync<T>(operation: () => Promise<T>, cleanup: () => Promise<void>, resumed: Resumed = work => work()): Promise<T> {
  let result: T;
  try { result = await operation(); }
  catch (primary) {
    try { await cleanup(); }
    catch (secondary) { return resumed(() => { throw cleanupFailure(primary, secondary); }); }
    return resumed(() => { throw primary; });
  }
  await cleanup();
  return resumed(() => result);
}
