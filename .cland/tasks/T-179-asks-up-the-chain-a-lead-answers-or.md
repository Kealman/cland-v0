---
id: T-179
kind: task
title: "Asks up the chain: a lead answers or forwards an ask one level up; only the root's lead asks the human"
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
created: 2026-10-10T15:38:36.263Z
updated: 2026-10-10T15:38:36.263Z
---

## Parent

T-113, slice 4 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

A lead answers an ask from below or forwards it unchanged with one call; only the root's lead asks the human; the topic waits on the right party at each step.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: an Implementer's question goes to `lead-1`, which forwards it; the Coordinator turns it into an ask for the human.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
