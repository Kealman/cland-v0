---
id: T-810
kind: task
title: "worktree-cli.test.ts hangs intermittently: four full runs today stalled with it as the last started file"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-515
branch: t/T-810-worktree-cli-test-ts-hangs
created: 2026-10-18T16:14:16.762Z
updated: 2026-10-18T16:45:15.138Z
---

## Summary

Four full runs today ended in a machine-phase stall or a 75 min timeout with hub/test/worktree-cli.test.ts as the last file started: T-759 7efa2911 (A-5076), T-709 2119e998 (A-5221) and T-645 2b7bf0f0 (A-5301), all on droplets, and E-678's macOS stage run b50559f3 (A-5411, "stalled: no output for 10 min", the last starts being all four worktree-cli cases). The file runs last in the alphabetical machine order, so earlier this looked like run order. But b50559f3's stall detector shows nothing completing for 10 min after its four cases started, which points at the file itself. Its cases start a parent hub and child projects, stop through stale discovery and select hubs by CLAND_HUB_FILE. A wait on a hub that never answers, or a stop that never returns, would hang without a deadline.

## Acceptance criteria

- [x] C1. The hanging case and its cause are named, from a reproduction (loop the file 50× on macOS and Linux) or from T-799's hung-test receipt.
  - done: impl-810 · 2026-10-18T16:45:04.062Z
- [ ] C2. Every wait in the file has a bounded deadline that fails naming the case, the cause is fixed with every assertion kept, and the file passes 50/50 serially on macOS plus a green droplet verify on Linux.

## Comments

### impl-810 · 2026-10-18T16:18:19.711Z

Baseline reproduction underway: 16 serial macOS passes under an external 180 s hard watchdog. No confirmed hang. T-799 lead reports no historical active-case/await evidence; A-5411 has declaration-ordered starts too. Coordinator decision cad64964 accepts C1 as not reproduced in 50 macOS runs if all stay green, with original attribution explicitly open; C2 will deliver named case/operation deadlines plus 50/50 fixed runs and a green Linux droplet verify.

### impl-810 · 2026-10-18T16:33:23.423Z

Cause found during serial baseline attempts 45/46: first routing case completed body in ~2 s then waited ~120 s in hub teardown. startFreshnessDaemon used bare serveProject without isolated env, inheriting the real provider token and global executor ledger; startup sweep(true) contended on shared state, and Dispatcher.close awaits that startup recovery. Coordinator confirmed concurrent serving-hub/verification ledger contention (T-813), then ordered loop stop. Controller/runner/worker pids 54592, 94843, 94844 were killed and observed gone; 46 baseline attempts completed, attempt 47 interrupted by instruction. Fix replaces routing fixture with projectHub, adds named operation/teardown deadlines, and sanitizes shared worker/CLI executor env. Hostile inherited-token/state regression red before startup then green. 50 patched macOS attempts underway; verify held by Coordinator.
