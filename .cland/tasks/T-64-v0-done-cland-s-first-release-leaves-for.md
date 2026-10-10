---
id: T-64
kind: task
title: "v0 done: cland's first release leaves for GitHub through cland release from inside cland"
state: closed
status: done
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
updated: 2026-10-10T00:58:17.716Z
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

### coord · 2026-10-09T16:42:21.040Z

Evidence for the v0 done run, recorded by the Coordinator on 2026-10-09 at 16:45Z. The run item is T-62.
1. Territory: `origin` is .cland/territory.git, `github` is Kealman/cland-v0, and the root is on `dev` (since 14:28Z, T-20).
2. One real item inside cland, T-62:
   - launched with `session.launch --item T-62` in its worktree (impl-62);
   - review verdict rev-6-62-4, clear on 7f4501b;
   - QA verdicts from the committed brief qa/briefs/T-62.md, run on the lane by qa-62 (Codex gpt-6-astra): qa-2026-10-09-62-1 and qa-2026-10-09-62-2, both clear. The second one ran on fd8d581, before the review fixes, and the gate did not need QA for T-62;
   - `cland merge T-62` gave db7b7d7 on dev;
   - `cland release v0.0.1` gave commit 8ffd8ca and tag object e1aefa8.
3. GitHub: main is at 8ffd8ca with the annotated tag v0.0.1. Each task since the previous main, 5ae9cc3, is one squash commit: T-63, T-70, T-60, T-61 and T-62, with tracker and config commits between them. GitHub has no `t/` task branch; its other branches are the older prototype and research ones.
4. The human answered the version ask in topic-30: "v0.0.1 (patch)", from_kind human. Still open: the human's own comment here confirming that the release left from inside cland.
5. Found during the run and filed: T-74 (sanctioned tracker push to dev), T-75 (synchronous I/O in the permission gate and the journal), T-76 (the sweep misses servers of exited sessions). None blocked the run.

### coord · 2026-10-09T16:44:13.263Z

The human's confirmation for criterion 4, recorded by the Coordinator at the human's instruction on 2026-10-09: "ok comment instead of me, and close it" (typed by the human in the Coordinator's terminal). The human confirms that release v0.0.1 left for GitHub from inside cland, through `cland release`, on the human's own version answer in topic-30. With this, all five criteria are met (evidence in the comment above).

### coord · 2026-10-09T16:44:17.531Z

Closed by the Coordinator at the human's request. v0 is done: cland's first release, v0.0.1, left for GitHub through `cland release` from inside cland. Commit 8ffd8ca, tag object e1aefa8.
