---
id: T-1851
kind: task
title: The suite-timeouts fast-exit fixture's ps wrapper intercepts the hub's own admission probes
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
regression_of: T-1846
topic: null
branch: null
created: 2026-11-14T03:50:52.949Z
updated: 2026-11-14T03:50:52.949Z
---

## Summary

`hub/test/suite-timeouts.test.ts` "verify reports unverified fast-exit pipe cleanup once…" installs its `ps` wrapper on the entire fixture hub's PATH. The wrapper therefore also intercepts the hub's own admission identity probes (`LocalExecutor.#start`, hub/src/executor/local.ts:96–102). When the wrapper is slow before the fixture is armed, admission fails with "cannot establish suite worker process identity", no gate is written, and the worker reports its gate deadline. T-1846 landed a snapshot-ordering repair and permanent failure diagnostics. The diagnostics then showed this cause in batch a52745fe (A-19260: armed missing, snapshotPublished false).

## Evidence

A controlled reproduction by T-1846's implementer (2026-11-14 03:48Z), with a 3500 ms delay on non-self `ps` probes before arming:
- old global-PATH setup: the case failed after 19.3 s, with admission outcome "cannot establish suite worker process identity" and the gate unpublished;
- narrowed setup: the case passed in 10.4 s, with native close 0 and no pre-arm wrapper receipt.

## What to build

The hub and worker launch with the native `ps` on PATH. The deny-census preload redirects the worker's `ps` to the wrapper only after the fixture's armed receipt exists. The parent's explicit snapshot uses the wrapper's absolute path. Every assertion of the case (unverified cleanup reported once, unrelated processes preserved, successor admitted, denied census, real reparent, ownership and mute) stays driven by the product's own observation.

## Acceptance criteria

- [ ] C1. With a 3500 ms pre-arm delay on non-self `ps` probes, the case passes, and the same delay applied to the previous global-PATH setup reproduces the unpublished-gate failure (test).
- [ ] C2. The case passes five lone repetitions and one paired run on macOS, plus the task's mode-free verify, with every product assertion retained (test).
