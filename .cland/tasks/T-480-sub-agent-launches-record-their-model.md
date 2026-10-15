---
id: T-480
kind: task
title: Sub-agent launches record their model
state: open
status: in progress
size: XS
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-468
blocked_by: []
topic: topic-328
branch: t/T-480-sub-agent-launches-record-their-model
created: 2026-10-15T09:13:20.365Z
updated: 2026-10-15T20:57:30.179Z
---

## Summary

Retrospective A-2783, START 2: all 13 sub-agent launches have the model `unknown`. The SubagentStart hook record carries the model that the harness reports, or the requested one when the harness reports none.

## Acceptance criteria

- [ ] C1. A fake-harness sub-agent start with a model records it in the journal's subagent record, and `task view` usage lists it.
- [ ] C2. Without a model from the harness, the record says `unreported` rather than `unknown`.

## Comments

### impl-480 · 2026-10-15T20:57:30.179Z

Read E-468 and v0.1.3 / v0.1.2 instrumentation decisions. Existing session-model tests cover reported child models at the journal seam. Extending coverage to task-view usage and unreported fallback, keeping changes within T-480.
