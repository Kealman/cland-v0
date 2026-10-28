---
id: T-1427
kind: task
title: tracker-component's hand-written-file check waits 1 s, shorter than the tracker's 5 s rescan, and fails on a busy macOS
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1155
branch: t/T-1427-tracker-component-s-hand-written-file
created: 2026-10-28T14:23:33.829Z
updated: 2026-10-28T15:00:53.944Z
closed: 2026-10-28T15:00:53.944Z
---

## Summary

`hub/test/tracker-component.test.ts` "task create writes an item file with the frontmatter and sequential ids" writes `T-7-by-hand.md` by hand, then gives the tracker 1000 ms to list it. On macOS, indexing a hand-written file waits for an FSEvents delivery or the 5 s safety rescan (T-1377), so the 1 s bound fails when fseventsd is busy. It failed in the E-1311 stage-2 macOS cover ab376574 at cfcd0c61 (A-13338, peak load 20.95) and then 2/5 alone on the same Mac (coord, 2026-10-28 14:25Z): "tracker observation: not within 1000 ms … actual ['T-1','S-2'], expected ['T-1','S-2','T-7']" (hub/test/tracker-component.test.ts:86).

## Acceptance criteria

- [x] C1. The hand-written-file observation is bounded by the tracker's documented detection guarantee (the safety rescan interval plus margin, or an explicit rescan trigger the test owns), not by a 1 s guess, and the assertions are unchanged.
  - done: impl-1427 · 2026-10-28T14:27:39.158Z
  - verified: rev-31 [reviewer] · run rev-20261028-1427-source2 · 2026-10-28T14:38:29.816Z · commit b94755cd1e8c2709ad3abe288185648c230318d7
  - verified: rev-31 [reviewer] · run rev-20261028-1427-final1 · 2026-10-28T14:53:55.189Z · commit b94755cd1e8c2709ad3abe288185648c230318d7
- [x] C2. The test passes 10/10 alone on macOS while fseventsd is busy (two workers plus CPU load), and in a same-head Linux run.
  - done: impl-1427 · 2026-10-28T14:53:06.552Z
  - verified: rev-31 [reviewer] · run rev-20261028-1427-final1 · 2026-10-28T14:53:55.189Z · commit b94755cd1e8c2709ad3abe288185648c230318d7

## Notes

Blocks the E-1311 stage-2 macOS cover. Related: T-1377 (safety rescan every 5 s beside a healthy watch).

## Comments

### coord · 2026-10-28T14:24:08.542Z

Moved into 0.3 (R-1278) on the answer to ask da7196cc (2026-10-28 14:24Z), under the human's standing yes of 05:04Z.

### impl-1427 · 2026-10-28T14:26:32.362Z

Red reproduced at cfcd0c61 on local macOS: exact existing CLI case failed `tracker observation: not within 1000 ms`, actual [T-1,S-2], expected [T-1,S-2,T-7] (case 1970 ms). No shared contract changes or consumers to migrate. Green fix uses pre-armed exact-file reindexedAfter receipt, shared 15 s bound against documented 5 s healthy-watch safety scan; public list and next-id assertions retained. Running C2 ten fresh processes in two lanes with owned CPU load, then releasing local slot.

### coord · 2026-10-28T14:27:57.685Z

Scope extended by coord (2026-10-28 14:28Z): C1 covers every observation in hub/test/tracker-component.test.ts that waits on the watcher seeing a hand-written or hand-edited file, not only line 86. impl-1427 found the same 1000 ms failure at line 240 ('a verdict comment is stored in the file with its header and is queryable through the index': actual [], expected ['T-3']) in a full-file macOS run, 10/11.

### impl-1427 · 2026-10-28T14:28:16.669Z

Coordinator extended scope (decision 3cf4acce). Complete hand-write/edit observation audit: sequential-id hand file originally line 85/86 (migrated); hand-appended verdict originally line 239/240 (remaining 1 s guess, now migrating); subscribed-UI hand title edit originally line 340/341 already waits for task event via nextTask (no eventually guess; will arm exact-file receipt too); subscribed-UI deletion originally line 344/345 waits for task event (will use removedAfter alongside unchanged native event assertion). No other direct hand writes or eventually calls in this file. No production contract changed.

### rev-31 · 2026-10-28T14:32:09.003Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1427-source1
commit: 2339569526e6b85f3b5fd159bb157dea474eb76d
scope: full
findings: [{"severity":"medium","text":"M1 Standards: H1 '# Tracker component tests' fails the existing test-docs.test.ts:23–25 test-file-heading contract. Use '# hub/test/tracker-component.test.ts', preserve guard assertions and retain original red/green before fresh source review.","file":"docs/agents/tests/hub-test-tracker-component.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13344 full source1: Standards1 medium / Spec0. All four hand-write/edit/removal waits use the existing pre-armed exact-file 15s receipt against 5s safety detection; exact public semantic and native task-event assertions preserved. No production/shared interface/test identity/allowance changes. New guide heading alone blocks source clearance. C1 claimant done retained, C2 pending local original-record audit plus same-head Linux. A-13343 local 10x11 load and ordinary11/typecheck are implementation-reported macOS evidence, not configured/Linux proof. Fix heading only, preserve red/green, push and request fresh review before mode-free verify; no extra dev merge or per-item QA.

### rev-31 · 2026-10-28T14:38:29.816Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1427-source2
commit: b94755cd1e8c2709ad3abe288185648c230318d7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13346/source2 clear, Standards0/Spec0. Sole correction is exact guide H1, test-docs guard source unchanged with reported red2/3→green3/3. Source1 four bounded receipt migrations and unchanged assertions carried; C1 source verified. Independently audited A-13345 ten original macOS terminal logs: each11 pass/0 fail/cancel/skip/todo, all three migrated case names pass; driver has two lanes/owned CPU and close/terminate joins. Source attribution/report limits retained, and old/new test blob d727047a5 matches exactly. These are local unchanged-test-byte results, not a Linux pass. C2 remains pending one stable-head mode-free Linux verification and original-record final audit. No extra stress/full cover or per-item QA requested; Coordinator owns enqueue after final clear.

Criteria: C1 verified.

### rev-31 · 2026-10-28T14:53:55.189Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1427-final1
commit: b94755cd1e8c2709ad3abe288185648c230318d7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13350 final clear: independently parsed exact-head A-13349/ed0974ad,3944 ordinary passes plus25 separate load passes, zero fail/cancel/skip/todo; all11 tracker-component cases and test-docs3/3 pass. Required sequential-id/verdict/UI finishes16793/16845/16901 are pass1.065781707/.431034732/1.067689522s. C1 source2 unchanged; C2 combines same-head Linux and previously audited A-13345 ten original macOS11/11 two-lane+CPU logs with guide-only correction/test-blob provenance retained. T0/T1/all fallback T2/Web complete, T3/T4 absent; Linux droplet c-8 lon1, pinned Headless Shell156/v1248, host TREE reuse, task2/Web4 workers and report-only lint/timing/missing-baseline limits explicit. No new identity/allowance/per-item QA or extra suite requested. Fresh conflict check/ready; Coordinator owns enqueue and stage cover.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-28T15:00:53.944Z

Merged bef2ec6786701401088f83e5034dd3aad3327f5b onto dev.
