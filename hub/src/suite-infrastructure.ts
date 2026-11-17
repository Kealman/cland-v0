import { writeFile } from 'node:fs/promises';
import fs from 'node:fs';

// Package runners reserve EX_TEMPFAIL for an incomplete infrastructure outcome.
export const SUITE_INFRASTRUCTURE_EXIT = 75;
export const SUITE_INFRASTRUCTURE_PREFIX = 'suite infrastructure: ';
export const SUITE_CAUSE_BYTES = 4096;
export const suiteInfrastructureLine = (line: string): boolean => line.startsWith(SUITE_INFRASTRUCTURE_PREFIX);
export type SuiteInfrastructureSource = {
  outcome?: { code: number; cause: string } | null;
  shards?: readonly (SuiteInfrastructureSource & { shardName?: string })[];
};
/** Aggregate display labels are not a parser: inspect the recorded child causes. */
export function suiteInfrastructureCauses(source: SuiteInfrastructureSource): string[] {
  const cause = source.outcome?.cause;
  return [
    ...(cause && suiteInfrastructureLine(cause) ? [cause] : []),
    ...(source.shards?.flatMap(shard => suiteInfrastructureCauses(shard)
      .map(line => shard.shardName ? `${shard.shardName}: ${line}` : line)) ?? []),
  ];
}
export function suiteCommandOutcome(code: number, cause: string) {
  return { code, cause, ...(code === SUITE_INFRASTRUCTURE_EXIT && suiteInfrastructureLine(cause) ? { notRun: 'infrastructure' as const } : {}) };
}
// Only the package owner writes this optional channel; test children do not inherit it.
export async function writeSuiteCause(cause: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (env.CLAND_SUITE_CAUSE_FILE) await writeFile(env.CLAND_SUITE_CAUSE_FILE, Buffer.from(cause.slice(0, SUITE_CAUSE_BYTES)).subarray(0, SUITE_CAUSE_BYTES), { mode: 0o600 });
}
/** Self-contained for the uploaded status program; payload cap plus one sentinel. */
export function readSuiteCauseBounded(io: Pick<typeof fs, 'openSync' | 'readSync' | 'closeSync'>, path: string, limit: number, prefix: string): string {
  let fd: number | undefined;
  let cause = '';
  const diagnostics: string[] = [];
  try {
    fd = io.openSync(path, 'r');
    const bytes = Buffer.alloc(limit + 1);
    let kept = 0;
    while (kept < bytes.length) {
      const count = io.readSync(fd, bytes, kept, bytes.length - kept, kept);
      if (count === 0) break;
      kept += count;
    }
    if (kept > limit) diagnostics.push(`suite cause receipt exceeds ${limit} bytes; incomplete`);
    else {
      const text = bytes.subarray(0, kept).toString('utf8').trim();
      if (text.startsWith(prefix)) cause = text;
      else if (text) diagnostics.push('suite cause receipt invalid; incomplete');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') diagnostics.push(`suite cause receipt unavailable: ${String(error).slice(0, 1024)}`);
  } finally {
    if (fd !== undefined) try { io.closeSync(fd); }
    catch (error) { diagnostics.push(`suite cause receipt close failed: ${String(error).slice(0, 1024)}`); }
  }
  return [cause, ...diagnostics.map(text => `secondary diagnostic: ${text}`)].filter(Boolean).join('; ');
}
export async function readSuiteCause(env: NodeJS.ProcessEnv): Promise<string> {
  if (!env.CLAND_SUITE_CAUSE_FILE) return '';
  return readSuiteCauseBounded(fs, env.CLAND_SUITE_CAUSE_FILE, SUITE_CAUSE_BYTES, SUITE_INFRASTRUCTURE_PREFIX);
}
