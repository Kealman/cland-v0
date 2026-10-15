---
id: T-478
kind: task
title: found_by on regressions and answered_as on ask answers
state: open
status: backlog
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-468
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:13:19.908Z
updated: 2026-10-15T09:13:19.908Z
---

## Summary

Retrospective A-2783, START 2: escapes could not be attributed to where they were caught, and the human's answers could not be told apart from the stand-in's.

## What to build

- **`found_by`.** An item with `regression_of` takes `found_by`, one of review, cover, droplet, qa or human, through `task create`/`task edit` and the tools.
- **`answered_as`.** An ask's answer records `answered_as`: human, or stand-in with its session name. It is set from the answering client's identity, and the stand-in's relay is marked.
- **Where they appear.** Both are shown in `task view` and the journal.

## Acceptance criteria

- [ ] C1. `task create --regression-of T-n --found-by cover` stores and shows found_by, and a value outside the set is refused.
- [ ] C2. An ask answered from the human's shell records `answered_as: human`, and one answered by a named stand-in records `stand-in` with its name.
- [ ] C3. hub/README.md describes both fields.
