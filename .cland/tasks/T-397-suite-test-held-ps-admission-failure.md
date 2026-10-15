---
id: T-397
kind: task
title: suite.test held-ps admission failure leaves its spoke alive and keeps the file running (cleanup hook ordering)
state: open
status: in progress
size: S
labels:
  - v0.1.2
  - hub
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
topic: topic-270
branch: t/T-397-suite-test-held-ps-admission-failure
created: 2026-10-14T12:31:34.692Z
updated: 2026-10-15T03:45:20.583Z
---

## Summary

The live held-ps admission case in `hub/test/suite.test.ts` (originally line 1083) failed in run 6a9dce81 and then kept its test file alive after all its cases finished. The file's runner and a child `cland-spoke` sat idle for 55 minutes. The suspected cause: the fixture registers `spoke.close` as a separate `t.after` after an ownership hook, so a failing ownership hook can skip the spoke's close.

## Evidence

- Run 6a9dce81 (T-359 at 0d6a85a7), log A-2347. The held-ps case failed after 2017 ms with an incomplete assertion stack, and the run then went silent after 1228 tests.
- At 12:21Z the Coordinator saw `node --test` (pid 48725, 0% CPU, 58 min) and its child `hub/bin/cland-spoke.ts` (pid 77520, the T-359 worktree, 55 min). No `ps -o` snapshot of the spoke's session or ownership was kept beyond that.
- A-2348 is impl-385's analysis. The attribution of pid 77520 to this fixture is a hypothesis, not proven.
- Run alone, both held-ps cases pass (2/2, 10 s).

## Acceptance criteria

- [ ] C1. The failing case's cause is reproduced (a forced ownership-hook failure or the original held-ps race), and the fixture closes every spoke and hub it opened even when an earlier cleanup hook throws.
- [ ] C2. A regression forces an ownership-hook failure and proves the file exits with no child processes left.
- [ ] C3. The held-ps case's own failure, the assertion that failed after 2017 ms, is diagnosed and fixed or shown to be the same cleanup race.
