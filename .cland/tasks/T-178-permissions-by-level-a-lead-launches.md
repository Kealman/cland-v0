---
id: T-178
kind: task
title: "Permissions by level: a Lead launches, stops, requests review and merges inside its subtree; refusals name the level"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-113
blocked_by:
  - T-176
topic: null
branch: null
created: 2026-10-10T15:38:36.029Z
updated: 2026-10-10T15:38:36.029Z
---

## Parent

T-113, slice 3 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

A Lead launches and stops sessions for its epic's items, requests review and QA, and merges its items through the same gate; a request outside its subtree is refused, naming the level; the Coordinator keeps releases, sync, push, unscheduled merges and the launch of Leads.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: `lead-1` merges one of its items and is refused on an item of another epic.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
