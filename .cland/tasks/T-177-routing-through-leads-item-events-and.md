---
id: T-177
kind: task
title: "Routing through Leads: item events and reports climb through Leads; Leads hold their subtree's default subscriptions"
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
created: 2026-10-10T15:38:35.781Z
updated: 2026-10-10T15:38:35.781Z
---

## Parent

T-113, slice 2 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

Events and reports about an item climb the chain through Leads; Lead sessions get the default subscription to their subtree, less the subtrees with their own lead; idle and death notices reach them.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: an Implementer's "blocked" report under the epic reaches `lead-1`, not the Coordinator.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
