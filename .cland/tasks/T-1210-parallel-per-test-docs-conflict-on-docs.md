---
id: T-1210
kind: task
title: Parallel per-test docs conflict on docs/agents/tests/index.md
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-942
branch: t/T-1210-parallel-per-test-docs-conflict-on-docs
created: 2026-10-24T08:09:00.298Z
updated: 2026-10-24T08:17:29.889Z
---

## Summary

Since T-1199 (356efd0e) every lane that adds a per-test doc also adds a line to docs/agents/tests/index.md. On 2026-10-24 that conflicted twice within an hour: T-421 against T-339/T-337, and T-1018 against T-1184. Each conflict costs a dev merge, a delta review and a fresh verify (about 15 minutes).

## Acceptance criteria

- [x] C1. Two branches that each add a different per-test doc and its index entry, or each extend the same per-test doc, merge without a conflict and the result passes C2 with no follow-up edit, shown with a scratch Git repository (test).
  - done: impl-1210 · 2026-10-24T08:16:04.099Z
- [x] C2. The test-docs check still fails when an index entry is missing or duplicated, or names a file that does not exist; entry order is not checked (test).
  - done: impl-1210 · 2026-10-24T08:16:04.556Z

## Comments

### coord · 2026-10-24T08:11:40.703Z

Scope note (coord, 08:12Z): the conflicts are not only index.md. Two branches that each add guidance for the same test file collide add/add on the per-test doc itself: T-542 against T-1184 (hub-test-merge-batches.test.ts.md) and T-421 (hub-test-planned-stage.test.ts.md); T-1018 against T-1184 the same way. C1 should cover both forms: index lines, and two branches each creating or extending the same per-test doc.

### impl-1210 · 2026-10-24T08:13:44.114Z

Chosen seams (launch brief): shipped .gitattributes exercised through native Git merge/rebase and cland's merge-tree command in a sealed scratch repository; pure index-membership validation for missing, duplicate and dangling entries. Coordinator removed the ordering constraint, so union output must pass membership validation without edits.

### rev-23 · 2026-10-24T08:17:29.889Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1210-source
commit: e4dc1f9fabdeb755c55c0921ec92ab687c58f9a9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1210 full source review — clear

Head e4dc1f9fabdeb755c55c0921ec92ab687c58f9a9; tree 9a2fc5a1ec1ab27cc9f648ef95d81bf9042b0306. Fixed incorporated dev base aafdc9a490d560bc97673d788ffa180943b5ff62; comparison git diff aafdc9a4...e4dc1f9f. Implementation d43e48dd precedes a first-review tracker-only merge: independently checked d43e48dd..e4dc1f9f contains only five .cland/tasks files. Run rev-20261024-1210-source. Both Standards and Spec reviewed in-session, no subagents.

Standards: clear, no findings. The merge policy is tracked and narrowly scoped to /docs/agents/tests/*.md, leaving shared tests.md and other repository content on normal merge behavior. The helper extracts the same Notes targets as the pre-existing guard and compares sorted multisets; it neither deduplicates nor weakens source/header/link/anchor checks. T1 literal fixtures cover both row orders and missing, duplicate and nonexistent targets. The T3 tier remains appropriate because native Git merge/rebase/object merge behavior is the subject. Every command runs under the shared credential-filtered fixtureEnvironment in a disposable root with scratch HOME/XDG/Git settings; hooks/signing are disabled, execFile has a 5 s bound, each promise is awaited, and scratch removal occurs only in the after-hook following command completion. There is no hub, browser, compiler or installer. Test-specific and shared guidance match the change; no tier or budget relaxation. Diff whitespace check passes.

Spec: clear, no findings. Coordinator a876ec40-0f10-4e4f-9188-3e8b60252369 explicitly makes index order insignificant and requires union output to pass one-to-one membership without edits. The tracked built-in union driver covers index and shared per-test guidance. Three native scenarios copy the shipped attributes at the real documentation paths, branch from the same base, independently add distinct documents/index rows, both add the same new guidance document and both append to an existing document. Merge, rebase, and cland's exact merge-tree --write-tree --name-only -z command must succeed. The object-merge result is installed without editing, then the same membership helper validates the actual directory/index. Final assertions retain both branches' independent and shared-new/existing paragraphs. Existing source/link/header/historical-anchor guard remains. Documentation explicitly states union retains overlapping advice from both sides and source review checks the combined meaning; no automatic semantic reconciliation is promised.

C1 source design matches the required native seam and all conflict forms; C2 preserves missing/duplicate/dangling rejection with order ignored. Both runtime criteria remain pending same-head configured evidence plus the local T3 receipts; this is source clearance only.

A-10502 reports local macOS implementation-tree red/green: without attributes all three modes produced content/add-add conflicts, with attributes the seven tests pass (three T1 guard cases and four T3 merge cases). npm run check passed at the pre-tracker-merge source tree d43e48dd, report-only lint/no refusals. The later merge is tracker-only, as independently confirmed; these remain explicitly attributed pre-merge local receipts, not Linux or a full task-suite claim. Original stdout/native exits/timings/source/platform/cleanup attribution have been requested for durable retention from existing tool records without transcription reruns. No configured result yet. A fresh mode-free run may follow at exact e4dc1f9f.

QA policy none/after-stage, no QA criteria. Reviewer performed static source/Git/artifact inspection only: no tests/probes, native Git mutation, browser, edits, merge or delegation. Standards zero findings; Spec zero findings. Findings [].
Durable review A-10505.
