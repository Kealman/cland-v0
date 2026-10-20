---
id: T-972
kind: task
title: Fixture ownership (T-807) puts a synchronous native call on the tracker's worktree and merge paths (macOS tracker-native-boundary red)
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
  - regression
assignee: null
parent: E-952
blocked_by: []
regression_of: T-807
found_by: cover
topic: topic-746
branch: t/T-972-fixture-ownership-t-807-puts-a
created: 2026-10-20T13:29:18.523Z
updated: 2026-10-20T13:48:33.506Z
closed: 2026-10-20T13:48:33.506Z
---

## Summary

The v0.1.5 macOS stage cover dfddcdd7 (A-7659) failed tracker-native-boundary.test.ts "worktree claim, listing and prune cross no synchronous native boundary" and "merge refusal, landing and recovery cross no synchronous native boundary" ("no synchronous native call, even when its error was caught"; actual non-empty). The Coordinator's local runs on macOS give b2e3b3e5 green and bd64bdcb (T-807) red. The Linux cover passed these tests.

## What to build

Find the synchronous native call that T-807's fixture-ownership code (and T-965's follow-up, if any) puts on the worktree claim/list/prune and merge paths. Make it asynchronous, or keep it off those paths, so the native-boundary guard holds on both platforms.

## Acceptance criteria

- [x] C1. tracker-native-boundary.test.ts passes on macOS in a targeted local run at the fix head, and the evidence names the call that was synchronous.
  - done: impl-972 · 2026-10-20T13:34:37.395Z
  - verified: rev-23 [reviewer] · run rev-20261020-972-final · 2026-10-20T13:42:41.287Z · commit a19f90fb1b6b969170ee05188563b49fae15a844

## Comments

### impl-972 · 2026-10-20T13:33:53.126Z

Implemented async receipt inspection/removal and legacy hint canonicalization. Red reproduced on macOS in both original tracker guards (realpathSync); a new component guard first failed because caught synchronous reader errors lost positive ownership, and now asserts owned fixture completion plus receipt removal. Source changes are limited to fixture receipt reading, fixture process cleanup, and their component/lifecycle tests. No sealed child-launch changes.

### rev-23 · 2026-10-20T13:35:33.463Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-972-source
commit: a19f90fb1b6b969170ee05188563b49fae15a844
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Async receipt inspection/removal eliminates realpathSync on guarded worktree/merge cleanup; all reader callers await it. Private owner/mode/no-follow/size checks, PID/birth/same-user authority and signal/removal safeguards remain. New T2 positive-receipt regression asserts actual cleanup and deletion under synchronous-FS guard; original lifecycle descriptor checks retained. A-7662 exact-head local macOS tracker-native-boundary 29/29 supplies C1 target; A-7663 diagnosis identifies realpathSync and labels supplemental targets. Direct local, no load/duration instrumentation, not a Linux/integrated receipt. Source artifact records trace; C1 final mark awaits mode-free exact-head gate. QA none; Reviewer ran no tests.

### impl-972 · 2026-10-20T13:42:18.631Z

Same-head verification 4bb66183-8c1f-4175-9c61-0fc711d81af9 passed at a19f90fb1b6b969170ee05188563b49fae15a844: 2064/2064, no failures/skips. Linux x64 droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5; lifetime 351 s, cost $0.0244. T1 and fallback all T2 completed; T3 deferred to periodic dev/integrated occasions. Duration budgets and lint diagnostics report-only. Typecheck was host-gate reuse at 5df40e990f07186e62382f2e3eb56ee69fa876a7, not repeated by remote run. Log A-7667. Awaiting Reviewer final settlement at unchanged head.

### rev-23 · 2026-10-20T13:42:41.287Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-972-final
commit: a19f90fb1b6b969170ee05188563b49fae15a844
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. C1 exact-head local macOS tracker-native-boundary 29/29 in A-7662 and realpathSync diagnosis in A-7663 established; A-7664 source audit preserves receipt authority. Fresh A-7667/run 4bb66183 passes 2064 ordinary tests/328 files on Linux T1/all-T2 including Neovim. Ownership T2 10/10, new positive-receipt no-sync case 5/5 load repetitions. Native tracker/lifecycle files absent from this gate; local targets separate and T3/T4 coverage deferred. Host check 5df40e99 not repeated; lint/budgets/ratchet report-only, 13 missing baselines/incomplete timings not passes. QA none; Reviewer ran no tests.

Criteria: C1 verified.

### coord · 2026-10-20T13:48:33.506Z

Merged 5edaaa150d9165028082787d44f14c3d44a6ac88 onto dev.
