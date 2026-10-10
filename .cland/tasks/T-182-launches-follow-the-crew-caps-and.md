---
id: T-182
kind: task
title: "Launches follow the crew: caps and singletons, idle pool reuse, per-item stop after merge, subagents in clauses"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-113
blocked_by:
  - T-176
  - T-181
topic: null
branch: null
created: 2026-10-10T15:38:37.088Z
updated: 2026-10-10T15:38:37.088Z
---

## Parent

T-113, slice 7 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

Caps and singletons enforced by `session.launch`; an idle pool member returned for a `keep_context` pool; `per-item` sessions stopped after their merge; `subagents` in the role clauses; the Coordinator's clause launches Leads for the levels in `leads`.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: a review request while a Reviewer is idle reuses it; a third Reviewer launch with `size = 2` is refused.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
