---
id: Q-100
kind: question
title: Epic plan view on the canvas
state: closed
labels:
  - wayfinder:prototype
assignee: null
parent: M-81
blocked_by:
  - Q-96
topic: null
branch: null
created: 2026-10-09T19:09:51.691Z
updated: 2026-10-09T21:01:56.083Z
closed: 2026-10-09T21:01:56.090Z
---

## Question

How does the human read an epic plan in the workbench: which view shows stages, lanes, QA policy, groups and progress against the plan, and where does it open from?

## Context

The epic plan ticket decides the plan's shape and home. The human must be able to open a plan in a convenient form and see how the epic was planned before and while it runs; whether they approve every plan is agreed with the Coordinator. The graph prototype may already show stages as a grouping.

## Prototype

Mock up on the design canvas (two artboards: the plan of an epic before it starts, and the same plan mid-way with progress and one changed stage): stages and lanes, per-task QA policy, groups per implementer, what is done, where it opens from (the epic's item view, the graph, the palette) and the approve or discuss actions.

Resolve with the human's reaction: the plan view's spec section, recorded as a comment with the canvas link.

## Comments

### human · 2026-10-09T21:01:51.571Z

Resolution (2026-10-09). The human accepted the two mockups (PlanBefore, PlanMidway on the design canvas, mirrored in docs/design/main-screen/) and the decisions they added: gp opens the plan view; d writes to the epic's Lead in its topic; stage tags replace the epic prefix in the items panel when it is filtered to the epic; a per-item QA override shows under the row; a change since the human's last look is marked at the watch colour #c2a15e and stays marked until the view is opened; the right column carries approval, progress, the stage gate, QA runs and cost.

Recorded in docs/spec/v0.1.md §3.13 and the design README (file list and visual vocabulary).

### human · 2026-10-09T21:01:56.083Z

Resolved: see the resolution comment; spec v0.1 §3.13
