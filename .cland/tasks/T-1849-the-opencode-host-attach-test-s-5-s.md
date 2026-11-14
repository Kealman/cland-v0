---
id: T-1849
kind: task
title: The opencode host-attach test's 5 s close deadline fails under a loaded macOS full run
state: open
status: planned
size: XS
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: null
created: 2026-11-14T03:43:39.067Z
updated: 2026-11-14T03:51:36.082Z
---

## Summary

`hub/test/host-attach.test.ts` "opencode host attach uses private environment, refuses foreign records and exit preserves native identity" failed in the T-1846 + T-1847 local merge batch a52745fe (log A-19260, head ccb28cf45, darwin arm64, 1 worker, peak 1-minute load 5.07). The error was `Error: attach close incomplete; stderr:` (host-attach.test.ts:72, fired from a 5 s deadline). Alone, it passed 5/5 at 2026-11-14 03:43Z in 0.46–0.99 s each.

## What to build

The case's wait for the attach process to close uses `testWaitMs()` scaling, or a named bound sized for a loaded one-worker full T3 run. The behaviour it proves (private environment, refusal of foreign records, native identity preserved on exit) stays asserted exactly. If the close is slow because the product is slow under load, the item names that instead of widening the wait.

## Acceptance criteria

- [ ] C1. The attach-close wait in host-attach.test.ts no longer depends on a fixed 5 s real-time deadline, and an attach that never closes still fails the case (test).
- [ ] C2. The case passes five lone repetitions on macOS and the task's mode-free verify (test).

## Comments

### coord · 2026-11-14T03:51:36.082Z

Moved into R-1530 under the human's standing yes for test-defect items in the running release (2026-10-28): it reddened batch a52745fe alongside T-1846's case, and the stage-2 macOS cover rerun needs a quiet suite.
