---
id: T-1852
kind: task
title: The suite-timeouts inherited-pipe case still routes the hub's admission probes through its ps wrapper
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
regression_of: T-1851
topic: null
branch: null
created: 2026-11-14T05:51:47.424Z
updated: 2026-11-14T05:52:16.838Z
---

## Summary

`hub/test/suite-timeouts.test.ts` "verify reaps fast-exit inherited-pipe writers and preserves unrelated processes" (line 237) still installs its `ps` wrapper on the whole fixture hub PATH and waits on the periodic snapshot, the defect T-1851 removed only from the sibling case at line 340. It failed in the T-1849 + T-1851 local batch 6fe26f5d (A-19286, head ba94089e5, 1 worker): "fast pipe holder started after snapshot: not within 15000 ms" at :275 (18.7 s). The repaired sibling passed in the same run (8.2 s). The hub later ruled the failure flaky after green reruns, and the batch landed.

## What to build

Apply T-1851's repair to every case in suite-timeouts.test.ts that installs the `ps` wrapper or waits for "fast pipe holder started after snapshot". The hub and worker launch with the native `ps`; the deny-census preload redirects the worker's `ps` to the wrapper only after the fixture's armed receipt exists; the parent's explicit snapshot uses the wrapper's absolute path. Each case keeps its product assertions and gains the bounded failure-only diagnostics T-1846 added.

## Acceptance criteria

- [ ] C1. Each affected case passes under a 3500 ms pre-arm delay on non-self `ps` probes, and the same delay applied to its previous global-PATH setup reproduces the unpublished-gate failure (test).
- [ ] C2. Every affected case passes five lone repetitions and one paired run on macOS, plus the task's mode-free verify, with its product assertions retained (test).
