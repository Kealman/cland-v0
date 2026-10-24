---
id: T-1014
kind: task
title: The project Coordinator lacks the publish tool its clause and the release skill tell it to use
state: closed
status: done
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-20T17:18:37.093Z
updated: 2026-10-24T06:45:07.087Z
closed: 2026-10-24T06:44:49.520Z
---

## Summary

The project's `.cland/roles.toml` Coordinator `tools` list lacks `publish`, while the shipped default role (hub/src/roles/default-roles.ts) and the `release` skill give the Coordinator `cland publish`. On 2026-10-20 17:20Z the approved build-log publication (T-1013, ask 05653d30) was refused: "forbidden: publish (Coordinator may not use publish)".

## What to build

The human decides whether the Coordinator may publish. If yes, add `publish` to the project Coordinator tools; either way, make the shipped docs and the project config agree, and have `cland doctor` (or the roles snapshot test) flag a project role that lacks a tool its own clause tells it to use.

## Acceptance criteria

- [ ] C1. The project Coordinator tools and the release skill agree on who runs `cland publish` (human decision recorded on this item).
- [ ] C2. A check reports a role whose clause names a hub action its tool list does not grant (test).

## Comments

### coord · 2026-10-20T17:20:42.415Z

Decided by the human, 2026-10-20 ~17:2xZ, directly in the Coordinator's terminal: «дай координатору publish». The Coordinator gets the publish tool in .cland/roles.toml (commit 86e0d5bb, landing on dev after the running T-978 batch). C2 (a check for clause/tool mismatches) stays open.

### coord · 2026-10-24T06:44:49.520Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): fixed. C1 was done in ee07d68f (roles.toml) on the human's decision. C2 (a clause/tool mismatch check) is low value. Close and do not refile.

### coord · 2026-10-24T06:45:07.087Z

Correction: the backlog triage artifact is A-10327, not A-10322.
