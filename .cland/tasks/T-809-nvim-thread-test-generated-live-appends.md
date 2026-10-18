---
id: T-809
kind: task
title: 'nvim thread.test: "generated live appends…" waits 10 s for a generated append and times out on a droplet stage run; the file slowed from 23 s to 35 s after recorded frames'
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-520
branch: t/T-809-nvim-thread-test-generated-live-appends
created: 2026-10-18T15:41:10.672Z
updated: 2026-10-18T19:19:22.616Z
---

## Summary

nvim/test/thread.test.ts, "generated live appends, ask evictions and delivery changes equal a full render" (4 seeds × 25 renders), failed in E-678's Linux stage run ac462603 (A-5402 line 4630): `the screen never showed generated append within 10000 ms`, after 18.4 s. The file has slowed in every run today (23.5 s baseline → 35.5 s), along with shell, ui and vboard, since T-709's recorded-frame replay (catalog parse about 50 ms per stub process, A-5395). It hasn't failed before in today's logs.

## Acceptance criteria

- [x] C1. The generated-append wait observes the render event or hub frame instead of a 10 s wall-clock screen poll, or the oracle's seeds run against a per-file catalog slice (T-774's mechanism). Every assertion is kept.
  - done: impl-809 · 2026-10-18T16:37:16.015Z
  - verified: rev-30 [reviewer] · run rev-20261018-809-source · 2026-10-18T16:38:57.198Z · commit bfbc434d077ddb1c2d5e75a33145cc54208bf77b
  - verified: rev-30 [reviewer] · run rev-20261018-809-final · 2026-10-18T18:59:35.099Z · commit bfbc434d077ddb1c2d5e75a33145cc54208bf77b
  - verified: rev-30 [reviewer] · run rev-20261018-809-recorder-delta · 2026-10-18T19:19:11.618Z · commit 37340f49b28d7086964795110148c123e0a5614a
- [x] C2. The file passes 20/20 serially on macOS plus a green droplet verify on Linux at 2 workers, with its time back under its 23.5 s baseline or the new number recorded.
  - done: impl-809 · 2026-10-18T18:58:50.918Z
  - verified: rev-30 [reviewer] · run rev-20261018-809-final · 2026-10-18T18:59:35.099Z · commit bfbc434d077ddb1c2d5e75a33145cc54208bf77b
  - verified: rev-30 [reviewer] · run rev-20261018-809-recorder-delta · 2026-10-18T19:19:11.618Z · commit 37340f49b28d7086964795110148c123e0a5614a

## Comments

### impl-809 · 2026-10-18T16:23:38.966Z

Baseline whole-file run: 23/23 pass, 28.468 s, oracle 16.527 s. Replaced generated append screen polling with a barrier on the final boundary delivery/queued frame, registered after the synchronous thread consumer. All original render-equivalence assertions retained; explicit rendered-block Live text assertion keeps append-presence coverage. Missing-final-frame mutation fails with 'generated append delivery burst has not landed'; mutation restored. C2's 20 serial whole-file Mac repetitions underway; source review precedes Linux verification.

### impl-809 · 2026-10-18T16:35:43.604Z

Exact extended-plan reproduction found the cause: seed 1 append 11 is absent from committed protocol frames (key 97d2a55e99fe5b315d42c536390782f70d4f737199fc7d126b3332647d229965); ignored stub-control failure became the misleading screen timeout. Added explicit control receipt assertion, final-delivery barrier and rendered-block text check. Extended maintenance capture adds 190 records and 1,486 nodes with all 4,464/24,807 existing records/nodes unchanged. Capture now always selects extended inputs so a full refresh retains them. AST audit: all 23 titles and 100 original assertions unchanged/in order, two assertions added. Typecheck and lint exit 0; live producer/catalog check 1/1 in 1.903 s. Earlier 20 ordinary passes are pre-catalog evidence; repeating against final source/catalog after extended replay.

### rev-30 · 2026-10-18T16:38:57.198Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-809-source
commit: bfbc434d077ddb1c2d5e75a33145cc54208bf77b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. C1 verified: final queued-delivery callback runs after the synchronous thread consumer in ordered client handlers; reset flag/bounded frame observation replaces screen polling, while explicit control success and rendered append-block presence retain coverage. Reviewed AST audit keeps23titles/100original assertions,adds2. Independently confirmed all4464old records/24807nodes unchanged,190records/1486nodes added, including reproduced missing seed1/append11 key. Maintenance now captures extended plan so full refresh preserves it; ordinary replay remains JSON-only. A-5440 raw extended replay23/23 and producer check1/1 pass; missing-final-frame control fails specifically. Standards/spec:no findings. C2 remains pending final-source20 serial Mac runs/new measured time plus exact-head Linux2-worker gate; old20runs supplementary only. T-813 submission hold remains until primary all-clear; no Reviewer execution/per-item QA.

Criteria: C1 verified.

### impl-809 · 2026-10-18T16:45:15.345Z

Final-source evidence A-5452 at unchanged source-reviewed bfbc434d:20/20 serial whole-file Mac runs,460passes,0fail/cancel/skip; file seconds min/median/max15.110/19.712/26.386 (peak observed1m load8.639). All three source/catalog hashes match receipts and current disk. Extended4×25 committed replay also23/23 in61.170s. C1 source verified by Reviewer (A-5442); C2 awaits exact-head Linux2-worker verification after Coordinator lifts T-813 hold. Source/root-cause/static/integrity evidence A-5440. No verify submission attempted during hold.

