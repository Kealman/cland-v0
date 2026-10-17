---
id: T-753
kind: task
title: Retag the three native-Git contract test files to T3 with lifecycle headers
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: null
branch: null
created: 2026-10-17T18:44:08.907Z
updated: 2026-10-17T18:44:08.907Z
---

## Summary

Route R3 in T-748's trip list (A-4703): duration-legacy, init and merge-policy test real Git, immutable-tree and repository boundaries but are tagged T2. Retag them T3 with `// T3: <behaviour>` headers. Pure cases inside them can move down later.

## Acceptance criteria

- [ ] C1. The three files are T3 with lifecycle headers, test:tiers and test:lint pass, and the runtime tripwire no longer lists them.
