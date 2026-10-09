---
id: T-99
kind: question
title: "Workbench panels: vertical board, session groups, the palette"
state: open
labels:
  - wayfinder:prototype
assignee: null
parent: T-81
blocked_by:
  - T-88
  - T-94
topic: null
branch: null
created: 2026-10-09T19:09:50.900Z
updated: 2026-10-09T19:10:33.494Z
---

## Question

Do the three panel changes work in practice: the items panel as a vertical board, the sessions panel grouped by state with stopped sessions folded, and `␣p` as the command palette?

## Context

Settled while charting (map Notes): the sessions panel groups waiting, busy, idle and folds stopped; `␣p` becomes one palette over objects and actions with prefixes. The status ticket defines the sections of the vertical board (in progress, review, QA, next planned; done hidden; scoped to the open parent; rank visible and movable); visibility levels say what each panel shows by default. Today the items panel is an always-expanded tree in id order with five filters, the sessions panel lists every session in three lines, and the picker covers four kinds without actions.

## Prototype

Canvas mockups first for the two panels and the palette (three artboards). Then branch `prototype/panels` (never merged) on real data: the items panel sections with rank moves, the sessions groups with fold and unfold, and the palette with registered actions and prefixes, built on Neovim's fuzzy matching. The human uses it for a working session and says what works.

Resolve with the human's reaction: the panel sections, the keys and the palette's action list for the spec, recorded as a comment with the branch and canvas links.
