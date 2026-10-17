---
id: T-706
kind: task
title: Production-length waits become test knobs, and perf cases, the full QA case set and harness self-tests move to T4
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: null
branch: t/T-706-production-length-waits-become-test
created: 2026-10-16T19:59:37.636Z
updated: 2026-10-17T06:27:35.769Z
---

## Summary

A few files hold the suite's longest fixed waits, load-dependent timing bounds and tests of the test harness itself, all on every run's critical path (memo §2.2 wins 3 and 11; report-slice3 #1, report-slice4 #6–#7, report-slice1 #2 and #6, report-slice3 #5, report-slice2 #5, #8 and anti-pattern H):

| File | Seconds | What holds the time |
|---|---:|---|
| `hook-bridge.test.ts` | 64.2 | waits the production 60 s reconnect grace |
| `startup-smoke.test.ts` | 24.1 | two meta-tests wait a hard-coded 10 s budget each |
| `orphan-servers.test.ts` | 111.5 | three-status and harness loops replay one fixture; `< 5000 ms` and `sleep(1300)` perf cases |
| `nvim/test/thread.test.ts` | 61.4 | a 47.8 s differential oracle over 4 seeds × 25 renders |
| `nvim/test/qa.test.ts` | 39.9 | the 24 shipped QA cases, each a full headless QA run |
| `suite-runner.test.ts` | 101.9 | hub/Neovim lock mirror ×7; four interruption outcomes each launching a hub and a fake |
| `durations-runner.test.ts` | 44.2 | seven rejection tests, one runner subprocess each |
| `remote-fixture-lifecycle.test.ts` | 52.3 | ten near-identical owner modes of the fixture's own cleanup |

T4 is the soak tier: it runs at occasions and nightly (E-678) and, until then, wherever T3 runs.

## What to build

- **Knobs.**
  - `CLAND_TEST_BRIDGE_GRACE_MS` sets the bridge grace (2 s in the test); a T1 test asserts the production constant is 60 000 ms. This replaces the measured-allowance decision recorded in `docs/agents/tests.md`.
  - `CLAND_TEST_SMOKE_BUDGET_MS` sets the smoke's readiness budget for the two planted-hang meta-tests.
- **Fewer cells.**
  - `orphan-servers` loops become one scenario with a row per status or harness.
  - The `suite-runner` lock matrix runs for `hub` plus one Neovim smoke; its interruption outcomes keep `failure` and `SIGKILL`.
  - The `durations-runner` rejections run as one fixture file with seven shapes.
  - `remote-fixture-lifecycle`'s ten modes become four (timeout, one plain signal, one watchdog signal, watchdog-teardown).
- **To T4.**
  - The `orphan-servers` perf cases move to an `orphan-servers-perf.test.ts` file.
  - The differential oracle runs 2 seeds × 12 steps (every phase and both widths) on the merge path, and 4 × 25 when `CLAND_TEST_SOAK=1`.
  - The 24 shipped QA cases go to T4; the runner-semantics tests stay T3.
  - `remote-fixture-lifecycle`, `project-hub`, `prepared-project` and `account-fixture-isolation` are harness self-tests, so they go to T4. A task diff that touches a `hub/test` fixture or harness module selects them.

## Acceptance criteria

- [ ] C1. The eight files' manifest seconds on the merge path (T1–T3) fall from 499.5 s (A-3877) to 220 s or less, with the moved parts tagged T4.
- [ ] C2. `hook-bridge.test.ts` still proves exit after the grace with no restart loop, under the knob, and a T1 test fixes the production grace at 60 000 ms.
- [ ] C3. With `CLAND_TEST_SOAK=1` the differential oracle runs 4 seeds × 25 renders, and without it 2 × 12, proved by a test of the seed plan.
- [ ] C4. A task diff touching `hub/test/remote-fixture.ts` selects the T4 harness self-tests, proved by a selection test.
- [ ] C5. An audit maps every moved or merged assertion to its new place and tier, with no behaviour claim dropped.
- [ ] C6. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify, the T4 files under `CLAND_TEST_SOAK=1`.
