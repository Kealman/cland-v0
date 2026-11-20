import { AsyncLocalStorage } from 'node:async_hooks';

/** Local prune ownership is never serialized to a remote agent. */
export type PruneCommand = {
  run(cwd: string, args: readonly string[], env: NodeJS.ProcessEnv, input?: string): Promise<string>;
  command?(cwd: string, args: readonly string[], env: NodeJS.ProcessEnv, input?: string): Promise<import('../host.ts').HostRunResult>;
};
export const pruneCommand = new AsyncLocalStorage<PruneCommand>();

/** Older local scopes may expose only run; both adapters keep their known facts. */
export function scopedCommandFailure(error: { code?: number | string | null; stdout?: string; stderr?: string; message?: string;
  nativeClose?: { code: number | null; signal: string | null }; nativeCleanup?: 'complete' | 'incomplete'; nativeAdmission?: 'no-process' }): import('../host.ts').HostRunResult {
  return {
    code: typeof error.code === 'number' ? error.code : error.nativeClose?.code ?? null,
    stdout: error.stdout ?? '', stderr: error.stderr ?? '',
    ...(typeof error.code === 'number' && error.nativeCleanup !== 'incomplete' ? {} : { error: error.message ?? String(error) }),
    ...(error.nativeClose ? { nativeClose: error.nativeClose } : {}),
    ...(error.nativeCleanup ? { nativeCleanup: error.nativeCleanup } : {}),
    ...(error.nativeAdmission ? { nativeAdmission: error.nativeAdmission } : {}),
  };
}
