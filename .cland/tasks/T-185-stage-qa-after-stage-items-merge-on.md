---
id: T-185
kind: task
title: "Stage QA: after-stage items merge on review; one QA run on dev closes the stage with a verdict naming it"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-114
blocked_by:
  - T-184
topic: null
branch: null
created: 2026-10-10T15:38:37.751Z
updated: 2026-10-10T15:38:37.751Z
---

## Parent

T-114, slice 3 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

After-stage items merge on review alone; one QA run on `dev` closes the stage with a verdict on the epic naming the stage; a not-clear stage verdict keeps the stage open; the `qa` skill writes a stage brief.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: three items merge on review, then one QA run closes stage 1.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
