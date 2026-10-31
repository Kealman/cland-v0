---
id: T-1486
kind: task
title: Switch hub-confirmed disjoint merge deltas from report to enforce
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by:
  - T-1529
topic: topic-1282
branch: t/T-1486-switch-hub-confirmed-disjoint-merge
created: 2026-10-30T12:38:27.084Z
updated: 2026-10-31T17:22:41.978Z
---

## Summary

T-1462 records a hub delta assessment for every conflict-free dev merge in report-only mode, while the Reviewer's merge-delta verdict stays required (rule 27; the implementer showed that disjoint paths do not prove independent behaviour, since a branch test can import a module dev changed). This item switches the assessment to enforce, letting a disjoint assessment stand in for the Reviewer, once the recorded assessments show which merges it would have waved through.

## Acceptance criteria

- [ ] C1. One artifact replays every T-1462 assessment recorded since its landing against the Reviewer verdicts on the same merges, and lists each disjoint assessment whose merge a Reviewer found not clear, with its cause.
- [ ] C2. The enforce switch lets a disjoint assessment replace the Reviewer's merge-delta verdict only under the dependency rule the replay supports, and every other merge still needs the Reviewer.

## Comments

### impl-1486 · 2026-10-31T17:22:28.570Z

Coordinator narrowed scope to diagnosis only (dacc2a1e, topic-1282). Published A-15012, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15012-t-1486-merge-delta-census-native-exclusions-and-report-only-redesign. Census: 1,527 tracker files/17,907,994 streamed bytes, zero assessment comments; 16 post-landing Reviewer delta heads, 14 two-parent native merge conflicts and two one-parent corrections, zero opportunities under current clean-merge precondition. T-1503 8054bba9 specifically returns null at merge-delta.ts:25 after merge-tree exit1 for implement SKILL.md conflict; no evidence of writer failure. Existing durable-comment positive control passed1/1 local macOS at2679c052c, isolated native Git/public task.view/no browser; no suites/typecheck/lint/configured verify. Artifact retains exact-head native receipts, original output and report-only redesign proposal. No production source/enforce changes. C2 deferred pending real assessment evidence; Coordinator will move item to Follow-ups and file redesign.
