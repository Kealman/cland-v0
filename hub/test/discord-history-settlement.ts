import type { Clock } from '../src/hub/clock.ts';
import { testWaitMs, until } from './until.ts';

// Observation headroom per forwarded input, not a product latency assertion.
const HISTORY_OBSERVATION_MS_PER_INPUT = 100;

export function waitForDiscordHistorySettlement(
  receipt: () => { inputs: number; overflowSent: boolean },
  expectedInputs: number,
  clock?: Clock,
): Promise<void> {
  return until(() => {
    const observed = receipt();
    return observed.inputs === expectedInputs && observed.overflowSent;
  }, {
    what: `${expectedInputs} inputs and overflow settlement`,
    timeoutMs: testWaitMs(expectedInputs * HISTORY_OBSERVATION_MS_PER_INPUT), ...(clock ? { clock } : {}),
  });
}
