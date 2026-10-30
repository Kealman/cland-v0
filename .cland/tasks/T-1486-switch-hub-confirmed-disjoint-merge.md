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
blocked_by: []
topic: null
branch: null
created: 2026-10-30T12:38:27.084Z
updated: 2026-10-30T12:38:27.084Z
---

## Summary

T-1462 records a hub delta assessment for every conflict-free dev merge in report-only mode, while the Reviewer's merge-delta verdict stays required (rule 27; the implementer showed that disjoint paths do not prove independent behaviour, since a branch test can import a module dev changed). This item switches the assessment to enforce, letting a disjoint assessment stand in for the Reviewer, once the recorded assessments show which merges it would have waved through.

## Acceptance criteria

- [ ] C1. One artifact replays every T-1462 assessment recorded since its landing against the Reviewer verdicts on the same merges, and lists each disjoint assessment whose merge a Reviewer found not clear, with its cause.
- [ ] C2. The enforce switch lets a disjoint assessment replace the Reviewer's merge-delta verdict only under the dependency rule the replay supports, and every other merge still needs the Reviewer.
