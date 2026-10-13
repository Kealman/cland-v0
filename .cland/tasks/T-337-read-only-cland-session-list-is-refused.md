---
id: T-337
kind: task
title: Read-only cland session list is refused for Implementers as session.launch
state: open
status: backlog
labels:
  - needs-triage
  - hub
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-13T14:43:31.707Z
updated: 2026-10-13T14:43:31.707Z
---

## Summary

An Implementer's read-only `cland session list --json` from its own session shell is refused as `session.launch` ("Implementer may not use session.launch"). Reading the session list launches nothing, so the permission check maps the read to the wrong tool. impl-333 hit it on 2026-10-13 when it looked up its own launched model for a commit trailer.

## What to build

- Map `session.list` and the CLI's `cland session list` to a read permission that every role holds, as `who` is. Keep `session.launch`, `stop`, `resume`, `archive` and `prune` gated as now.
- A permission test that an Implementer's shell can list sessions and still cannot launch one.

## Acceptance criteria

- [ ] C1. `cland session list` and `--json` succeed from an Implementer's shell, and `cland session launch` from the same shell is still refused.
- [ ] C2. The permission table names the read separately, with a test.
