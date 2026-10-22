---
id: T-1076
kind: task
title: The Graph view in the Items area
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1072
  - T-1075
topic: null
branch: null
created: 2026-10-21T17:32:16.876Z
updated: 2026-10-22T04:08:34.078Z
---

## Summary

The Graph view in the Items area, drawn from the ported layout as SVG on the tokens.

## Parent

E-416 (v0.1 §3.15, v0.1.2 §3.3; tracer step 5, second half).

## What to build

The Graph view of the current scope: task nodes, with done nodes in the done colour and the green glyph, and container nodes with done/total and the count in work. It uses the ported layout, is drawn as SVG with colours from `web/src/tokens.css` only, and sits in the switcher keeping the scope and the selection.

## Acceptance criteria

- [ ] C1. The Graph of a release shows a closed epic in the done colour with its full fraction and an open one with its count in work (Web test).
- [ ] C2. Switching to Graph and back keeps the scope and the selection, and selecting a node selects its row (Web test).
- [ ] C3. No hex colour outside the tokens (typecheck colour guard passes).
