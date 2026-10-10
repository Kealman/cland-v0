---
id: T-192
kind: task
title: Layers on items, messages and artifacts; pins and mutes on topics, sessions and artifacts kept in ui.json
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-115
blocked_by:
  - T-190
topic: null
branch: null
created: 2026-10-10T16:25:06.507Z
updated: 2026-10-10T16:25:06.507Z
---

## Parent

T-115, slice 3 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

The items panel's filters as layers; messages older than 7 days archived; artifact lists by layer; pin and mute on topics, sessions and artifacts, kept in `ui.json`.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: the human mutes a noisy topic and pins a Reviewer, and both survive a restart.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
