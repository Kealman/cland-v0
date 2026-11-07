import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Decimal GB, shared by admission, wire receipts and SSH callers. */
export const MEMORY_FLOOR_BYTES = 1_300_000_000;
export type MemoryFloorDetails = { code: 'memory-floor'; availableBytes: number; floorBytes: number };
export class MemoryFloorRefusal extends Error implements MemoryFloorDetails {
  readonly code = 'memory-floor';
  readonly floorBytes = MEMORY_FLOOR_BYTES;
  readonly availableBytes: number;
  constructor(availableBytes: number) {
    super(`available memory ${availableBytes} bytes is below floor ${MEMORY_FLOOR_BYTES} bytes`);
    this.availableBytes = availableBytes;
  }
}
export function memoryFloorDetails(error: unknown): MemoryFloorDetails | undefined {
  const value = error as Partial<MemoryFloorDetails> | null;
  if (value?.code !== 'memory-floor' || !Number.isSafeInteger(value.availableBytes) || value.availableBytes! < 0 || value.floorBytes !== MEMORY_FLOOR_BYTES) return undefined;
  return { code: 'memory-floor', availableBytes: value.availableBytes!, floorBytes: value.floorBytes };
}
/** Override JSON is {availableBytes: nonnegative integer} in the fake host's boot-id directory (run directory when no boot file is supplied). */
export async function availableMemory(runDir: string, env: NodeJS.ProcessEnv): Promise<number | null> {
  if (env.CLAND_FAKE_HOSTS) {
    let override: string | undefined;
    try { override = await readFile(join(env.CLAND_HOST_BOOT_ID_FILE ? dirname(env.CLAND_HOST_BOOT_ID_FILE) : runDir, 'available-memory'), 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (override !== undefined) {
      let value: unknown;
      try { value = JSON.parse(override); } catch { throw new Error('invalid fake available-memory JSON'); }
      const bytes = (value as {availableBytes?:unknown} | null)?.availableBytes;
      if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error('invalid fake available-memory availableBytes');
      return bytes;
    }
  }
  if (process.platform !== 'linux') return null;
  const info = await readFile('/proc/meminfo', 'utf8');
  const kb = /^MemAvailable:\s+(\d+) kB/m.exec(info)?.[1];
  if (!kb) throw new Error('MemAvailable unavailable');
  return Number(kb) * 1024;
}
export async function requireSpawnMemory(runDir: string, env: NodeJS.ProcessEnv, reader = availableMemory): Promise<void> {
  const bytes = await reader(runDir, env);
  if (bytes !== null && bytes < MEMORY_FLOOR_BYTES) throw new MemoryFloorRefusal(bytes);
}
