---
id: T-188
kind: task
title: "The plan view mid-way: closed and open stages, change marks in the watch colour, S2 tags on item rows"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-114
blocked_by:
  - T-187
  - T-185
  - T-186
topic: null
branch: null
created: 2026-10-10T15:38:38.467Z
updated: 2026-10-10T15:38:38.467Z
---

## Parent

T-114, slice 6 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

Closed stages' marks and QA runs, the stage in work with its sessions, dimmed planned stages, change marks until the human opens the view, the right column, and the "S2" tag on the items panel's rows.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: a lead moves an item between stages; the view marks the move in the watch colour with its reason until the human looks.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
