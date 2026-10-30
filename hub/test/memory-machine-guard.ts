/** Coordinator-granted quiet-slot policy, shared by preflight and both supervisors. */
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { remoteRedactor } from '../src/remote/redact.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { execFileSync } from 'node:child_process';
export type MachineReading = { load1: number; swapPercent: number; pressure?: number; pressureLevel?: number; freeMemoryPercent?: number; swapOuts?: number };
export function swapOutPages(text: string): number {
  const value = /^Swapouts:\s*(\d+)\.\s*$/m.exec(text);
  if (!value) throw new Error('unusable swap-out receipt');
  return Number(value[1]);
}
export function quietSlotPressure(text: string): { pressure: number; pressureLevel: number; freeMemoryPercent: number } {
  const rows = text.trim().split(/\s+/);
  if (rows.length !== 3 || rows.some(row => !/^\d+$/.test(row))) throw new Error('unusable native pressure receipt');
  const [pressure, pressureLevel, freeMemoryPercent] = rows.map(Number) as [number, number, number];
  if (![pressure, pressureLevel, freeMemoryPercent].every(Number.isFinite) || freeMemoryPercent > 100) throw new Error('unusable native pressure receipt');
  return { pressure, pressureLevel, freeMemoryPercent };
}
export function quietSlotReading(root: string): { pressure: number; pressureLevel: number; freeMemoryPercent: number; swapOuts: number } {
  const pressure = quietSlotPressure(execFileSync('/usr/sbin/sysctl', ['-n', 'vm.memory_pressure', 'kern.memorystatus_vm_pressure_level', 'kern.memorystatus_level'], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 2000 }));
  const swapOuts = swapOutPages(execFileSync('/usr/bin/vm_stat', [], { env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 2000 }));
  return { ...pressure, swapOuts };
}
export function quietSlotRefusal(reading: MachineReading, initialSwapOuts: number, until: number, now = Date.now()): string | null {
  if (now >= until) return 'quiet slot expired';
  if (!Number.isFinite(reading.load1)) return 'quiet slot load1 unavailable';
  if (reading.load1 > 6) return 'quiet slot load1 exceeds 6';
  if (typeof reading.pressureLevel !== 'number' || !Number.isFinite(reading.pressureLevel)) return 'quiet slot memory pressure unavailable';
  if (reading.pressureLevel > 1) return 'quiet slot native pressure level exceeds normal';
  if (typeof reading.swapOuts !== 'number' || !Number.isFinite(reading.swapOuts)) return 'quiet slot swap-outs unavailable';
  if (reading.swapOuts > initialSwapOuts) return 'quiet slot swap-outs started';
  return null;
}
export function memoryProbeRefusal(reading: MachineReading, baseline: number, until: number, during = false): string | null {
  if (until) return quietSlotRefusal(reading, baseline, until);
  if (!during && reading.load1 > 8) return 'load1 exceeds 8';
  if (reading.swapPercent > (during ? 90 : 80)) return `used swap exceeds ${during ? 90 : 80}%`;
  return null;
}

/** Persist the exact guard boundary before asking its owner to stop. */
export async function readGuardedMachine(root: string, source: string, read: () => MachineReading, baseline: number | undefined, until: number, stop: () => void, during = false): Promise<MachineReading | null> {
  let reading: MachineReading;
  try { reading = read(); }
  catch (error) {
    await appendFile(join(root, 'guard-stops.jsonl'), JSON.stringify({ time: Date.now(), source, ...machineReaderFailure(error) }) + '\n');
    stop(); return null;
  }
  const refusal = memoryProbeRefusal(reading, baseline ?? reading.swapOuts ?? 0, until, during);
  if (refusal) {
    await appendFile(join(root, 'guard-stops.jsonl'), JSON.stringify({ time: Date.now(), source, refusal, ...(refusal.includes('unavailable') ? { unavailable: refusal } : {}), ...reading }) + '\n');
    stop(); return null;
  }
  return reading;
}
export function machineReaderFailure(error: unknown) {
  const native = error as { status?: unknown; signal?: unknown; stderr?: unknown; message?: unknown } | null;
  const diagnostic = [native?.message, native?.stderr].filter(value => value !== undefined).map(String).join('\n');
  return { unavailable: 'machine reader failed or returned unusable facts', nativeCode: typeof native?.status === 'number' ? native.status : null,
    nativeSignal: typeof native?.signal === 'string' ? native.signal : null, diagnosticTail: remoteRedactor().text(diagnostic).slice(-1024) };
}
