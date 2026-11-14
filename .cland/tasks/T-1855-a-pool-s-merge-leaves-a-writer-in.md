---
id: T-1855
kind: task
title: A pool's merge leaves a writer in territory.git at teardown (ENOTEMPTY in session-native-lifecycle)
state: open
status: planned
size: S
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: null
created: 2026-11-14T09:54:49.415Z
updated: 2026-11-14T09:56:25.335Z
---

## Summary

`hub/test/session-native-lifecycle.test.ts` "an Implementer pool moves to the next task worktree after merge (opencode, keep_context=true)" failed in the E-1537 stage-2 macOS cover 4a852872 at dev 5757ea8dd (log A-19327, darwin arm64, 1 worker, peak 1-minute load 8.43) during fixture teardown: `ENOTEMPTY: directory not empty, rmdir '/private/tmp/cland-suite-…/cland-proj-…/.cland/territory.git'` (4.8 s). Something still wrote into the fixture's territory repository while the root was removed: a git process from the merge, a hub-owned writer, or a child not yet joined.

## What to build

Find which process writes into territory.git after the case's assertions complete. The candidates are the merge's git processes, the territory sync, a spoke, or the opencode fake. Then make teardown join it first, through the existing process-cleanup ownership, rather than retrying the rmdir. If a product component keeps writing after the hub reports the merge complete, name it as a product finding.

## Acceptance criteria

- [ ] C1. The writer still active at teardown is named on this item, and teardown joins it before removing the fixture root; a forced delayed writer reproduces the ENOTEMPTY failure before the fix and passes after it (test).
- [ ] C2. The case passes five lone repetitions and one paired run on macOS, plus the task's mode-free verify (test).

## Comments

### coord · 2026-11-14T09:56:25.335Z

Moved into R-1530 by ask d641172c (human, 2026-11-14 09:56Z): fix before rerunning the E-1537 stage-2 cover pair on a new tip.
