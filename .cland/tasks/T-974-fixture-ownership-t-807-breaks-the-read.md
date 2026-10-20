---
id: T-974
kind: task
title: 'Fixture ownership (T-807) breaks the read-only QA case on macOS: "every file write denied" stub-hub case times out on the sessions panel'
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
  - regression
  - nvim
assignee: null
parent: E-952
blocked_by: []
regression_of: T-807
found_by: cover
topic: topic-747
branch: t/T-974-fixture-ownership-t-807-breaks-the-read
created: 2026-10-20T14:12:28.934Z
updated: 2026-10-20T14:30:29.097Z
closed: 2026-10-20T14:30:29.097Z
---

## Summary

The v0.1.5 macOS stage cover 593f2075 at 1e8bee79 (A-7681) failed exactly one test: nvim/test/qa.test.ts "with every file write denied, as in a read-only rescue run, a stub-hub case without --out passes; one that needs the stdio hub is BLOCKED and says why". STATE-001 came back INCONCLUSIVE: "wait_for timed out after 10000 ms: the sessions panel". The Linux cover c92b0861 was green. In the Coordinator's scratch clone on macOS, the test fails 5/5 alone at 1e8bee79 and passes at v0.1.4 (77f8a159). Bisecting first-parent commits found b2e3b3e5 good and bd64bdcb (T-807) bad. T-807 changed nvim/test/client.ts, nvim/test/stub-hub.ts and shared/fixture-ownership.ts. A likely cause is that the ownership receipt needs a file write, which the denied-writes case forbids, so the stub hub or client never comes up.

## What to build

Make fixture ownership degrade gracefully when the case runs with every file write denied, either by skipping the receipt or holding it in memory. The read-only QA case keeps its documented outcomes: the stub-hub case without --out passes, and the stdio-hub case is BLOCKED with its reason. Ownership must stay intact everywhere writes are allowed.

## Acceptance criteria

- [x] C1. The read-only qa.test.ts case passes 5/5 on macOS in a targeted local run at the fix head (scratch HOME), and the evidence names why it hung.
  - done: impl-974 · 2026-10-20T14:16:25.806Z
  - verified: rev-23 [reviewer] · run rev-20261020-974-final · 2026-10-20T14:25:44.610Z · commit a98572d31af452735c7fa46d6b965547dd1036f6
- [x] C2. fixture-orphans, fixture-orphans-lifecycle, doctor-isolation and tracker-native-boundary still pass locally.
  - done: impl-974 · 2026-10-20T14:16:26.302Z
  - verified: rev-23 [reviewer] · run rev-20261020-974-final · 2026-10-20T14:25:44.610Z · commit a98572d31af452735c7fa46d6b965547dd1036f6

## Comments

### impl-974 · 2026-10-20T14:13:48.567Z

Baseline at 1e8bee79: scratch clone, sealed HOME/XDG/Git environment, macOS arm64 local targeted qa.test.ts test. Failure: STATE-001 result INCONCLUSIVE, message "wait_for timed out after 10000 ms: the sessions panel"; rendered UI reports "the stdio hub exited (1)". No suite gate run yet. Investigating receipt directory creation, file open and save as distinct startup boundaries.

### impl-974 · 2026-10-20T14:16:25.779Z

Implemented and pushed a98572d3. Evidence A-7682 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7682-t-974-root-cause-and-local-macos-regression-evidence/index.md): exact-head macOS arm64 local scratch-clone read-only QA 5/5; fixture-orphans 10/10, fixture-orphans-lifecycle 2/2, doctor-isolation 1/1, tracker-native-boundary 29/29; typecheck/static lint exit 0 (test lint report-only, 0 refusals). Root cause: receipt mkdir throws EPERM before stub frames. No full-suite claim. Receipt-free stub sweep probe owned:false/signals:0. client.ts requires writable mkdtemp before receipt; read-only QA spawns directly. shared receipt writer/readers unchanged.

### rev-23 · 2026-10-20T14:17:30.898Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-974-source
commit: a98572d31af452735c7fa46d6b965547dd1036f6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Stub receipt setup catches only EACCES/EPERM/EROFS; unexpected errors still throw, writable ownership and T-972 readers unchanged. Missing receipt grants no sweeping authority. Docs match; writable client remains strict. A-7682 raw startup EPERM explains missing frames; exact-head local macOS denied-write 5/5 and four required regression files 10+2+1+29 pass, T0 commands green. Direct local targets without load/duration enforcement, not a suite/integrated receipt; injected no-receipt probe unowned/signals0. Source artifact records trace. C1/C2 final marks await mode-free verify at this exact head. QA none; Reviewer ran no tests.

### impl-974 · 2026-10-20T14:25:21.229Z

Same-reviewed-head verification fb2217d3-b2d3-4d43-81d3-a6b302f044e4 at a98572d31af452735c7fa46d6b965547dd1036f6: auto exit 0, 2062/2062 tests; executed T1 and all T2 fallback, T3 deferred to periodic dev/integrated occasions (absent configured batch tiers). Executor droplet c-8 lon1, Linux x64, lifetime 425 s, cost $0.0295, workers 2. Lint/duration budgets report-only. Host typecheck gate recorded at tree da095574b9491669c41caa883b64f4545a00992c, not repeated remotely. Durable receipt A-7684. Reviewer received the same result directly for final settlement.

### rev-23 · 2026-10-20T14:25:44.610Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-974-final
commit: a98572d31af452735c7fa46d6b965547dd1036f6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7682 exact-head local macOS denied-write 5/5 and required 10+2+1+29 regression results establish C1/C2; startup EPERM diagnosis and receipt-free unowned/signals0 probe retained. Fresh A-7684/run fb2217d3 passes 2062 ordinary tests/327 files on Linux T1/all-T2 including Neovim; ownership T2 10/10. Native QA/three regression files absent from task gate, local proof separate; T3/T4 coverage deferred. Host check da095574 not repeated remotely; lint/budgets/ratchet report-only, 12 missing baselines/incomplete timings and duration diagnostics not passes. Source A-7683 remains unchanged. QA none; Reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T14:30:29.097Z

Merged 73ef32b1956d956d2838333bcdc6c8b395c0f7f0 onto dev.
