import { MergeError } from '../merge.ts';
import { protectedCommandText, ProtectedCommandCapture } from '../suite-command-output.ts';

/** A moved verification tree releases serialization before another check. */
export class EnqueueBaseMoved extends Error {}

function diagnosticText(value: unknown): string {
  try { const text: unknown = value instanceof Error ? value.message : value; return typeof text === 'string' ? text : String(text); }
  catch { return '[diagnostic unavailable]'; }
}

/** Public projections never mutate the producing owner's exact private errors. */
export class EnqueueFailure extends MergeError {
  declare readonly secondary: readonly unknown[];
  declare readonly header: string;
  constructor(primary: unknown, header = '', secondary: readonly unknown[] = []) {
    const identity = new ProtectedCommandCapture();
    if (primary instanceof EnqueueFailure && primary.header) { identity.write(primary.header); if (header) identity.write('\n'); }
    identity.write(header);
    const publicHeader = identity.finish('', 4096);
    const cleanup = new ProtectedCommandCapture();
    for (const error of secondary) {
      cleanup.write('secondary diagnostic: preflight cleanup failed: ');
      cleanup.write(diagnosticText(error));
      cleanup.write('\n');
    }
    // Primary and secondary diagnostics each keep one protected 16 KiB tail;
    // the independently protected header preserves command/retained-root identity.
    const publicText = [publicHeader, protectedCommandText(diagnosticText(primary)),
      secondary.length ? cleanup.finish() : ''].filter(Boolean).join('\n');
    super(primary instanceof MergeError ? primary.code : 'merge-git', publicText, primary instanceof MergeError ? primary.files : undefined, primary instanceof MergeError ? primary.recovery : undefined);
    Object.defineProperty(this, 'cause', { value: primary });
    Object.defineProperty(this, 'secondary', { value: secondary });
    Object.defineProperty(this, 'header', { value: publicHeader });
  }
}

/** The native owner still owns writers. This promise is a positive close and
 * guarded removal obligation, not permission inferred from an error message. */
export class EnqueueNativeIncomplete extends EnqueueFailure {
  readonly settled: Promise<void>;
  constructor(path: string, primary: Error, settled: Promise<void>) {
    super(primary, `native closure incomplete; checkout retained: ${path}`);
    this.settled = settled;
    void settled.catch(() => {});
  }
}

/** A hub-epoch fence: preflights are joined before this owner is discarded. */
export class EnqueueCancellations {
  readonly #revisions = new Map<string, number>();
  cancel(item: string): void { this.#revisions.set(item, (this.#revisions.get(item) ?? 0) + 1); }
  capture(item: string): () => void {
    const revision = this.#revisions.get(item) ?? 0;
    return () => {
      if ((this.#revisions.get(item) ?? 0) !== revision) throw new MergeError('merge-changed', `${item}: cancelled during preflight`);
    };
  }
}

/** Called under territory serialization, after the long check and cleanup. */
export async function validateEnqueueCandidate(checked: { taskHead: string; base: string; baseTree: string }, current: { head: string; baseTip: string }, identity: (head: string) => Promise<string>): Promise<void> {
  if (checked.taskHead !== current.head) throw new MergeError('merge-changed', 'task head changed during preflight');
  if (current.baseTip !== checked.base && await identity(current.baseTip) !== checked.baseTree) throw new EnqueueBaseMoved();
}

export const ENQUEUE_CHECK_SKIPPED = 'preflight skipped: no verification check configured';
export type EnqueueCheck = { command: string; code: number; tail: string; summary?: string; skipped?: never }
  | { command: null; code: null; tail: ''; summary?: never; skipped: typeof ENQUEUE_CHECK_SKIPPED };

export interface EnqueuePreflight<C> {
  prepare(): Promise<C>;
  check(candidate: C): Promise<EnqueueCheck>;
  remove(candidate: C): Promise<void>;
}

/** Admission owns the short locked revalidation; checks never hold that lock. */
export async function checkedEnqueue<C, T>(backend: EnqueuePreflight<C>, admit: (candidate: C, receipt: EnqueueCheck) => Promise<T>): Promise<T> {
  try { return await enqueueCandidate(backend, admit); }
  catch (error) { throw error instanceof EnqueueFailure ? error : new EnqueueFailure(error); }
}

async function enqueueCandidate<C, T>(backend: EnqueuePreflight<C>, admit: (candidate: C, receipt: EnqueueCheck) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidate = await backend.prepare();
    let failed = false;
    let failure: unknown;
    let receipt: EnqueueCheck | null = null;
    try {
      receipt = await backend.check(candidate);
      if (!receipt.skipped && receipt.code !== 0) throw new EnqueueFailure(new MergeError('merge-test-lint', receipt.tail), `${receipt.command}: exit ${receipt.code}`);
    } catch (error) {
      if (error instanceof EnqueueNativeIncomplete) throw error;
      failed = true; failure = error;
    }
    try { await backend.remove(candidate); }
    catch (error) {
      if (!failed) throw error;
      failure = failure instanceof EnqueueFailure
        ? new EnqueueFailure(failure.cause, failure.header, [...failure.secondary, error])
        : new EnqueueFailure(failure, '', [error]);
    }
    if (failed) throw failure;
    if (!receipt) throw new Error('preflight check receipt unavailable');
    try { return await admit(candidate, receipt); }
    catch (error) { if (!(error instanceof EnqueueBaseMoved)) throw error; }
  }
  throw new MergeError('merge-changed', 'dev moved during preflight');
}
