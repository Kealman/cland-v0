import type { Tracker } from '../src/tracker/tracker.ts';
import type { VerifyResult } from '../src/hub/suites.ts';
import type { Clock } from '../src/hub/clock.ts';

/** Each fixture admits a completed receipt explicitly; moving a head never manufactures a pass. */
export function readyVerificationFixture(tracker: Tracker, clock: Clock) {
  const receipts = new Map<string, VerifyResult>();
  // Keep the dispatcher's configured requirement and integrated stage-cover producer.
  tracker.useVerify(item => receipts.get(item) ?? null);
  return (item: string, branch: string, head: string) => {
    receipts.set(item, { id: `fixture-ready:${item}:${head}`, executor: 'local', state: 'finished',
      result: 'passed', head, finished: clock.now().toISOString(), artifact: null });
    tracker.verifyChanged(item, branch);
  };
}
