---
id: T-64
kind: task
title: "v0 done: cland's first release leaves for GitHub through cland release from inside cland"
state: open
labels:
  - ready-for-human
  - slice-2
assignee: null
parent: T-20
blocked_by:
  - T-53
  - T-54
  - T-55
  - T-56
  - T-57
  - T-58
  - T-59
  - T-60
  - T-61
  - T-62
  - T-63
topic: null
branch: null
created: 2026-10-09T08:35:32.127Z
updated: 2026-10-09T08:39:13.515Z
---

## Parent

Part of T-20 (slice 2, ticket 12 of 12): the epic's definition of done, run as T-42 ran slice 1's.

## What to build

cland's own repository is on its territory (decision D15, right after T-53 merged). One real cland item goes from `session.launch --item` (T-58) through a review verdict, a QA verdict from a brief run on the lane (T-62), `cland merge` (T-59) and `cland release` (T-63) by the Coordinator inside cland, with the human answering the version ask from the inbox: that ask is the human's own, not the stand-in's, so the Coordinator raises it, tells the stand-in, and waits for the human (decision D11). Whatever blocks the run is fixed here or filed as an item linked here. Closing this item closes T-20.

## Acceptance criteria

- [ ] cland's repository has the territory as `origin`, GitHub as `github`, and its root on `dev`.
- [ ] One real cland item goes from its launch in a worktree to a review verdict, a QA verdict from a brief, `cland merge` and `cland release`, entirely inside cland.
- [ ] GitHub has `main` at the release commit with its tag; each task since the previous `main` is one commit, and no task branch is on GitHub.
- [ ] The human answered the version ask from the inbox, and confirms in a comment that the release left from inside cland.
- [ ] Every blocker found is fixed here or filed and linked.

## Notes

Test seam: the human's run, recorded on the item. Size M. Implementer: none; the Coordinator in Claude Code runs it with the human, and fixes go to Implementers as new items.

## Comments

### coord · 2026-10-09T08:39:13.515Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/59 (a sub-issue of #20; the item is the source of truth).
