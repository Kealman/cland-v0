---
id: T-1179
kind: task
title: Fixture worker lifecycle test fails in every local macOS integrated run since T-971
state: open
status: planned
size: S
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
regression_of: T-971
topic: null
branch: null
created: 2026-10-23T10:48:52.977Z
updated: 2026-10-23T11:13:12.070Z
---

## Summary

Since T-971 (2cd84fb8) gave the worker in hub/test/fixture-worker-lifecycle.test.ts `env: fixtureEnvironment(container, process.env)`, its test "SIGTERM of a fixture worker reaps its detached hub before removing the temp project" fails in every local macOS integrated run. Both E-417 stage-4 macOS covers at dev e2721ab5 failed it: adfc08f3 (A-9978, 10:48Z) and the retry 32d70fac (A-9986, 11:11Z). Each failed at about 5.1 s with `AbortError`/`TimeoutError` from the parent's `once(worker, 'message', { signal: AbortSignal.timeout(5000) })`. The last macOS cover before T-971 (eb92db13 at f2899a3e, A-9897) passed it in 1.07 s. The droplet runs (Linux stage cover f994fd78, periodic dev T3 at 8614eb64) pass it, and alone on macOS with no integrated run active it passed 5 of 5 at about 1.0 s. That pattern suggests the sealed worker loses something the integrated local run supplies; the prime suspect is the suite lease or admission controls that `runnerFixtureEnvironment` keeps and `fixtureEnvironment` drops. While a local cover holds the slot, the worker's test or fixture hub then waits or refuses instead of starting. This is unconfirmed: find the actual cause.

## What to build

Find why the worker never reports ready during a local integrated run, and fix the test's environment so the worker stays sealed (rule 15) but keeps what a runner child needs, without weakening the T-962 sealed child-launch guard. If the ready wait also needs more headroom, give it a bound that covers the worker's own startup and discovery waits, with the reason in a comment.

## Acceptance criteria

- [ ] C1. The cause is named in this item with evidence: a reproduction of the failure while a local integrated run, or an equivalent held suite slot, is active (test).
- [ ] C2. The test passes inside a local macOS integrated run, shown by a mode-free `cland verify --executor local` or by the documented reproduction going green, and still passes alone 5 of 5 (test).
- [ ] C3. The worker launch still satisfies the T-962/T-971 sealed child-launch guard, whose T0 guard tests pass (test).
