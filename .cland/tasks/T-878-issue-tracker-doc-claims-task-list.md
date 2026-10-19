---
id: T-878
kind: task
title: issue-tracker doc claims task.list summaries carry every frontmatter field, but github is omitted
state: open
status: review
size: XS
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-609
branch: t/T-878-issue-tracker-doc-claims-task-list
created: 2026-10-19T14:41:41.049Z
updated: 2026-10-19T15:30:55.602Z
---

## Summary

docs/agents/issue-tracker.md says `task.list` summaries carry every frontmatter field. `ItemSummary`/`IndexedItem` omit `github`, though; only `task.view` includes it. impl-857 found this on 2026-10-19 while writing T-857 C3.

## Acceptance criteria

- [ ] C1. The doc names the fields that list summaries omit (at least `github`), or summaries include `github`. A test pins whichever behaviour is chosen.

## Comments

### impl-878 · 2026-10-19T15:28:46.296Z

Implementing C1 as a documentation correction, preserving list summaries' existing omission of GitHub import metadata. Auditing the other omitted frontmatter fields and adding a focused regression at the tracker list/view boundary.

### rev-30 · 2026-10-19T15:30:55.602Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-878-source
commit: 58ded8afa0ffa77ef6d2e6b839a22fbe13e67790
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6152. Documentation names github/criterion_seq/plan_approval and body/comments omissions, consistent with IndexedItem/list versus full source-frontmatter view. New T1 regression populates and proves all three values in view before asserting five own-property omissions from a nonempty identified list row. FakeClock/in-memory index/injected Git, cleanup stops tracker before removal; no process/socket/wait. No production change or findings. A-6151 reports 1/1 .180 s file and host checks green. Final C1 awaits normal same-head mode-free gate; no Reviewer execution.
