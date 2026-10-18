---
id: T-772
kind: task
title: Tracker and merge T3 files move their rule tests to T2 under the same titles (A-4961 group, ~133 s)
state: open
status: ready
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - tests
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: topic-479
branch: t/T-772-tracker-and-merge-t3-files-move-their
created: 2026-10-18T04:49:20.866Z
updated: 2026-10-18T05:44:55.576Z
---

## Summary

This is a split of T-708, from its C1 inventory A-4961. It covers the 40 "Tracker and merge" T3 files (545.6 s): tracker schema, status, criteria, rank and plan rules move to T2 under the same test titles. Native Git and crash/recovery regressions stay in their T3 files. The proposed removal from T3 is 132.9 s.

## What to build

Apply the "Tracker and merge" rows of A-4961 exactly: same-title moves to the listed T2 destinations, splits as listed, and native files left alone. Run the lint's shrink tool after T-684 lands, if it has.

## Acceptance criteria

- [x] C1. Every "Tracker and merge" row in A-4961 is applied or explicitly kept, with each moved test's title and assertion meaning unchanged, recorded as an audit artifact.
  - done: impl-772 · 2026-10-18T05:12:01.376Z
  - verified: rev-30 [reviewer] · run rev-20261018-772-source-correction · 2026-10-18T05:12:34.104Z · commit a67f4f6aa0a91ad514c40529acce2cb352d8a4da
- [x] C2. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - done: impl-772 · 2026-10-18T05:44:05.785Z
  - verified: rev-30 [reviewer] · run rev-20261018-772-final · 2026-10-18T05:44:55.340Z · commit a67f4f6aa0a91ad514c40529acce2cb352d8a4da

## Comments

### impl-772 · 2026-10-18T04:58:39.084Z

Applied all 40 A-4961 Tracker and merge dispositions: 10 whole-file T2 moves, 5 same-title component splits (123 titles), 25 native files unchanged. Historical T3 weight removed 132.853123 s. Typecheck, tiers and test lint pass. Completing 21 touched test files whole-file 5/5 serially on macOS at load <15, with T2 resource enforcement. C1 audit publication and review request follow the final receipts.

### impl-772 · 2026-10-18T05:06:44.162Z

Committed and pushed dd0bf5d51ec65e878274ab24909d76ffe2082bb3. C1 audit A-4971; Mac check/5x evidence A-4972. All 21 touched test files passed whole-file 5/5 serially (105/105), no skips, zero T2 enforcement trips, max sampled 1-minute load 12.038. Typecheck, tiers, lint exit 0. T-684 remains unmerged, so --shrink is unavailable. C2 Mac evidence complete; exact-reviewed-head droplet verify follows source clearance. QA policy none/after-stage; requesting source review only.

### rev-30 · 2026-10-18T05:11:36.435Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-772-source
commit: dd0bf5d51ec65e878274ab24909d76ffe2082bb3
scope: full
findings: [{"severity":"medium","text":"advance keeps its captured target after a callback calls block(), so another timer whose deadline elapsed during that synchronous work remains pending after advance returns.","file":"hub/test/fake-clock.ts","line":54}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: medium M1 at hub/test/fake-clock.ts:54: advance filters against its captured target after a callback calls block(), leaving newly overdue timers pending. Timer A at 5 blocking 10 leaves timer B at 10 pending after advance(5) returns at 15; extend the drain horizon and add that regression. Implementer confirmed and is preparing a replacement. Spec: all 40 inventory dispositions and 123 moved titles reconcile; retained native files and behavioral assertions checked. A-4977 records the source audit and 105 local whole-file receipts (840 passes). C1 failed on the clock semantics supporting the migration; C2 remains unverified pending source correction and exact-head droplet evidence.

Criteria: C1 failed (The new FakeClock.block path leaves elapsed timers pending during advance, changing the fake-time semantics supporting the migrated tests; fix the drain horizon and add a second-timer regression.).

### rev-30 · 2026-10-18T05:12:34.105Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-772-source-correction
commit: a67f4f6aa0a91ad514c40529acce2cb352d8a4da
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: M1 resolved; advance drains through max(target,current fake time). Regression proves the elapsed second timer fires at 35, the future timer stays pending, then fires at 36 without moving time backwards. Spec: unchanged 40-row/123-title migration and assertion audit remains applicable; C1 verified. A-4979 records the correction and independent audit of A-4978: 15 whole-file receipts, 240 passes, no failures/cancellations/skips or recorded tier trips; red/green preserved. Only two clock files changed since the reviewed parent. C2 remains unverified pending exact-head droplet evidence. Normal verification may proceed at this commit.

Criteria: C1 verified.

### impl-772 · 2026-10-18T05:13:17.378Z

Reviewer clock finding corrected in a67f4f6a; source clear rev-20261018-772-source-correction, A-4979, C1 verified. A-4978 adds red/green and affected-file 5/5 evidence. Exact-head diff-selected droplet verification submitted: f3c91a4b-7b92-4965-9790-3678e059f127 in topic-479. Awaiting result before completing C2.

### impl-772 · 2026-10-18T05:44:06.020Z

Exact-head droplet f3c91a4b passed at a67f4f6a: hub-only exit 0, 2129 pass/0 fail/5 unrelated skips; all 21 touched files have Linux receipts and all 45 load-gate identities pass 5/5. Linux c-8 lon1, 1723 s lifetime, $0.1197. Log A-4997; audit addendum A-4998. Two report-only ps-probe trips include tracker-levels and existing claude-code-schedule; Coordinator identifies known T-759 shared root and explicitly says it does not block T-772. C2 marked done; requested final same-head Reviewer evidence verdict. No source changes.

### rev-30 · 2026-10-18T05:44:55.340Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-772-final
commit: a67f4f6aa0a91ad514c40529acce2cb352d8a4da
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4999: final same-head evidence clear; C2 verified, C1 source verification remains current. A-4997/f3c91a4b passes with 2,129 pass/0 fail/5 unrelated prerequisite skips. Independently checked all 21 touched files/168 owned ordinary test receipts, all 123 moved destination titles and all 45 load gates 5/5 (225/225). Mac A-4972 plus corrected clock/consumer A-4978 remains applicable. Two report-only ps-probe receipts are explicitly disclosed, not a zero-trip claim: primary Coordinator 5fcaa29a assigns both to broadened T-759 and says they do not block T-772; addendum A-4998 preserves this. No source/head change. Linux c-8 lon1, 1,723s lifetime, $0.1197. No per-item QA.

Criteria: C2 verified.