### impl-809 · 2026-10-18T17:13:39.669Z

Linux2-worker verification b329e5fa failed outside T-809 scope: A-5477 lines48835–48839, suite-cancel.test.ts::a worker killed while the hub is down is reported after restart and its package children are cleaned, process.kill(null) at line181 (ERR_INVALID_ARG_TYPE). Hub phase stopped before Neovim; C2 remains pending. Flagged run/test reported to supervising Lead as shared-defect candidate; no diagnosis, head change or retry. Source review and independently audited final Mac20/20 evidence remain current at bfbc434d.

### rev-30 · 2026-10-18T17:14:17.663Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-809-runtime
commit: bfbc434d077ddb1c2d5e75a33145cc54208bf77b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Runtime not clear: A-5477/b329e5fa exits1 at unchanged bfbc434d; suite-cancel.test.ts:181 process.kill(null) causes the sole ordinary failure. Neovim/thread not reached. A-5480 retains independently audited 20/20 Mac plus extended replay evidence and distinguishes ordinary vs repeated-body counts. No new task-source finding; Bugs/S shared-defect candidate routed to lead for classification. C1 source verification remains; no retry authorized by this verdict.

Criteria: C2 failed (Linux gate A-5477 failed in unchanged hub suite-cancel before Neovim; no thread execution or green Linux two-worker receipt exists.).

### impl-809 · 2026-10-18T18:59:02.521Z

C2 complete at source-reviewed bfbc434d: authorized replacement Linux2-worker run f136864b passes (A-5528),2623pass,0fail/cancel,8prerequisite skips. Neovim runs fully; thread has23 positive timing records and24 positive finish receipts including file, no scoped skips. Oracle10.636s; thread file24.241s (new Linux number recorded versus23.5s baseline); Neovim shard170.21s. Final-source Mac20/20 evidence A-5452 remains independently audited, median19.712s, plus extended4×25 replay23/23. C2 marked done; awaiting Reviewer final evidence verdict. No source/head changes since initial source review.

### rev-30 · 2026-10-18T18:59:35.099Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-809-final
commit: bfbc434d077ddb1c2d5e75a33145cc54208bf77b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged bfbc434d. Independently audited A-5528/f136864b: full hub + Neovim, 2623 pass/2631 total, zero fail/cancelled, eight prerequisite skips. All 23 thread tests finish positively; file 24.241146264s, generated oracle 10.636234301s. Recorded new number satisfies C2 alongside previously audited A-5452 final-source Mac20/20 (460 passes; min/median/max15.110/19.712/26.386s) and separate extended replay. A-5529 records both axes, preserves failed A-5477/A-5480 and Coordinator-authorized replacement/T-814 classification, and discloses inherited report-only trips. C1 source unchanged; no findings, no per-item QA.

Criteria: C1 verified, C2 verified.

### impl-809 · 2026-10-18T19:17:55.970Z

Coordinator-requested conflict merge pushed as37340f49 (parents reviewed bfbc434d and dev93ac9def). Only manual conflict in hub/test/record-nvim-frames.ts: retained extended-plan environment and T-774 per-file recording keys/slices. A-5538 includes exact identifier/text search, all37 current matching/recorder-consumer files tested whole-file serially, real default-env4×25 maintenance+slice proof and extra extended replay:39invocations,371passes,0fail/cancel/skip. Thread ordinary14.843s/extended40.391s; typecheck/lint pass. All102 reviewed assertions/23titles and every parent catalog record/node preserved. Delta review requested; Coordinator's explicit test-code rule6 waiver uses prior Linux f136864b + delta review, no extra droplet. No manual resolution outside test code.

### rev-30 · 2026-10-18T19:19:11.618Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-809-recorder-delta
commit: 37340f49b28d7086964795110148c123e0a5614a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta clear at 37340f49. Only manual conflict composes extended CLAND_TEST_SOAK recording with T-774 key collection/slice writes; original task delta remains three test paths. Independently confirmed every catalog entry/node from both parents preserved, valid captured slice including missing seed1/append11 key, unchanged thread assertion bodies, and A-5538 raw39 invocations/371 passes/zero fail-cancel-skip with complete recorder-consumer coverage. A-5539 records both axes. Directly read Coordinator ab1b15d1: test-only resolution qualifies for waiver; prior accepted Mac20/20 and Linux f136864b plus this delta suffice. C1–C2 refreshed at merge head, no new droplet/per-item QA or findings.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-18T19:19:22.616Z

Merge under the rule 6 conflict waiver (coord, 2026-10-18 19:20Z). Head 37340f49 is the Coordinator-requested merge of dev 93ac9def into bfbc434d. The only manual conflict was in the test recorder hub/test/record-nvim-frames.ts. The delta review rev-20261018-809-recorder-delta is clear at 37340f49. The searches and 37 matching files (39 serial runs, 0 fail) are in A-5538. Linux suite evidence is f136864b at bfbc434d, plus the batch C integrated cover after merge.
