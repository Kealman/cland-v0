---
id: T-1679
kind: task
title: Session recovery resumes by name from a stale snapshot and can resume a renamed or replaced session
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-04T15:48:11.031Z
updated: 2026-11-04T15:48:11.031Z
---

## Summary

Found by the T-1612 reviewer and reported by impl-1612 (2026-11-04). It is pre-existing and non-blocking for T-1612. `resumeHost` (formerly `resumeAll`) snapshots the detached ProcessTable rows, then later resumes each by `p.name`. While an earlier row is held, a later row can be renamed and its old name reused. Recovery may then resume the replacement, possibly on another host, and miss the captured session.

## What to build

Recovery keys each step on the captured session id. Before resuming, it re-reads the row by that id and revalidates host, status and pending-stop. A row that was renamed, replaced or moved is skipped and reported, never resumed under the old name.

## Acceptance criteria

- [ ] C1. A rename plus name reuse between snapshot and resume resumes only the captured session id, and never the replacement (test).
- [ ] C2. A row whose host, status or pending-stop changed since the snapshot is not resumed and is reported (test).
