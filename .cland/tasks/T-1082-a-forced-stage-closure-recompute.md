---
id: T-1082
kind: task
title: A forced stage-closure recompute resolves ancestry for every historical cover candidate
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-21T19:04:23.933Z
updated: 2026-10-21T19:04:23.933Z
---

## Summary

When a hub has to recompute stage closures without saved checkpoints, it resolves ancestry for every historical stage-cover candidate: about 1,200 `rev-parse` and 1,219 `merge-base` calls, taking about 63 s on a copied live tracker after T-1050 removed the demo diff-tree scans (impl-1050's diagnostic, 2026-10-21). Normal restarts use saved checkpoints and are not affected. A lost or invalidated checkpoint store, however, would hold stage covers pending for about a minute.

## Acceptance criteria

- [ ] C1. A forced closure recompute on a copied live tracker resolves only the candidates that can still decide an open stage, and completes in under 10 s, measured in the test.
- [ ] C2. Closed stages keep their recorded closures, and no open stage's result changes, in a differential test against the current full recompute.
