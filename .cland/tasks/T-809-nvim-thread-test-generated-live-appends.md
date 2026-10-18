---
id: T-809
kind: task
title: 'nvim thread.test: "generated live appends…" waits 10 s for a generated append and times out on a droplet stage run; the file slowed from 23 s to 35 s after recorded frames'
state: open
status: review
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
updated: 2026-10-18T16:45:15.345Z
---

## Summary

nvim/test/thread.test.ts, "generated live appends, ask evictions and delivery changes equal a full render" (4 seeds × 25 renders), failed in E-678's Linux stage run ac462603 (A-5402 line 4630): `the screen never showed generated append within 10000 ms`, after 18.4 s. The file has slowed in every run today (23.5 s baseline → 35.5 s), along with shell, ui and vboard, since T-709's recorded-frame replay (catalog parse about 50 ms per stub process, A-5395). It hasn't failed before in today's logs.

## Acceptance criteria

- [x] C1. The generated-append wait observes the render event or hub frame instead of a 10 s wall-clock screen poll, or the oracle's seeds run against a per-file catalog slice (T-774's mechanism). Every assertion is kept.
  - done: impl-809 · 2026-10-18T16:37:16.015Z
  - verified: rev-30 [reviewer] · run rev-20261018-809-source · 2026-10-18T16:38:57.198Z · commit bfbc434d077ddb1c2d5e75a33145cc54208bf77b
- [ ] C2. The file passes 20/20 serially on macOS plus a green droplet verify on Linux at 2 workers, with its time back under its 23.5 s baseline or the new number recorded.

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
