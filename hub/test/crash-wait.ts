import { eventually, type WaitOptions } from './until.ts';

/** Crash tests need native exit, which can precede the parent's PID collection. */
export async function waitForCrash(
  process: { signalZero: () => void; exited: () => boolean },
  options: WaitOptions & { signal?: AbortSignal } = {},
): Promise<'absent' | 'exited'> {
  const result = await eventually('the hub crashed', () => {
    if (options.signal?.aborted) return 'cancelled' as const;
    if (process.exited()) return 'exited' as const;
    try { process.signalZero(); }
    catch (error) {
      if ((error as { code?: string }).code === 'ESRCH') return 'absent' as const;
      throw error;
    }
    return undefined;
  }, options);
  if (result === 'cancelled') throw options.signal?.reason ?? new Error('crash observation cancelled');
  return result;
}
