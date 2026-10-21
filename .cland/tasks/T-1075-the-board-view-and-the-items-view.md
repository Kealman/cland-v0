---
id: T-1075
kind: task
title: The Board view and the Items view switcher
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1071
topic: null
branch: null
created: 2026-10-21T17:32:16.777Z
updated: 2026-10-21T17:32:16.777Z
---

## Summary

The Board view beside the tree, and the Items header's view switcher that keeps the scope, the filter and the selection.

## Parent

E-416 (v0.1.2 §3.11 as a view; tracer step 4).

## What to build

The Items header gets the switcher (Tree, Board, Graph, Plan); Graph and Plan come in later tickets and show as disabled until then. The Board shows status sections with counts and rows with the parent prefix, the claim or verdict mark, verified/total, the blocked glyph and the next mark. At release scope, the epics show as folded rows with done/total and the breakdown, unfolding into status sections, along with the epic tabs, Direct tasks (N) and the categories' count line. The Board has no rank keys; order, `next` and `blocked` come from the hub. `nvim/lua/cland/vboard.lua` defines the behaviour.

## Acceptance criteria

- [ ] C1. Switching Tree → Board → Tree on a scoped epic keeps the scope, the filter and the selected task (Web test).
- [ ] C2. At release scope the Board shows the epics as folded rows with done/total including closed children, and unfolds one into status sections (Web test).
- [ ] C3. The Board offers no rank or move action by key or mouse (Web test).
