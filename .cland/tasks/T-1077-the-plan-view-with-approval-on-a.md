---
id: T-1077
kind: task
title: The Plan view with approval on a
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1075
  - T-1054
topic: topic-843
branch: t/T-1077-the-plan-view-with-approval-on-a
created: 2026-10-21T17:32:16.973Z
updated: 2026-10-22T10:22:40.074Z
---

## Summary

The Plan view of the selected epic, with its changes since the human's last look and approval on `a` at desktop width.

## Parent

E-416 (v0.1 §3.13, §3.6; tracer step 6).

## What to build

The Plan view shows the selected epic's plan: its stages, lanes and QA policy, what starts and closes each stage, and the right column. The changes since the human's last look (the per-human plan marks of T-1054) show in the watch colour. `a` approves a plan waiting under `[plan] approval = "human"` at desktop width only, and `d` writes to the Lead in the epic's topic. There is no plan editing. `nvim/lua/cland/plan.lua` defines the behaviour.

## Acceptance criteria

- [ ] C1. In a scratch project with `[plan] approval = "human"`, `a` in the Plan view approves a waiting plan, and `cland task plan show` reads it approved by the human (Web test).
- [ ] C2. A plan change made after the human's last look shows in the watch colour, and opening the view moves the plan's mark (Web test).
- [ ] C3. Below desktop width `a` is not offered (Web test).
