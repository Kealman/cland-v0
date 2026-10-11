---
id: T-208
kind: task
title: A suite report resolves a moved log artifact before reading or attaching it
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-115
blocked_by: []
topic: null
branch: null
created: 2026-10-11T01:44:33.392Z
updated: 2026-10-11T01:44:33.392Z
---

## What to build

Found by rev-13 in T-178's integration review (A-973, 2026-10-11), a defect between T-193 and T-203 on dev 1c2f5d6. `cland suite`'s checkpointed reporting reads and attaches the log through `store.artifact(id).path`. `artifact.move` (T-193) keeps a redirect entry but unlinks that path. If a recipient mute pauses publication after registration and the log is moved meanwhile, every retry after the unmute fails with ENOENT and the result is never published.

Resolve the artifact (following a moved redirect) before reading or attaching it, at each retry.

## Acceptance criteria

- [ ] A report whose log was moved into a folder after registration still publishes after the pause clears, attaching the moved file.
- [ ] A protocol test covers mute, then move, then unmute, then publication.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size XS. Edge case: a mute plus a move during one report's publication.
