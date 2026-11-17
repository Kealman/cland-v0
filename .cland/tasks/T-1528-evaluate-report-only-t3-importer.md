---
id: T-1528
kind: task
title: Evaluate report-only T3 importer selection for merge batches (T-1490 class)
state: open
status: review
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1601
branch: t/T-1528-evaluate-report-only-t3-importer
created: 2026-10-31T17:17:41.198Z
updated: 2026-11-17T12:01:50.153Z
---

## Summary

The only real interaction miss since T-1454 went live was T-1490. In it, T-1484 and T-1453 landed in separate T1-only batches and broke a shared T3 test (suite-admission-native). Batch interaction selection adds only T2 and Web, so neither `report` nor `run` would have caught it (T-1488, A-15009). Evaluate a report-only T3 importer selection for batches.

## Acceptance criteria

- [x] C1. A report-only T3 importer selection, replayed against T-1490's exact heads, lists suite-admission-native for the T-1484 × T-1453 pair.
  - done: impl-1528 · 2026-11-17T11:55:09.917Z
- [x] C2. The artifact records explicitly synthetic zero-delta negative controls, labels the A-15009 window's historical T3 negatives as unknown (their candidate trees expired), and gives per-batch projected extra T3 wall time and droplet cost from labelled landing/parent reconstructions, plus the platform caveats, so that a later enforce/run switch has its evidence under rule 27.
  - done: impl-1528 · 2026-11-17T11:59:31.257Z

## Comments

### impl-1528 · 2026-11-17T11:44:00.931Z

Consumer audit before extending report: suite-interactions produces batchInteraction; suite-selection owns transport validation and cache comparison; shared/wire duplicates selection type; hub/suites passes/logs/persists selection unchanged; hub/merge-batches batchInteractionSummary emits bounded report JSON; suite-selection.test (T3) and merge-batches.test (T1) assert old report fields; init-config tests assert unchanged setting, not report shape. Searches for batchInteraction and batch interaction across hub/web/nvim/shared/qa/docs/.agents found no raw report parsers, startup probes or frozen CLI report bytes. Existing CLI help fixture describes unchanged T2/Web run switch. Add optional t3 report, preserving old fields and legacy reads. No hot suite files changed.

### impl-1528 · 2026-11-17T12:00:05.707Z

C1/C2 evidence: A-20861 supersedes A-20860 and matches the Coordinator-updated C2 wording. Exact positives list suite-admission-native conservatively and host-ssh-contract through a proved edge; 25 window rows explicitly distinguish reconstructed nonempty projections from synthetic zero-delta controls and unknown historical negatives. Rate scenario $0.25/hour is receipt-backed, historical price unknown. Local Darwin arm64 Node24.21.0: 82 reachable/conservative T1 files passed 882/882 cases (A-20862), T2 new report tests 2/2 with positively controlled native launch guard, full typecheck exit0. No T3/Web/browser execution in these local checks. Final source merged origin/dev once (1cd9883c0), source head 4c6b61954, full lint pending at this comment. No help exports/config/default/role change.
