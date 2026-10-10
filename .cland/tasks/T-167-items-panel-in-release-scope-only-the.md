---
id: T-167
kind: task
title: "Items panel in release scope: only the release's items; unscheduled holds open orphans only, never done items or other epics' subtrees"
state: open
status: planned
rank: 1170
labels:
  - v0.1
  - ready-for-agent
  - bug
assignee: null
parent: T-107
blocked_by: []
topic: null
branch: null
created: 2026-10-10T09:25:25.219Z
updated: 2026-10-10T09:25:44.074Z
---

## Parent

T-107 (v0.1 release and status). A bug the human reported on the live build, relayed by the stand-in on 2026-10-10.

## What to build

The items panel scoped to the release T-130 also lists:
- the old epics T-19 and T-20, as folded rows;
- an "unscheduled (55)" group that, unfolded, shows closed v0 items (T-1 and its tickets, with done glyphs).

Spec v0.1 §3.1 and §3.2 say release scope works like this:
- It shows the release's own items, in their status sections.
- An "unscheduled (N)" line appears only for open items that reach no release. It is folded, and it never contains done items.
- Other containers' subtrees (T-19, T-20) are not unscheduled items of this release.
- Everything else shows only under the "all" filter.

## Acceptance criteria

- [ ] With the scope set to a release, the panel lists only that release's items in their status sections.
- [ ] "Unscheduled (N)" counts and lists only open items whose parents reach no release; closed and done items never appear in it.
- [ ] Open containers outside the release (T-19, T-20) and their subtrees do not appear in release scope, and do appear under "all".
- [ ] A headless test on a fixture with the shape the human saw (two releases, an old epic with closed tickets, an open orphan) asserts each rule; the 80- and 120-column checks pass.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Notes

High priority: the human's view of the release. Size S to M. T-146 and T-153 touched the vertical board's grouping; keep the panel and the board on one rule where they share it.
