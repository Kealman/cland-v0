---
id: T-186
kind: task
title: "The plan-epic skill and approval: drafting a plan, [plan] approval, task.plan approve, per-group lanes"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-114
blocked_by:
  - T-183
topic: null
branch: null
created: 2026-10-10T15:38:38.001Z
updated: 2026-10-10T15:38:38.001Z
---

## Parent

T-114, slice 4 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

The skill drafts a plan from the epic's tickets, their blocking edges and criteria, and the crew, and sets it; `[plan] approval`; `task.plan approve` by the human or an Aide; the clauses follow the stage order; `per-group` gives one session per lane.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: `plan-epic` on an epic yields a valid plan; with `approval = "human"`, nothing launches until it is approved.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
