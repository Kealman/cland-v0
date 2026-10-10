---
id: T-194
kind: task
title: "The artifact CLI: cland artifact new, open, keep, move, archive and promote, a folder promoted into the repository"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-115
blocked_by:
  - T-193
topic: null
branch: null
created: 2026-10-10T16:25:06.974Z
updated: 2026-10-10T16:25:06.974Z
---

## Parent

T-115, slice 5 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

`cland artifact new | open | keep | move | archive | promote`, including promoting a folder into the repository.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: the human creates a folder artifact from the shell and promotes it into `docs/`.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
