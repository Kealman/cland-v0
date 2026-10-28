import type { TestContext } from 'node:test';
import { transcribeNote, type SpeechInput, type SpeechProvider } from '../../../src/speech/index.ts';

/** Native setup/drain bounds are independent of the behavior's injected clock. */
export async function bounded<T>(work: Promise<T>, ms: number, reason: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(reason)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

/** Register before acquisition. Abort and join exchanges before their native owner closes.
 * Native fixtures also own each provider call; synthetic never-settling providers
 * have no I/O to drain and intentionally prove note-level cancellation only.
 */
export function speechExchange(t: TestContext, nativeClose: () => Promise<void> = async () => {}, ownProvider = false) {
  const controller = new AbortController();
  const running = new Set<Promise<unknown>>();
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    controller.abort();
    await bounded(Promise.allSettled([...running]), 2_000, 'speech exchange drain incomplete');
    await bounded(nativeClose(), 2_000, 'speech native close incomplete');
  })();
  t.after(close);
  function run<T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const nativeBound = new AbortController();
    const lifetime = AbortSignal.any([controller.signal, nativeBound.signal, ...(signal ? [signal] : [])]);
    const timer = setTimeout(() => nativeBound.abort(), 5_000);
    const work = Promise.resolve().then(() => { lifetime.throwIfAborted(); return operation(lifetime); });
    running.add(work);
    // Observe errors immediately, including when a test fails before awaiting its result.
    const settled = () => { clearTimeout(timer); running.delete(work); };
    void work.then(settled, settled);
    return work;
  }
  return {
    run, close,
    transcribe: (provider: SpeechProvider, input: SpeechInput, options?: Parameters<typeof transcribeNote>[2]) =>
      run(signal => transcribeNote(ownProvider ? { name: provider.name, transcribe: attempt =>
        run(nativeSignal => provider.transcribe({ ...attempt, signal: nativeSignal }), attempt.signal),
      } : provider, { ...input, signal }, options), input.signal),
  };
}
