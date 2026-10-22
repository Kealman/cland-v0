---
id: T-1078
kind: task
title: Criteria edits on the card
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1073
topic: topic-844
branch: t/T-1078-criteria-edits-on-the-card
created: 2026-10-21T17:32:17.135Z
updated: 2026-10-22T10:50:02.368Z
---

## Summary

The criteria edits on the card, the only hand edit besides messages and plan approval (§3.5).

## Parent

E-416 (§3.5; tracer step 6).

## What to build

`e` on the card's criteria block opens it to add, edit and remove criteria and to set the done mark as the human, through `task.criterion`. Ids are never reused. Labels and the body stay in Neovim. Nothing in the Items area ranks or moves items by hand.

## Acceptance criteria

- [x] C1. A criterion added on the card reads back through `cland task view`, and an edit and a removal keep the other ids unchanged (Web test).
  - done: impl-1078 · 2026-10-22T10:39:11.902Z
- [x] C2. Setting the done mark records it as the human (Web test).
  - done: impl-1078 · 2026-10-22T10:29:35.874Z
- [x] C3. No other field of the item is editable from the web (Web test).
  - done: impl-1078 · 2026-10-22T10:29:35.945Z
  - verified: rev-23 [reviewer] · run rev-20261022-1078-source-2 · 2026-10-22T10:40:18.593Z · commit abaf4ae5d2b1ef6b3068edaabd8254892ad0e322

## Comments

### impl-1078 · 2026-10-22T10:29:36.021Z

Implemented card Criteria editor at 6c2d6340 (tree 0a9a: see artifact for full tree): physical e on the block, one-line text separate from ids, add/edit/remove/non-reuse and done as human via task.criterion; other fields remain read-only. Test-first C1/C2 reds retained; three criterion Web cases and six drawer regressions, keymap T1 and npm run check passed locally on Darwin arm64/Node24.21.0; lint is report-only (132 findings/59 files), not queued/integrated or Linux evidence. Full exact-head source review then mode-free verify pending. Affected QA is after-stage on dev. Evidence artifact posted in this item topic.

### impl-1078 · 2026-10-22T10:29:48.535Z

Correction: source tree is 72aa34b1a4f045374e3c820050f1e1cf1020d31e at head 6c2d6340ee05d2a01a19363d0924ca2c647482b7. The preceding comment's tree prefix was a transcription error; A-9087 README contains the correct full identity and raw receipts. Durable artifact: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9087-t-1078-source-evidence-and-card-preview.

### rev-23 · 2026-10-22T10:35:47.034Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1078-source
commit: 6c2d6340ee05d2a01a19363d0924ca2c647482b7
scope: full
findings: [{"severity":"medium","text":"M1: unique criteria help action raises Items help to 33 rows, but palette.test.ts:121/:220 still assert 32. Update exact complete expectations/traversal and any renamed allowance identity.","file":"web/src/keymap.ts","line":70},{"severity":"medium","text":"M2: null criterion IDs are replaced with C{index+1}, while the server allocates above existing IDs/criterion_seq. An unlabelled first row followed by explicit C1 sends C1 and mutates the second row. Preserve actual target identity and cover mixed legacy/high-water cases with UI plus CLI readback.","file":"web/src/ItemCriteria.tsx","line":46}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source review from fixed base 7887f694ace91db414735b9af93ab20bedbc8c45 at exact head 6c2d6340ee05d2a01a19363d0924ca2c647482b7/tree 72aa34b1a4f045374e3c820050f1e1cf1020d31e: not clear. Consolidated Standards/Spec findings and evidence limits in A-9090, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9090-t-1078-source-review-not-clear-help-contract-and-legacy-criterion-identity.md. Read-only source/Git/log audit; no Reviewer runtime execution. A-9087 targeted local passes do not exercise the findings. C2/C3 remain unverified. Correct both findings and request fresh exact-head source review before configured mode-free verify; affected after-stage QA remains separate.

Criteria: C1 failed (Position-derived IDs can edit/remove another legacy criterion; existing Items help tests also retain the old 32-row contract.).

### impl-1078 · 2026-10-22T10:39:11.987Z

A-9090 M1/M2 fixed at pushed abaf4ae5d2b1ef6b3068edaabd8254892ad0e322/tree 66722f5946f856a334dfc7af00f8d3d6e4768412. M1 actual red was 33 !== 32; both palette counts/traversal identity and its unchanged 7.5s existing allowance now name33. M2 actual red was 0 !== 1 for read-only null-id row. Coordinator approved fallback: null-id rows have no edit controls, with tooltip; Add/CLI writes return persisted IDs before editing. C1 mixed explicit/legacy and retained-seq12 fixtures pass edit/done/remove CLI readback preserving keeper text/id/marks. Local Darwin arm64: criterion3 cases+parent, palette11 test records incl parents, npm check exit0; lint report-only132/59. A-9095 retains logs. No post-review dev merge, no queued verify yet; fresh source review next. QA after-stage.

### rev-23 · 2026-10-22T10:40:18.593Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1078-source-2
commit: abaf4ae5d2b1ef6b3068edaabd8254892ad0e322
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at exact head abaf4ae5d2b1ef6b3068edaabd8254892ad0e322/tree 66722f5946f856a334dfc7af00f8d3d6e4768412 against fixed base 7887f694. Both A-9090 findings resolved: exact 33-row help contract/traversal and migrated unchanged 7.5 s allowance; no guessed legacy criterion IDs, read-only fallback explicitly approved by Coordinator 71c04035. Mixed legacy/high-water fixtures establish persisted IDs before edits and preserve keeper ID/text/marks by CLI readback. Standards/Spec: zero remaining findings. A-9097 contains the audit; A-9095 original red/green local logs inspected. C3 source-established; final C1/C2 await exact-head mode-free configured verification. No Reviewer runtime, Linux, T3/T4 or after-stage QA claim. Local criterion parent 4.036 s is not Linux allowance evidence. Any allowance/head change requires fresh source review.

Criteria: C3 verified.
