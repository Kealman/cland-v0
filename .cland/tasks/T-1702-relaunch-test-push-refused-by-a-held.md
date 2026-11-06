---
id: T-1702
kind: task
title: Relaunch test push refused by a held territory lock, with an old-host ref-watch producer result missing at cleanup (one Linux batch occurrence)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1614
found_by: droplet
topic: null
branch: null
created: 2026-11-06T01:44:41.119Z
updated: 2026-11-06T01:44:41.119Z
---

## Summary

T-1698's merge batch 16d0ab14 (A-17000/A-17001, Linux x64 droplet, peak load 6.4, tree dev df397e2e + T-1698 0245e5c4) failed `hub/test/host-relaunch.test.ts` "C2/C3 admitted host relaunch running keeps durable native and checkout ownership" (37.3 s). The primary assertion (A-17000:17979–17990) was the f2 push: `git -c gc.auto=0 push origin HEAD:refs/heads/t/T-1-relaunch` → `fatal: remote error: cland: host f2: push retry required: another territory operation holds the lock (pid 74173)`, exit 128. The secondary error, at fixture cleanup (A-17001:11150), was `watch …/f1/…/.cland/worktrees/T-1: producer result missing; native cleanup retained`.

impl-1698 then ran a differential matrix (A-17002) and found no failure: clean dev df397e2e had 10/10 macOS and 5/5 Linux `docker run --init` runs green, and the merged T-1698 head 83a11438 had the same. The lock holder can't be attributed: the project hub and both git daemons share the test-process pid, and the fixture's daemon `log` callbacks are discarded.

Suspected chain (unproven): after the lease moves to f2, f1's agent-owned ref-watch producer is still pushing, or retrying, against the territory. It holds the lock when f2's push arrives. `RefWatches.#settle` may then stop it at 30 s before its result checkpoint, which is written only after git closes.

## What to build

1. Make the fixture keep git-daemon and territory-lock events, naming the operation and the pid, so that a recurrence is attributable.
2. Reproduce under load and name the holder.
3. Decide whether a relaunch reported running may leave an old-host producer pushing.
4. Decide whether a user push should wait, with a bound, for a held territory lock rather than refuse.

## Acceptance criteria

- [ ] C1. The territory-lock holder at the f2 push refusal is named, from a trace or a deterministic reproduction.
- [ ] C2. Either the product no longer refuses or races in that order, or a documented decision keeps the refusal, and the test meets the documented retry contract with fences and assertions otherwise unchanged.
