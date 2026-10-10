---
id: T-191
kind: task
title: "Layers on the inbox and the sessions: now and watch shown, background in the Agents log only, more (N) folds, archive by action"
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
created: 2026-10-10T16:25:06.253Z
updated: 2026-10-10T16:25:06.253Z
---

## Parent

T-115, slice 2 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

The inbox shows now and watch, with background only in the Agents log; "more (N)" folds and unfold keys; archive reached only by an action.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: a clear verdict sits under watch, and a session's bookkeeping never reaches the inbox.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
