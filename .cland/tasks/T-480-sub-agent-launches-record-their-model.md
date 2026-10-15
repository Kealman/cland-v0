---
id: T-480
kind: task
title: Sub-agent launches record their model
state: open
status: backlog
size: XS
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-468
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:13:20.365Z
updated: 2026-10-15T09:13:20.365Z
---

## Summary

Retrospective A-2783, START 2: all 13 sub-agent launches have the model `unknown`. The SubagentStart hook record carries the model that the harness reports, or the requested one when the harness reports none.

## Acceptance criteria

- [ ] C1. A fake-harness sub-agent start with a model records it in the journal's subagent record, and `task view` usage lists it.
- [ ] C2. Without a model from the harness, the record says `unreported` rather than `unknown`.
