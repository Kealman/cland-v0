// T1: counted hub replies and an injected clock/wait; no sockets or real sleeps.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SuiteSlotResult } from '../src/protocol.ts';
import { waitForHumanSlot } from '../src/suite-human-queue.ts';

test('a human waiter polls at most every two seconds and takes the next free slot', async () => {
  // Release just after/before/on poll boundaries, including a five-minute queue.
  for (const freedAt of [1, 1999, 2000, 2001, 3999, 300001]) {
    let now = 0;
    const requests: number[] = [];
    const request = async (): Promise<SuiteSlotResult> => {
      requests.push(now);
      assert.ok(requests.length <= 1300, 'bound the fake queue even if retries spin');
      return {
        id: 'human', admitted: now >= freedAt, locks: ['/fixture/hub-lock', '/fixture/nvim-lock'],
        queue: { version: 1, at: new Date(now).toISOString(), holder: null, waiters: [],
          metrics: { window: 20, count: 0, wait: { count: 0, medianMs: null, p90Ms: null },
            run: { count: 0, medianMs: null, p90Ms: null } } },
      };
    };
    const admitted = await waitForHumanSlot(await request(), {
      request, now: () => now, interrupted: () => false, report: () => {},
      wait: async ms => { now += ms; assert.ok(now <= 304000, 'bound simulated admission'); },
    });
    assert.equal(admitted.admitted, true, `slot freed at ${freedAt} ms`);
    assert.deepEqual(admitted.locks, ['/fixture/hub-lock', '/fixture/nvim-lock']);
    for (let i = 1; i < requests.length; i++) {
      assert.ok(requests[i]! - requests[i - 1]! >= 2000, `requests too close: ${requests[i - 1]}, ${requests[i]}`);
    }
    assert.ok(now - freedAt >= 0 && now - freedAt <= 2000, `admitted at ${now}; freed at ${freedAt}`);
  }
});
