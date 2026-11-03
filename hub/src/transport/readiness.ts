/** A deadline fences admission; only callback settlement is a drain receipt. */
export class ReadinessCleanupIncomplete extends Error {
  constructor() { super('host readiness cleanup incomplete'); }
}
export async function drained(work: Promise<unknown>, boundMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work.then(() => true, () => true),
      new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), boundMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
