---
id: T-696
kind: task
title: AccountPoller takes the hub Clock, and the five account files stop sleeping through real poll windows
state: open
status: planned
size: L
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-685
topic: null
branch: null
created: 2026-10-16T19:59:36.370Z
updated: 2026-10-16T20:00:52.493Z
---

## Summary

The account files spend most of their time waiting for real poll windows (memo §2.2 wins 1 and 6; report-slice1 #1 and #8, report-slice2 #4, report-slice4 #5):

- `claude-code-accounts.test.ts` (141.0 s): one test sleeps 3 × 30 s to prove nothing polled; another sleeps 2.3 s and four intervals as negatives.
- `account-limited.test.ts` (111.1 s): waits real 12–16 s poll minimums and asserts elapsed milliseconds.
- `account-poller.test.ts` (50.7 s): floors and backoff by `sleep(1.1 * minimumMs)`, `sleep(3200)` and interval deltas.
- `accounts.test.ts` (52.0 s): eight malformed-registry refusals, each through a live launch.
- `account-limits.test.ts` (23.9 s): reading order and coalescing, which are pure.

Size L because one seam, the clock in `hub/src/accounts/poller.ts`, and one fixture, `hub/test/account-fixture-env.ts`, serve all five files; split, the parts would serialize on both.

## What to build

- **The seam.** `AccountPoller` takes T-685's `Clock`, and `serveProject` passes the hub's.
- **The tests.** Eligibility, floors, minimums, backoff, the per-account latch and "newer push wins" are asserted by advancing a `FakeClock`, never by sleeping or comparing elapsed milliseconds. Registry parsing, the malformed-registry refusals, relative `XDG_CONFIG_HOME` and the null-account migration become T1 tests on the accounts module. The `account.clear` permission table runs through `decide()` with one frame proof. Reading order and coalescing are T1.
- **What stays real.** T3, each with a header: the process-group kill of a hung poll, one Codex and one OpenCode launch carrying the account's environment, one restart retention, and one end-to-end limit hit through a fake harness.

## Acceptance criteria

- [ ] C1. `AccountPoller` takes the hub `Clock`, proved by a T1 test that advances a `FakeClock` through a floor, a backoff and a latch with no real wait.
- [ ] C2. The five files' manifest seconds fall from 378.7 s (A-3877) to 170 s or less.
- [ ] C3. The five files hold no numeric sleep and no elapsed-milliseconds assertion except the reasoned ones in the T3 process-group kill test, proved by the test lint.
- [ ] C4. Their `startDaemon` call sites fall from 25 to 5 or less and fake-binary sites from 8 to 3 or less.
- [ ] C5. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C6. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-685 (hub Clock seam). Starts after T-575 merges (it touches the same five files).
