---
id: T-1439
kind: task
title: Discord resumable-stop test waits on a frozen fake clock for the old-copy edit (sibling of T-1413's fixed case)
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
regression_of: T-1413
topic: null
branch: t/T-1439-discord-resumable-stop-test-waits-on-a
created: 2026-10-29T11:02:16.796Z
updated: 2026-10-29T11:52:07.090Z
---

## Summary

`hub/test/discord-cards.test.ts :: Discord resumable stop finishes frozen history before replay input and replacement cards` failed on T-1372's mode-free run f7a19278 (A-13658, Linux droplet) with `resumed checkpoint old copy edited: not within 4000 ms` after 4.31 s. Alone on dev at 340d6dda it passes 5/5. This is the same frozen-clock dependency T-1413 fixed for "Discord fresh Identify catches history in order and resends every open card": the old-copy PATCH queues behind the 250 ms reaction lane while the test has stopped advancing the fake clock. The fix there (wait on exact sent edit receipts and advance 250 ms per newly sent reaction) was applied to that one case only.

## What to build

Apply the same receipt-driven clock advance to this case and to any other case in the file that waits for old-copy retirement after replay. Reproduce first with a controlled late reaction, as T-1413 did, and keep every assertion and the 4 s bound.

## Acceptance criteria

- [ ] C1. With a reaction held on its 250 ms lane, the resumable-stop case goes red before the change and passes after it, 5/5 under two busy workers.
- [ ] C2. Every case in `discord-cards.test.ts` that waits for an old-copy edit advances the fake clock by observed sent receipts, listed in the item.
