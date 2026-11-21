import type { TestTiming, DurationManifest } from './suite-durations.ts';

/** One measured allowance format for reporting and enqueue refusal. */
export function measuredDurationAllowance(test: TestTiming, label: string, owner: string, now: number): DurationManifest['allow'][string] {
  return { seconds: Math.ceil(test.seconds * 1500) / 1000, owner,
    added: new Date(now).toISOString().slice(0, 10), expires: new Date(now + 7 * 86400000).toISOString().slice(0, 10),
    reason: `${label} measured peak ${Number(test.seconds.toFixed(3))} s; 1.5x headroom for ${test.file.split('/').at(-1)}: ${test.name}.` };
}
