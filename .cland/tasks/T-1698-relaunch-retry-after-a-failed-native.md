---
id: T-1698
kind: task
title: "Relaunch retry after a failed native admission: same-destination refresh and onward third-host transfer"
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1614
topic: null
branch: null
created: 2026-11-05T19:34:54.917Z
updated: 2026-11-05T19:35:10.762Z
---

## Summary

T-1614 moves a session to another host. When native admission on the destination fails after the checkout and the lease transfer, T-1614 leaves the destination fenced in an `adding` state with a named reason, and nothing is corrupted. The rest of the retry is this item:
- a known-prepared retry onto the same destination must reuse the captured checkout and Git-admin identity, and refresh to an advanced pushed tip;
- a retry onto a third host must retire or retain the second host's checkout and ref-watch as named obligations, never overwrite their only owner.

Raised by rev-35's initial review of T-1614 (items 2 and 3).

## What to build

1. A same-destination retry after a known native-admission failure reuses the prepared checkout by its captured identity, fetching and resetting it to the current pushed tip if the tip advanced.
2. A third-host retry transfers the lease onward under the territory lock. The previous destination's checkout and ref-watch become a named obligation for settlement. No owner is silently overwritten.
3. Unknown preparation stays fenced, as in T-1614.

## Acceptance criteria

- [ ] C1. After a native-admission failure on f2 and a push that advances the tip, a retry onto f2 runs the session at the new tip using the same prepared checkout (test).
- [ ] C2. After a native-admission failure on f2, a retry onto f3 runs the session on f3, and f2's checkout and ref-watch are reported as a retained obligation with no f2 state overwritten (test).
