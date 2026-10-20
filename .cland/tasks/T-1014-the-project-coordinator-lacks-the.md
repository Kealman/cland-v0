---
id: T-1014
kind: task
title: The project Coordinator lacks the publish tool its clause and the release skill tell it to use
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-20T17:18:37.093Z
updated: 2026-10-20T17:18:37.093Z
---

## Summary

The project's `.cland/roles.toml` Coordinator `tools` list lacks `publish`, while the shipped default role (hub/src/roles/default-roles.ts) and the `release` skill give the Coordinator `cland publish`. On 2026-10-20 17:20Z the approved build-log publication (T-1013, ask 05653d30) was refused: "forbidden: publish (Coordinator may not use publish)".

## What to build

The human decides whether the Coordinator may publish. If yes, add `publish` to the project Coordinator tools; either way, make the shipped docs and the project config agree, and have `cland doctor` (or the roles snapshot test) flag a project role that lacks a tool its own clause tells it to use.

## Acceptance criteria

- [ ] C1. The project Coordinator tools and the release skill agree on who runs `cland publish` (human decision recorded on this item).
- [ ] C2. A check reports a role whose clause names a hub action its tool list does not grant (test).
