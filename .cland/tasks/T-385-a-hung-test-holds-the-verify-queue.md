---
id: T-385
kind: task
title: "A hung test holds the verify queue forever: no per-test timeout and no stall kill"
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
topic: topic-246
branch: t/T-385-a-hung-test-holds-the-verify-queue
created: 2026-10-14T12:21:44.443Z
updated: 2026-10-14T12:22:43.355Z
---

## Summary

A full verify can hang forever. T-359's run 6a9dce81 stopped producing output after 1228 tests: the `node --test` runner and a child `cland-spoke` sat at 0% CPU for over 55 minutes while four runs queued behind it. The runner has no per-test timeout, and the suite has no wall-clock cap that kills a silent run.

## Evidence

- Run 6a9dce81 (T-359 at its head, full mode), started at 11:12Z. `suite.log` stopped growing at 11:27Z, and the human noticed at 12:21Z.
- Processes at 12:21Z: suite-worker pid 81684 at 69 min, `node --test --test-concurrency=4` pid 48725 at 58 min and 0% CPU, child `cland-spoke.ts` pid 77520 at 55 min. Machine load about 2.
- The last started tests in the log were merge-gate cases ("a verdict whose session changes role…", "release, topic closure and cleanup failures…", "retrying a completed merge preserves staged deletion…").
- Cost: about one hour of the single local slot, with four Implementers waiting.

## Acceptance criteria

- [ ] C1. Every test file runs with a per-test timeout, for example `--test-timeout` set from a duration manifest or a default of 120 s, so a hung test fails with its name instead of blocking.
- [ ] C2. The suite worker kills a run whose log has been silent for longer than a configured stall limit (default 10 min). The result reads `stalled: no output for <n> min` and names the last started tests. The process tree, test children and spokes included, is reaped.
- [ ] C3. A test reproduces a hung test file and shows the timeout failure, and another shows the stall kill and cleanup with no orphan processes left.
- [ ] C4. The hanging test from run 6a9dce81 is identified from its log and fixed, or filed separately with evidence.
