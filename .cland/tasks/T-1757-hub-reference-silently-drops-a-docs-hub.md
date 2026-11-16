---
id: T-1757
kind: task
title: Hub reference silently drops a docs/hub index entry whose line carries a description
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1887
blocked_by: []
topic: null
branch: null
created: 2026-11-07T16:15:56.538Z
updated: 2026-11-16T07:31:21.983Z
---

## Summary

`shared/hub-reference.ts` recognises a `docs/hub/` index entry in `hub/README.md` only when the line is a bare pointer. Adding a description to the line silently drops that document's content from the hub reference (`hubProcedures`). Nothing fails at the edit; only an unrelated clause-wording test notices later.

## Evidence

Found by impl-1739 during T-1739. A descriptive suffix on the Roles index line removed all of `docs/hub/roles.md` from the reference. The two `roles-clauses.test.ts` "aide: shipped clause wording" tests failed at its head and passed on dev 79b350ec. The strict pointer form was restored on the task branch.

## Acceptance criteria

- [ ] C1. Either every `docs/hub/` link in the README index is resolved whatever trails it on the line, or a T0 check refuses an index line the reader would skip, naming the line.
- [ ] C2. A test adds a described index line and shows the chosen behaviour, red first against the current reader.
