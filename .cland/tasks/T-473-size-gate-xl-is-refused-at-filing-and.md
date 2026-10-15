---
id: T-473
kind: task
title: "Size gate: XL is refused at filing, and plan-epic splits L tasks into 2–3 M tasks unless the Coordinator records a reason"
state: open
status: in progress
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-423
blocked_by: []
topic: topic-314
branch: t/T-473-size-gate-xl-is-refused-at-filing-and
created: 2026-10-15T09:13:17.633Z
updated: 2026-10-15T18:23:17.019Z
---

## Summary

Retrospective A-2783, START 1: L tasks had a first-pass yield of 2 of 10 and carried 8 of 17 escapes. XL is never filed, and an L task enters a plan only with a recorded reason, or as 2–3 M tasks.

## What to build

- `task create` and `task edit` refuse `--size XL` with a message to split the task.
- `task plan set` warns, through a refusal unless `--allow-large <id>=<reason>` is given, for each L task in the plan.
- The reason is recorded in the plan history.
- The to-tickets and plan-epic skills say to split L tasks into 2–3 M slices.

## Acceptance criteria

- [ ] C1. `task create --size XL` and `task edit --size XL` are refused with the split message.
- [ ] C2. `task plan set` with an L task is refused without `--allow-large`, and with it the reason is in the plan history.
- [ ] C3. The to-tickets and plan-epic skills describe the split rule.

## Comments

### impl-473 · 2026-10-15T18:23:17.019Z

Implementation: XL assignments refused in tracker create/edit while legacy files remain readable. Plan set accepts repeatable CLI --allow-large id=reason and MCP allow_large mapping; it requires a non-empty reason for each L lane task and appends canonical item/reason decisions to existing journal-backed plan history. Coverage uses the existing CLI, frame and MCP seams, including refusal atomicity and history restoration.
