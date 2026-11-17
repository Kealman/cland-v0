---
id: T-1937
kind: task
title: suite-timeouts "verify kills a silent test tree and spoke" races its 1.5 s startup watchdog against the silence watchdog under load
state: open
status: backlog
size: S
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-17T07:35:36.084Z
updated: 2026-11-17T07:35:36.084Z
---

## Summary

Periodic dev T3 249ae076 at 04d1f6a0f (A-20741, Linux droplet c-8 ams3, peak 1-minute load 6.32) failed only `hub/test/suite-timeouts.test.ts::verify kills a silent test tree and spoke, names the last started test and frees admission`. The test expects the silence watchdog's message (`/stalled: no output for 0\.05 min/`). The startup watchdog fired first instead: "stalled: silent.test.mjs no test started within 1.5 s; command exit pending". The fixture's first test started too late under load, so the run's outcome depends on which watchdog wins. The same log shows "preserved pid 232419: ambiguous ownership" for the spoke.

## Evidence

- A-20741 lines 34830 onward hold the literal AssertionError and the full received summary.
- Coordinator, macOS arm64, Node 24.21.0, the whole file alone five times at 04d1f6a0f: 19/19 each run, starting loads 3.43–4.40.
- impl-1848 ran the file 19/19 locally at its merged head earlier today.

## What to build

Make the case deterministic. Either have the fixture's test start be observed before the silence window begins, or give the startup budget a fixture value well above the silence budget, so only the silence watchdog can fire. Then assert the silence outcome. Keep the existing kill, name and admission-release assertions.

## Acceptance criteria

- [ ] C1. The case cannot be decided by the startup watchdog: a test with a delayed first test start (fake or held) still reports the silence stall (test).
- [ ] C2. 20/20 runs of the file under the T3 runner at a 1-minute load of at least 8 pass, with the load recorded per run (native slot).
