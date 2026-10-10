---
id: T-176
kind: task
title: "A Lead on an epic: the lead role, session.launch naming an epic gives its lead claim, only the Coordinator launches Leads"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-113
blocked_by: []
topic: null
branch: null
created: 2026-10-10T15:38:35.506Z
updated: 2026-10-10T15:38:43.430Z
---

## Parent

T-113, slice 1 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

The `lead` role in `roles.toml` and `cland init`; `session.launch` naming an epic gives the session that node's lead claim, one per node; only the Coordinator launches Leads; the panels show the Lead on its epic.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: the Coordinator launches `lead-1` on a v0.1 epic, and `@lead T-<epic>` reaches it.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
