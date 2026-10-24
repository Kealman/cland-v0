---
id: T-421
kind: task
title: A stage holding an evidence-only task stays open until the epic closes
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-933
branch: t/T-421-a-stage-holding-an-evidence-only-task
created: 2026-10-14T16:42:23.975Z
updated: 2026-10-24T07:38:39.509Z
---

## Summary

A plan stage that holds a task closed on evidence, with no code and no merge commit, stays `open` until its epic closes. The stage's `merged` check requires a dev commit for every task (`hub/src/tracker/tracker.ts:1475`). E-271's fifth stage stays open because T-349, the MicroVM experiment, closed on evidence. That was caught at E-271's QA M0 (run qa-2026-10-14-27-9).

## What to fix

Count a task closed `done` with no branch and no code as landed for stage closure, or give such tasks an explicit marker the stage check honours. Keep the landing receipt required for tasks with a branch.

## Acceptance criteria

- [x] C1. A stage whose tasks are all merged, apart from tasks closed `done` without a branch, reads `closed` in `task plan show`.
  - done: impl-421 · 2026-10-24T07:37:49.146Z
- [x] C2. A task with a branch and no landing commit still keeps its stage open.
  - done: impl-421 · 2026-10-24T07:32:20.457Z

## Comments

### impl-421 · 2026-10-24T07:22:44.013Z

Implementation started. Root node_modules linked. Investigating the existing stage snapshot and landing index; proposed public plan-show regression seam to the supervising lead. Prefer derived evidence-only facts over adding a marker.

### impl-421 · 2026-10-24T07:33:05.240Z

Implemented and pushed 41ebc9170a745c7ba2851f85e1e6d1abd07fc511 (tree 5acf18084faf2ae4b9071f109834a60c0355416e). Evidence-only derives from closed done + no branch + no receipt + no dev Item trailer; no marker. Local macOS arm64 Node v24.21.0: npm run check passed (test lint report mode, zero refusals); targeted T2 planned-stage 16/16, T2 stage-closure-component 5/5, T3 stage-qa 12/12 passed. These are targeted receipts, no full-suite/coverage gate yet. C1/C2 done. Artifact A-10383: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10383-t-421-implementation-and-validation.md. No item QA brief supplied and none required by current none/after-stage policy.

### rev-26 · 2026-10-24T07:35:16.048Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-421-source-1
commit: 41ebc9170a745c7ba2851f85e1e6d1abd07fc511
scope: full
findings: [{"severity":"medium","text":"M1: The after-stage QA checklist still requires every listed item to have landed or reports BLOCKED, contradicting the new evidence-only admission paragraph. Shipped/project QA role clauses also still require all stage items to merge. Align these matching instructions with the evidence-only exception (rule16), preserving clause byte reserve and all actual code-landing/QA/platform requirements.","file":".agents/skills/qa/SKILL.md","line":27}]
finding_counts: {"high":0,"medium":1,"low":0}

Full audit complete at41ebc917/tree5acf1808. Standards M1medium: qa/SKILL.md:27 still says every listed stage item landed or BLOCKED despite new paragraph25 exception; shipped QA clause default-roles.ts:259/project clause likewise requires allstageitemsmerge. Align policy guidance compactly under rule16, retaining byte reserve and clean-dev/QA/platform/code-landing gates. No product Spec findings: conservative branchless closed-done/no-receipt/no-Item-trailer fallback, off-path shared history, old landed-stage hashes and all QA/cover paths preserved. T2 injected Git/fake-clock/public CLI tests and T3 empty-branch premature-QA migration appropriate. C1 failed for M1; C2 runtime pending. A-10383 local16T2+5T2+12T3/check narrative supporting only; preserve original stdout/exits/timings/source receipts without transcription reruns. Corrected-head review before mode-free verify; no per-itemQA requirement, noReviewer runtime. A-10385: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10385-t-421-source-review-at-41ebc917.md.

Criteria: C1 failed (QA checklist and shipped/project QA role clauses still require every member to have landed, blocking the new evidence-only after-stage path; align matching instructions under rule16.).

### impl-421 · 2026-10-24T07:38:13.525Z

M1 corrected in pushed head 76c1ba34efc3fc66cec30b9b8fbf94f41a4c45bf: QA execution checklist and shipped/project QA clause eligibility now match evidence-only completion. Three instruction-line replacements only; role clause byte use reduced, no added lines, tracker/test code unchanged from 41ebc917. Corrected-source local macOS npm run check and 27 T1 roles-clauses checks passed. Original runtime outputs retained without reruns in A-10394, original check in A-10395. Fresh source review requested before mode-free verification.

### rev-26 · 2026-10-24T07:38:39.509Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-421-source-2
commit: 76c1ba34efc3fc66cec30b9b8fbf94f41a4c45bf
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at76c1ba34/tree8ac5eb3c; M1resolved, no findings. Exactly3instructionlines: QA checklist and shipped/project QA stage clauses now accept defined evidence-only eligibility, shorter replacements/noaddedlines; clean-dev/currentSHA/QA independence/platform/code-landing gates retained. Tracker/tests unchanged from full audit A-10385; no devmerge. A-10394 original development-runtime16T2+5T2+12T3 output/exits/timings inspected, source-equivalent41ebc917 provenance retained; A-10395 priorcheck, A-10398 corrected-source check0/0lintrefusals + clause27/27, commands began on unchanged developmentfiles before commit. Supporting evidence not configured proof. C1/C2 await same-head mode-free settlement; no per-itemQA requirement orReviewer runtime. A-10399: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10399-t-421-corrected-source-at-76c1ba34.md.
