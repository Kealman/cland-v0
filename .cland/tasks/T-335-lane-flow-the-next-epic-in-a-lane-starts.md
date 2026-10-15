---
id: T-335
kind: task
title: "Lane flow: epics follow epics, a follow is met on the last merge, and a merge hold keeps the follower off the predecessor's files until its demo"
state: open
status: in progress
size: L
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-423
blocked_by: []
topic: null
branch: t/T-335-lane-flow-the-next-epic-in-a-lane-starts
created: 2026-10-13T14:23:44.027Z
updated: 2026-10-15T07:16:44.791Z
---

## Summary

The next epic in a lane starts when the previous epic's last ticket merges, not when its QA demo closes it. This ticket adds a `follows` relation between epics. A follow is met on the predecessor's last merge. A merge hold keeps the follower's tickets off the predecessor's files until its demo verdict. The clause and the skills cut the next epic while the last stage is in review.

## Parent

E-423 "Rules and rhythm" (R-294, v0.1.3), tracer bullet 2, "`follows` and the merge hold". Spec `docs/spec/v0.1.3.md` §3.4 and the epic's choices "The relation", "When a follow is met", "The merge hold" and "Preparing the next epic". GLOSSARY: Follows.

## Background

This started as an observation from the human and the stand-in on 2026-10-13 at 14:30Z. During v0.1.2 the crew went fully idle twice, because each lane serialized on the chain of last merge, integrated run, hub restart, epic QA demo, epic close, then the next epic's tickets and plan. The stand-in's interim lane-flow rule of 2026-10-13 (unlinked epics), and the human's 2026-10-15 instruction to start v0.1.3 on the last v0.1.2 merge, apply the same idea by hand.

## What to build

- **The relation.** `follows` is a list of epic ids in the item's frontmatter, beside `blocked_by`. It is set and removed with `task create --follows <id>`, `task link <id> --follows <id>` and `--unfollow <id>`, and the matching `task.link` tool fields. Any prefix resolves. The hub refuses a cycle, and an edge between items other than epics. `task view`, the card and the explorer show it beside `blocked_by`.
- **When a follow is met.** A follow is met when its predecessor is closed. It is also met when the predecessor has task children, all of them closed, and its last ticket merged. `task view` shows `follows E-<n>: met` or the tickets still open. Only `blocked_by` marks an item blocked in `task list` and the panels.
- **The merge hold.** While a predecessor epic is open, its follow is met and its demo is pending, the merge gate holds a ticket of a following epic if the ticket's diff touches a file that the predecessor's merges changed. Those files are read from the `Item:` trailers on `dev`. The refusal names the predecessor, its pending demo and the files, and the `merge` skill waits it out. A ticket with no overlap merges.
- **Preparing the next epic.** The Coordinator's clause (in `hub/src/roles/default-roles.ts` and `.cland/roles.toml`) and the `merge`, `to-tickets` and `plan-epic` skills say this: when every ticket of an epic's last stage is in review, cut the following epic's tickets and write its plan, so that its first stage launches on the last merge.
- **The file-surface helper.** The function that lists the files an epic's merges changed is exported for ticket T-459 (demo freshness) to reuse.

## Acceptance criteria

- [ ] C1. `task create --follows`, `task link --follows/--unfollow` and the `task.link` tool set and remove `follows` in the frontmatter; a cycle and a non-epic edge are refused, proven by tests.
- [ ] C2. In a scratch project where E2 follows E1, `task view E2` shows `follows E-1: met` once E1's last ticket merges, and the open tickets before that; E2 is not marked blocked in `task list`.
- [ ] C3. A ticket of E2 whose diff touches a file E1's merges changed is refused at the merge gate with the predecessor, its pending demo and the files named, while a ticket with no overlap merges; both proven by tests.
- [ ] C4. The hold lifts when E1 receives its clear demo verdict or closes, proven by a test.
- [ ] C5. The card and the explorer show `follows` beside `blocked_by`.
- [ ] C6. The Coordinator clause in both places and the `merge`, `to-tickets` and `plan-epic` skills describe follows, the met rule, the hold and preparing the next epic during the last stage's review.
- [ ] C7. `hub/README.md` and GLOSSARY's Follows entry describe the relation, the met rule and the hold.
