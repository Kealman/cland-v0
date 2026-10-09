---
id: T-128
kind: task
title: "The vertical board: the items panel as a board of the current release on the hub's status and rank, with sections, folds, the next mark, the epic tab row, K, J and T, and e and E with the pick kept in ui.json"
state: open
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-109
blocked_by:
  - T-126
  - T-123
topic: null
branch: null
created: 2026-10-09T21:57:34.784Z
updated: 2026-10-09T21:57:34.784Z
---

## Parent

T-109 (Workbench basics), slice 5 of 5. Spec §3.11 (The items panel as a vertical board, Glyphs), §3.1 (Tree and scope). Blocked by T-123, the last ticket of T-107, which brings status, rank and the status-aware items panel this rewrites.

## What to build

The items panel becomes a vertical board of the current release, built on the hub's `status` and `rank` with nothing derived.
- **Sections:** in progress, review, qa, ready and planned, each with its count. Backlog and unscheduled are folded (`za`). Done is hidden and counted in the header ("board · 12 in work · 6 done").
- **A row** shows:
  - the status glyph and the id;
  - a dim parent prefix ("E-5 ›") and the title;
  - the claim or the verdict mark: ✗ for a not-clear last verdict, "for Reviewer" while a review is awaited;
  - the dim "verified/total" fraction, green when complete. Until T-112, it counts the checked boxes under `## Acceptance criteria`.
  - ◌ over a planned item with open blockers.
- **The "next" mark:** the first unblocked planned row carries a teal "next" mark.
- **Order:** rows sort by epic rank, then task rank.
- **The tab row** under the header filters by epic.
- **Keys:**
  - `1` to `5` and `f` keep the v0 filters, as the spec says, not the prototype;
  - `K` and `J` move an item among its siblings, and `T` moves it to the top, all through `cland task rank`;
  - Enter opens; `gi`, `gt` and `gs` as everywhere.
- **The scope:** `e` and `E` cycle the open containers, and the pick is kept in `ui.json`.

## Acceptance criteria

- [ ] On the stub hub, `T` on a planned task sends the rank change through the hub, and the row becomes the "next" row from the resulting `task` event.
- [ ] `e` scopes the board to another container, and the choice survives a restart through `ui.json`.
- [ ] Sections, counts, folds, glyphs, marks and order match §3.11, on a fixture covering every status, a blocked item and a not-clear verdict.
- [ ] Every key is registered in the action registry.
- [ ] Headless QA cases cover the board, succeeding `PANELS-001` to `PANELS-004`; `nvim/README.md` documents the board.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. References: `prototype/panels` (`vboard.lua`, `rank.lua`); mockups `ItemsBoard.dc.html` and `screens/v01-items-board.png`. Precedence: the spec, then the prototype's behaviour, then the mockups. The digit keys follow the spec.
