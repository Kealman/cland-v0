---
id: T-527
kind: task
title: "territory-lock test: a fixed 100 ms sleep races the first lock holder (Linux)"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-334
branch: t/T-527-territory-lock-test-a-fixed-100-ms-sleep
created: 2026-10-15T19:50:59.979Z
updated: 2026-10-15T23:32:46.062Z
---

## Problem

`hub/test/territory-lock.test.ts:41–42` sleeps a fixed 100 ms before its lock assertions. On Linux under load it saw 'could not take guard' where 'another territory operation holds the lock' was expected, in T-502's droplet verify f23a4f38 (A-3310:4128–4151). The fixed sleep races the first holder taking the lock.

## Acceptance criteria

- [x] C1. The case observes the first holder actually holding the lock (a file or receipt signal) instead of sleeping 100 ms, then asserts the second operation's refusal message. Every assertion stays.
  - done: impl-527 · 2026-10-15T23:31:58.794Z
  - verified: rev-30 [reviewer] · run rev-20261015-527-source · 2026-10-15T23:32:46.061Z · commit d2d184f52a1f94eb5ac83bd68174f5194f9af6d8
- [ ] C2. territory-lock.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-527 · 2026-10-15T22:29:13.087Z

Read T-527, E-482 decisions and R-294/spec. Implementing a first-holder acquisition receipt in the existing territory-lock test; all refusal, completion, stale-recovery and rejection assertions stay. Mac baseline is waiting for the single-file test window (load 3.74; another test was detected).

### impl-527 · 2026-10-15T23:31:53.698Z

Implementation cc400e87 replaces the fixed sleep with a bounded callback-entry receipt and preserves all assertions; finally releases/awaits the holder on failures. Five serial quiet Mac whole-file passes: 85/85, 0 failures/skips, all exit 0; A-3459 contains all five logs and per-pass admission loads (3.04–3.92, local none/pgrep free). Before first review merged origin/dev without conflicts and pushed d2d184f52a1f94eb5ac83bd68174f5194f9af6d8; task diff remains only territory-lock.test.ts. Typecheck green on that merged head. No QA required by policy. Linux evidence awaits source review.

### rev-30 · 2026-10-15T23:32:46.062Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-527-source
commit: d2d184f52a1f94eb5ac83bd68174f5194f9af6d8
scope: full

Source review T-527 clear at d2d184f52a1f94eb5ac83bd68174f5194f9af6d8, merged pre-review dev c015fbe3302a6e393905c5ca3cab845f771043ee. Standards and Spec reviewed directly under the no-delegation role. No high, medium or low findings.

C1 verified: the fixed 100ms acquisition sleep is replaced by a bounded eventually observation of callback entry. Immutable withTerritoryLockAsync (territory.ts:73–88) awaits acquireLockAsync before invoking its operation through withCleanupAsync. Thus entered=true proves first acquisition completed; the callback then awaits the unresolved pending promise, keeping the lock held while BOTH synchronous and async second-operation refusal assertions run. Finally resolves the holder and awaits first before subsequent completion/stale/rejection checks and fixture teardown. Every one of the file's57 assertion lines is preserved (indentation normalized), including exact refusal message, completion value, reverse exclusion, stale recovery and primary rejection identity. No production implementation or deadline change.

Standards: first-holder state comes from the public operation callback, not internal lock mutation or elapsed time. Cleanup follows release→join with concurrency assertions before release. No new test identity, environment mutation, shared fixture or manifest change. Own diff against the merged dev parent is one test file,12 additions/7 deletions. Whitespace check clear; merged-head typecheck reported green.

C2 remains UNVERIFIED pending the actual droplet file pass and acceptable overall task gate. Mac portion is established by A-3459's five full serial quiet file passes at cc400e875b9a0d3f66f123fcc673128b081f7d86:17/17 each,85 total, zero failures/cancellations/skips, full durations3.563/2.673/2.014/2.097/1.671s. Admission local:none/free and load3.92/3.35/3.24/3.05/3.04 are disclosed. The territory-lock.test.ts Git blob is byte-identical at that evidence head and the requested merged head (da03d09a55854b36faf0a7ac818d195b038b7bcd); no intervening territory.ts, lock.ts or harness.ts commit is present. These are valid unchanged-source file repetitions, not exact merged-head suite evidence.

One exact-head no-mode/no-executor cland verify may follow source clearance under current Coordinator admission rules. Preserve actual executor/platform; a local fallback does not fulfill C2's explicit droplet requirement. No per-item QA criteria. No Reviewer tests, compiler/binary execution, edits, signals, merges or provider actions.

Evidence A-3459 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3459-t-527-five-serial-quiet-mac-whole-file-passes/README.md and adjacent mac-pass-1..5 logs. Standards:0 findings; Spec:0 findings, Linux runtime evidence pending.

Review artifact A-3460 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3460-t-527-source-clear-at-d2d184f5-observed-acquisition-with-failure-safe-release-an.md.

Criteria: C1 verified.
