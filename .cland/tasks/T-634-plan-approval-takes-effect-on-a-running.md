---
id: T-634
kind: task
title: plan.approval takes effect on a running hub, without a restart
state: open
status: planned
size: S
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by:
  - T-633
topic: null
branch: null
created: 2026-10-16T16:04:12.357Z
updated: 2026-10-16T16:04:29.059Z
---

## Summary

The onboarding records "I approve epic plans" while the hub already runs, and the Aide cannot restart it, yet today a change of `[plan] approval` needs a hub restart. A value set with `cland config set`, or edited by hand and loaded with `cland hub reload`, governs the next launch for an epic at once.

## What to build

- The hub's config reload applies `plan.approval` to the plan-approval gate instead of answering "plan changed: restart required"; `plan.qa_default` and the other keys that need a restart keep that answer.
- `cland config set plan.approval …` applies the value at once and says so.
- The gate reads the value at each launch: with `human`, a launch for an epic whose current plan the human or an Aide has not approved is refused with "awaiting human plan approval", whether the plan was set before or after the change; with `none`, it goes through.
- The reload's applied list names `plan.approval`.

## Acceptance criteria

- [ ] C1. After `cland config set plan.approval human` on a running hub, a launch for an epic with an unapproved plan is refused with "awaiting human plan approval", without a hub restart (frame-protocol test).
- [ ] C2. Setting it back to `none` lets the same launch through, again without a restart.
- [ ] C3. `cland hub reload` after a hand edit of `plan.approval` applies it and its applied list names it, while a change of `plan.qa_default` still answers restart required (config reload test).
