---
id: T-1488
kind: task
title: Switch batch interaction selection from report to run, on recorded batch evidence
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by:
  - T-1510
topic: topic-1281
branch: t/T-1488-switch-batch-interaction-selection-from
created: 2026-10-30T14:25:54.233Z
updated: 2026-10-31T17:22:40.973Z
---

## Summary

T-1454 widens merge-batch test selection by importer interaction, but it ships the batch side in report mode (`[merge] batch_interaction = \"report\"`), because a typical hub change adds about 290 T2 and Web files to a T1-only batch (store.ts adds 294, a Codex adapter change 292, cli/usage.ts 40; measured 2026-10-30). This item switches batches to run mode, or narrows it, based on the recorded batch lines.

## Acceptance criteria

- [x] C1. One artifact summarises at least a day of recorded batch lines (added files and phases per batch, projected extra wall time, and any landing a later run found broken that the additions would have caught), and the item records a decision between `run`, a narrower rule, or keeping `report`, with that evidence.
  - done: impl-1488 · 2026-10-31T17:17:33.928Z
  - verified: rev-26 [reviewer] · run rev-20261031-1488-evidence-1 · 2026-10-31T17:22:40.868Z · commit af49b98c71d89e189d06d5508fd43c080e49a990

## Comments

### impl-1488 · 2026-10-31T17:17:33.868Z

Decision: keep report. Evidence A-15009 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15009-t-1488-batch-interaction-evidence-keep-report.md) inventories 25 unique batch receipts over the 2026-10-30 16:00Z–2026-10-31 17:15Z observation window, exact added sets/phases and per-batch wall projections, pre/post #65 split and known-break table. Six of eight post-#65 batches propose only six conservative T2 fallbacks (7.220s serial saved-baseline projection, 4.509s ideal; startup/scheduling/load excluded), two none. No confirmed T2/Web landing interaction catch; T-1490 is the T-1484 × T-1453 T3 miss, outside this selection. Coordinator decision fc0fc169 authorizes evidence-only: no commit/push/verify; artifact review required before Coordinator closure. Separate Follow-ups/M recommendation: report-only T3 importer selection evaluation, detailed in artifact. No code/contract/default change or new tests.

### rev-26 · 2026-10-31T17:22:40.868Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1488-evidence-1
commit: af49b98c71d89e189d06d5508fd43c080e49a990
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15015 independently audits A-15009 and supports keep report. All 25 unique batch IDs/heads/sets/phases/provenance match original logs and journal; 50 stored copies are exactly two per batch, with all appendix message IDs/text matching. Window is 25h15m; actual receipt span is 21h59m10.893s, correctly qualified. Split is 17 before #65 / 8 after; post-restart six nonempty six-file fallback sets and two empty. All 25 saved-baseline projections reproduce from task-head manifest blob d25ea998, with startup/scheduling/load exclusions retained; post set 4.509s ideal / 7.220s serial. Actual batches ran T0/T1, plus existing Web once; no T2/T3/T4 addition coverage implied. Known-break table distinguishes the T3 T-1490 interaction, Mac fixture defect, T1 duration gate, T2 race and pre-window clock failure; no confirmed T2/Web interaction catch claimed. C1 verified. Coordinator fc0fc169 authorizes artifact-only closure, no commit/push/verify; T3 follow-up already T-1528. No reviewer workload or mutation.

Criteria: C1 verified.
