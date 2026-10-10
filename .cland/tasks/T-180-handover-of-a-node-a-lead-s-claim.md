---
id: T-180
kind: task
title: "Handover of a node: a Lead's claim, subscriptions and note move to the next Lead"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-113
blocked_by:
  - T-176
  - T-177
topic: null
branch: null
created: 2026-10-10T15:38:36.547Z
updated: 2026-10-10T15:38:36.547Z
---

## Parent

T-113, slice 5 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

A node's lead claim moves with the handover note; claims and default subscriptions follow; the `handover` skill drafts a Lead's note.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: `lead-1` hands its epic to `lead-2` mid-way, and the next verdict's event reaches `lead-2`.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
