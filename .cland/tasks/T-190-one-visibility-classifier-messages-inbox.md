---
id: T-190
kind: task
title: "One visibility classifier: messages, inbox events, sessions, items and artifacts placed by the default table, [visibility] overrides; thread, top bar and palette move onto it"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-115
blocked_by: []
topic: null
branch: null
created: 2026-10-10T16:25:05.955Z
updated: 2026-10-10T16:25:14.619Z
---

## Parent

T-115, slice 1 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

A module that places messages, inbox events, sessions, items and artifacts in a layer by the default table, overridable by `[visibility]`; the thread, the top bar and the palette move onto it.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: a project's `[visibility]` raises long idles to now, and the top bar counts them.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
