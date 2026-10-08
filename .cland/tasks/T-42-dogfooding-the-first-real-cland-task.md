---
id: T-42
kind: task
title: "Dogfooding: the first real cland task inside cland"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-31
  - T-33
  - T-34
  - T-36
  - T-38
  - T-40
  - T-41
topic: null
branch: null
created: 2026-10-08T11:55:56Z
updated: 2026-10-08T13:17:15.607Z
github:
  repo: Kealman/cland-v0
  number: 42
  url: https://github.com/Kealman/cland-v0/issues/42
---

## Parent

Part of #19. Spec section 6 (definition of done); decision https://github.com/Kealman/cland-v0/issues/18.

## What to build

Slice 1 is done when the human runs a real task of the cland project itself inside cland: the Coordinator in Claude Code, an Implementer in OpenCode, Reviewer and QA in Codex, the conversation through topics with at least one ask answered from the inbox, the item taken from `.cland/tasks` (after the migration), a review and a QA verdict written through the roles, and the result merged by today's git flow (the territory arrives in slice 2). Everything that blocks the run is fixed in this ticket or filed as a new item; the run, its findings and the time it took are recorded here. From this point on cland is built with cland.

## Acceptance criteria

- [ ] One real item of the cland project is taken from claim to verdicts entirely inside cland, with the three harnesses in their roles
- [ ] At least one ask was raised by the Coordinator and answered from the inbox; at least one role handover or reconnect happened without losing the thread
- [ ] Every blocker found is either fixed in this ticket or filed as an item with a link here
- [ ] The human confirms in a comment that cland replaced the previous set of tools for that task
