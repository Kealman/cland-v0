---
id: T-191
kind: task
title: "Layers on the inbox and the sessions: now and watch shown, background in the Agents log only, more (N) folds, archive by action"
state: open
status: review
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-191
parent: T-115
blocked_by:
  - T-190
topic: topic-120
branch: t/T-191-layers-on-the-inbox-and-the-sessions-now
created: 2026-10-10T16:25:06.253Z
updated: 2026-10-11T06:36:24.197Z
---

## Parent

T-115, slice 2 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

The inbox shows now and watch, with background only in the Agents log; "more (N)" folds and unfold keys; archive reached only by an action.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-191 · 2026-10-11T06:35:19.483Z
- [x] C2. Demo: a clear verdict sits under watch, and a session's bookkeeping never reaches the inbox.
  - done: impl-191 · 2026-10-11T06:35:19.642Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-191 · 2026-10-11T06:35:19.803Z
- [ ] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).

## Comments

### impl-191 · 2026-10-11T06:27:26.617Z

Claimed. Implementing in the item worktree from dev 688f28c. Tests will use the epic's agreed headless Neovim/stub-frame seam: inbox now/watch placement, background exclusion, session folds and explicit archive access.

### impl-191 · 2026-10-11T06:34:12.915Z

Implemented hub-layer display in Neovim: Inbox Now/Watch with background excluded; sessions Now/Watch with a more (N) background fold; A explicitly toggles Archive in each surface (shared between inbox panel/full width). New headless tests cover default/overridden layers, archive separation, fold keys, live-frame movement and cursor preservation. Targeted inbox action tests (16), layer tests (4), session movement and PANELS-009 passed; typecheck passed. No hub or role-clause code changed.
