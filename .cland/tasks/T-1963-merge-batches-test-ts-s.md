---
id: T-1963
kind: task
title: merge-batches.test.ts's boundedJoinedCase + joinedCase helpers fence fixture work only after caseDeadlines' pending-work join
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1785
branch: t/T-1963-merge-batches-test-ts-s
created: 2026-11-18T08:00:17.305Z
updated: 2026-11-26T00:32:14.430Z
closed: 2026-11-26T00:32:14.430Z
---

## Summary

Found by impl-1894 and its reviewer (2026-11-18) by reading the source; no runtime failure has been seen yet. In hub/test/merge-batches.test.ts, the existing `boundedJoinedCase` plus `joinedCase` helper pair captures its `fixtureWork.close` behind `caseDeadlines`' pending-work join. So fixture admission is fenced only after pending work has joined, not before teardown starts. T-1894 fixed the same ordering gap in its new `guardedMemberCase` (synchronous fence through `caseDeadlines.releaseOnClose` and TestContext abort before pending waits join), but left the existing callers unmigrated, per its review scope.

## What to build

Move the existing helper pair, or its callers, onto the same early-fence order as `guardedMemberCase`: fence fixture work synchronously at close or abort, then join pending work, then restore resources and guards. Keep every caller's assertions unchanged.

## Acceptance criteria

- [x] C1. A held continuation started after teardown begins is rejected, never resolved, in each migrated helper caller (test with a positive control that fails on the old order).
  - done: impl-1963 · 2026-11-25T13:14:57.591Z
  - verified: rev-35 [reviewer] · run rev-35-1963-evidence-1 · 2026-11-25T13:32:12.750Z · commit c8db70f5e73fccc696f02d932ab41cfa35728e59
- [x] C2. Every caller of `boundedJoinedCase` and `joinedCase` is listed with its disposition (rule 41) and passes unchanged.
  - done: impl-1963 · 2026-11-25T13:14:58.092Z
  - verified: rev-35 [reviewer] · run rev-35-1963-evidence-1 · 2026-11-25T13:32:12.750Z · commit c8db70f5e73fccc696f02d932ab41cfa35728e59

## Comments

### impl-1963 · 2026-11-25T13:11:43.892Z

Consumer search: rg for boundedJoinedCase and joinedCase across repository found only local definitions plus five existing call sites (six generated cases): bounded passing retry; stopping during host gate; omitted member absent failing file; unregistered present failing file; same-head re-enqueue blocked=false/true. All delegate to guardedMemberCase with body assertions unchanged. New helper×teardown/abort regression covers all three helper entries. Red on Node 24.21.0 macOS: joinedCase abort and boundedJoinedCase teardown/abort resolved instead of rejecting (3 failures / 6); existing guardedMemberCase controls and joinedCase direct teardown passed. No shared production contract changes.

### rev-35 · 2026-11-25T13:16:39.660Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1963-source-1
commit: c8db70f5e73fccc696f02d932ab41cfa35728e59
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23415: source clear at corrected full SHA; no findings. Both joined helpers delegate to guardedMemberCase's synchronous close/abort fence before pending join; resource completion/guard-restoration conditions retained. Pinned search matches five sites/six generated callers, bodies/assertions unchanged. Expanded three-helper×teardown/abort controls observe entry, reject original callback and assert zero late admission; old3/6 red history preserved. Local165T1/file and related checks remain scoped implementation evidence. C1/C2 unverified pending exact-head configured generated control/caller receipts. Source hold released; request Coordinator window then one mode-free verify at this unchanged head. Reviewer ran no tests/lint/probes/native/browser.

### rev-35 · 2026-11-25T13:32:12.750Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1963-evidence-1
commit: c8db70f5e73fccc696f02d932ab41cfa35728e59
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, C1/C2 verified. A-23429 independently audits same-head52323095/A-23428: result code0/cause empty, bothT0/T1/T2/T3/Web complete exit0, no unfinished. Six exact owner/teardown/abort controls each base+5distinct load passes; all six unchanged migrated callers base pass; whole changed file165/165+file finish pass.2714paired records, no mismatch/finish-only;2394basepass+30loadpass,0skip/fail. Execution scope hub-selected: fullT1, no T2-file execution credit despite empty phase exit0,7selectedT3 and Web smoke1file/5tests; otherT2/T3/T4/Web uncredited. Linuxx64 c-8nyc1/2workers,Node24.21,HeadlessShell1248/v156.0.8078.4; report advisories,cache unknown. Git5aa1db7d/suite40d632b1 trees recorded literally; lifetime/cost machine accounting. Source unchanged; reviewer executed no tests/lint/probes/native/browser.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-26T00:32:14.430Z

Merged 05d708e41a481972fd807239c2dacb583a0e66b3 onto dev.
