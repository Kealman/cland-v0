---
id: T-36
kind: task
title: Items panel, item view and board
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-35
  - T-32
  - T-25
topic: null
branch: null
created: 2026-10-08T11:55:12Z
updated: 2026-10-08T13:17:15.605Z
github:
  repo: Kealman/cland-v0
  number: 36
  url: https://github.com/Kealman/cland-v0/issues/36
---

## Parent

Part of #19. Spec section 5; design `docs/design/main-screen/Main.dc.html` (items panel, board view), `Item.dc.html`, `Charting.dc.html` (map filter), `Steady.dc.html` (board); prototype `prototype/workbench` (items panel, item view, board, filters, motions).

## What to build

The items panel on the left: a tree of epics and items with status glyphs, the claiming session right-aligned, an ask badge, and filters all / in work / needs you / done / map (the map filter groups decided, frontier, in work by sub-agents and blocked, from states, claims and blocking edges). Enter opens the item view in the centre: title, the fields column (state, kind and labels, parent, assignee, claim, topic, branch, blocked by, blocks, cost where known), the body, verdicts and comments; `e` opens the file. The board view shows backlog, planned, in progress, review, qa and done columns with cards carrying the claim and verdict marks, derived from state, claims and verdicts. The items kind of the picker searches id, title and claim. The motions `gi`, `gt`, `gs` now resolve between items, topics and sessions in both directions; a topic bound to an item and an item's topic open each other; an agent's `topic.create` with a binding links the two.

## Acceptance criteria

- [ ] The tree reflects the files within a second of a change; filters and the map grouping match the design's rules
- [ ] From an item, `gt` opens its topic (creating none; the topic appears when the first message about the item arrives) and `gs` attaches the claiming session; from a topic, `gi` opens the bound item
- [ ] The board's columns derive from state, claims and verdicts without a stored workflow status
- [ ] Headless tests assert the panel, the view and the board text for a fixture set of items against a real hub
