---
id: T-878
kind: task
title: issue-tracker doc claims task.list summaries carry every frontmatter field, but github is omitted
state: open
status: in progress
size: XS
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: t/T-878-issue-tracker-doc-claims-task-list
created: 2026-10-19T14:41:41.049Z
updated: 2026-10-19T15:28:24.108Z
---

## Summary

docs/agents/issue-tracker.md says `task.list` summaries carry every frontmatter field. `ItemSummary`/`IndexedItem` omit `github`, though; only `task.view` includes it. impl-857 found this on 2026-10-19 while writing T-857 C3.

## Acceptance criteria

- [ ] C1. The doc names the fields that list summaries omit (at least `github`), or summaries include `github`. A test pins whichever behaviour is chosen.
