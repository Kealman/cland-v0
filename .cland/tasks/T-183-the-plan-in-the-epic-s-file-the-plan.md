---
id: T-183
kind: task
title: "The plan in the epic's file: the ## Plan YAML block, task.plan set and show, validation, journalled changes"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-114
blocked_by: []
topic: null
branch: null
created: 2026-10-10T15:38:37.301Z
updated: 2026-10-10T15:38:43.933Z
---

## Parent

T-114, slice 1 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

The `## Plan` YAML block and its validation; `task.plan set` and `show`, `cland task plan`; a broken plan refused with the previous one kept; the plan in `task view --json`; changes journalled.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: `cland task plan set T-<epic> --file plan.yaml` writes a two-stage plan, and a broken one is refused with the reason.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
