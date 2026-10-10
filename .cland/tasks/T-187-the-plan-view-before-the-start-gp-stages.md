---
id: T-187
kind: task
title: "The plan view before the start: gp, stages with lanes as columns, QA lines, the approval card"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-114
blocked_by:
  - T-183
topic: null
branch: null
created: 2026-10-10T15:38:38.260Z
updated: 2026-10-10T15:38:38.260Z
---

## Parent

T-114, slice 5 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

`gp`, the header, the stage boxes with lanes as columns, the QA lines, the start and close lines, the approval card with `a`, `d` and `e`, the right column, and the items panel filtered to the epic with stage tags.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: the human opens `gp` on an epic that has not started and approves it with `a`.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
