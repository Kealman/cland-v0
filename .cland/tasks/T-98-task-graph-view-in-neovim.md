---
id: T-98
kind: question
title: Task graph view in Neovim
state: open
labels:
  - wayfinder:prototype
assignee: null
parent: T-81
blocked_by:
  - T-86
  - T-88
topic: null
branch: null
created: 2026-10-09T19:09:50.060Z
updated: 2026-10-09T19:10:32.641Z
---

## Question

Does a graph view of an epic's items, laid out by dependencies in lanes, serve the human better than the board, and what does it need to show?

## Context

The board proved less useful than the left items panel. The human wants to see the items of a release or epic as a graph: what follows what, what runs in parallel, scrollable up, down and sideways, to watch the process. The research "Neovim rendering techniques for the thread and a task graph" picks the layout technique; the status ticket defines the glyphs and columns the nodes carry.

## Prototype

Branch `prototype/graph` (never merged): a centre view that lays out an epic's items by `blocked_by` in lanes on real tracker data (the v0 epics are a good test: 22 tickets, 36 edges), with status glyphs, claim and verdict marks, a cursor on a node, `gi`, `gt`, `gs` and Enter, horizontal scrolling, and a parent filter. Try the epic plan's stages as a second grouping if the plan ticket has resolved by then.

Resolve with the human's reaction: whether the graph replaces the board as `␣b` or joins it, what a node shows, and the spec section, recorded as a comment with the branch link.
