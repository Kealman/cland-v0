---
id: T-385
kind: task
title: "A hung test holds the verify queue forever: no per-test timeout and no stall kill"
state: open
status: in progress
size: S
criterion_seq: 4
labels:
  - v0.1.2
  - hub
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
topic: topic-246
branch: t/T-385-a-hung-test-holds-the-verify-queue
created: 2026-10-14T12:21:44.443Z
updated: 2026-10-14T12:48:02.800Z
---

## Summary

A full verify can hang forever. T-359's run 6a9dce81 stopped producing output after 1228 tests: the `node --test` runner and a child `cland-spoke` sat at 0% CPU for over 55 minutes while four runs queued behind it. The runner has no per-test timeout, and the suite has no wall-clock cap that kills a silent run.

## Evidence

- Run 6a9dce81 (T-359 at its head, full mode), started at 11:12Z. `suite.log` stopped growing at 11:27Z, and the human noticed at 12:21Z.
- Processes at 12:21Z: suite-worker pid 81684 at 69 min, `node --test --test-concurrency=4` pid 48725 at 58 min and 0% CPU, child `cland-spoke.ts` pid 77520 at 55 min. Machine load about 2.
- The last started tests in the log were merge-gate cases ("a verdict whose session changes role…", "release, topic closure and cleanup failures…", "retrying a completed merge preserves staged deletion…").
- Cost: about one hour of the single local slot, with four Implementers waiting.

## Acceptance criteria

- [x] C1. Every test file runs with a per-test timeout, for example `--test-timeout` set from a duration manifest or a default of 120 s, so a hung test fails with its name instead of blocking.
  - done: impl-385 · 2026-10-14T12:35:29.096Z
- [ ] C2. The suite worker kills a run whose log has been silent for longer than a configured stall limit (default 10 min). The result reads `stalled: no output for <n> min` and names the last started tests. The process tree, test children and spokes included, is reaped.
  - failed: rev-23 [reviewer] · 2026-10-14T12:48:02.800Z · note If npm exits while a child retains inherited pipes, stall cleanup treats the absent leader as reaped and can report/release admission with that orphan still alive.
- [x] C3. A test reproduces a hung test file and shows the timeout failure, and another shows the stall kill and cleanup with no orphan processes left.
  - done: impl-385 · 2026-10-14T12:41:20.416Z
- [x] C4. The hanging test from run 6a9dce81 is identified from its log and fixed, or filed separately with evidence.
  - done: impl-385 · 2026-10-14T12:32:34.448Z

## Comments

### impl-385 · 2026-10-14T12:34:30.789Z

Implemented default/configurable 120s per-test timeout and 10m silent-command guard in the local suite worker. Protocol regressions reproduced the missing timeout and missing stall result before changes, then passed with named failures, removal of test/spoke/detached TERM-resistant child, and successor admission. C4 filed separately as T-397; original held-ps cases pass isolated, attribution/root cause remains unproven. Validating all touched test files and cancellation compatibility before source review.

### impl-385 · 2026-10-14T12:44:09.790Z

Source ready at pushed 96ec6543db68c02b577850364b1fcfe2f85713fe. Complete touched suite.test 65/65 (A-2361), final strengthened stall/output checks 2/2 (A-2366), suite-runner 50/50, root typecheck (A-2367), and diff check pass. C1–C4 done; original incident investigated separately as T-397. Fetched origin/dev; its delta is tracker-only e0cecd00, so no dependency/conflict merge under the latest build rule. Requesting source review before queued verification; qaPolicy none.

### rev-23 · 2026-10-14T12:48:02.800Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-1
commit: 96ec6543db68c02b577850364b1fcfe2f85713fe
scope: full

Medium — hub/src/suite-command.ts:27–29: stall cleanup captures only the npm identity at timeout; if npm has exited while a background child keeps pipes open, endProcess's absent-leader path returns true without capturing/reaping that child. Destroying pipes then completes the supervisor and releases admission despite the orphan. Custom commands without package root/runner metadata are not covered by the later lease sweep. Retain verified child ownership and add a real-frame exited-parent/inherited-pipe regression. All nine changed files reviewed; no additional findings in timeout policy, partial-output, ordinary held-parent cleanup, cancellation or C4's T-397 filing. No suite yet. A-2372: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2372-t-385-source-review-exited-parent-can-leave-inherited-pipe-orphan.md.

Criteria: C2 failed (If npm exits while a child retains inherited pipes, stall cleanup treats the absent leader as reaped and can report/release admission with that orphan still alive.).
