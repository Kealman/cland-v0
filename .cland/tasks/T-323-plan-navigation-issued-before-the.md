---
id: T-323
kind: task
title: Plan navigation issued before the initial task and ladder snapshots is discarded instead of deferred
state: open
status: backlog
labels:
  - needs-triage
  - nvim
assignee: null
parent: E-216
blocked_by: []
topic: null
branch: null
created: 2026-10-13T10:43:14.266Z
updated: 2026-10-13T10:43:14.266Z
---

## Summary

Right after the workbench connects, a plan navigation can be lost. `gp` or `:Cland view plan T-n` issued before the task list and the ladder snapshots arrive is refused with "gp: select an epic or an item in an epic". When the snapshots arrive, the plan is not reopened. Found by impl-317 on 2026-10-13 while fixing the plan.test.ts flake (T-292's case).

## Evidence

- After the hub announces connected, the `task.list` and `hub.status` tracker snapshots can still be pending.
- `gp` and `:Cland view plan T-2` call `plan.owner` synchronously. When the task or the ladder is absent, the command says "gp: select an epic or an item in an epic" and discards the navigation.
- A controlled replay with the stub hub's held `hub.status` confirms it, even when T-2 is already in the task snapshot. The owner is nil before the release and T-2 afterwards, but the plan stays unopened.

## What to build

Keep or defer the requested navigation until its task and ladder preconditions settle, then open it. If they settle without the item, say so. Cover it with a Neovim headless test on the stub hub that delays the initial snapshots.

## Acceptance criteria

- [ ] C1. `gp` and `:Cland view plan <id>` issued before the initial snapshots open the plan once they arrive, or report clearly that the item is not an epic or in one.
- [ ] C2. A headless test on the stub hub with delayed `hub.status` and `task.list` covers both outcomes.
