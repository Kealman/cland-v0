---
id: T-181
kind: task
title: "The crew file: .cland/crew.toml, validated and reloaded, cland crew show and set, the sessions header summary"
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
created: 2026-10-10T15:38:36.819Z
updated: 2026-10-10T15:38:43.705Z
---

## Parent

T-113, slice 6 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

`.cland/crew.toml` with its shape and validation; reload on change, a broken file refused with a notice and the last good version kept; `cland crew show` and `cland crew set`; `cland init` defaults; the sessions panel header's summary.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: `cland crew set reviewer.size 2` and the header reads "rev pool 2".
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
