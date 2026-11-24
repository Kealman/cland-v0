---
id: T-1978
kind: task
title: Non-move prepared file commits lack the committing-phase re-entry guard, so recommitting an unknown operation can erase its committing plan
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: null
branch: null
created: 2026-11-18T13:21:59.090Z
updated: 2026-11-24T09:01:19.418Z
---

## Summary

Found by impl-1672 while fixing T-1672 (2026-11-18), pre-existing. A production PreparedOperations control showed that recommitting an operation whose outcome was unknown could erase its committing plan after the directory fence rejected it. T-1672 added a same-token guard before the effect, but only for `moveDirectory`. The source shows other prepared file commits (writes, truncates, appends) with the same missing committing-phase re-entry guard.

## What to build

Apply the same-token committing-phase guard to every prepared file commit, so an unknown operation's committing plan survives a recommit attempt that the fence rejects, and the operation stays pending and is never replayed.

## Acceptance criteria

- [ ] C1. For each prepared file operation kind, an unknown outcome followed by a rejected recommit keeps its committing plan and stays pending without replay, across a fresh owner start (test with fakes).
- [ ] C2. Every PreparedOperations commit kind and its callers are listed with their disposition (rule 41).
