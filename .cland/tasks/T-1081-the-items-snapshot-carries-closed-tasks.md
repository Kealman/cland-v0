---
id: T-1081
kind: task
title: The items snapshot carries closed tasks and nears its 1 MiB cap; page closed tasks on demand
state: open
status: planned
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: null
branch: null
created: 2026-10-21T18:52:28.328Z
updated: 2026-10-21T21:45:19.109Z
---

## Summary

The items domain of the snapshot carries every item, closed tasks included. On a copy of the live tracker (about 1,070 items) it is 836,897 bytes after T-1052, 80% of the 1 MiB items cap. T-1058's card facts push it toward 98%. The tracker grows by about 50 items a day, so the cap is days away, and `snapshot.refused frame-too-large` would break every client's connect.

## What to build

The snapshot's items domain carries the open items and every container (releases, epics, categories) with their roll-ups. Closed tasks are not in the first snapshot. A client gets them per container on demand: a bounded page request that the Neovim explorer and the web tree call when a closed child list is unfolded or `D` shows done items. The page request has the same per-reply budget. Deltas still carry a task that closes, then drop it from the open set. The Neovim workbench keeps working against the new shape; its explorer already loads open items first (T-1007).

## Acceptance criteria

- [ ] C1. On a copy of the live tracker, the snapshot's items domain stays at or below 50% of the cap, measured in a boundary test.
- [ ] C2. A frame client unfolding a closed epic, or turning on `D`, receives its closed tasks through bounded pages, and their counts match the container's roll-up (test).
- [ ] C3. A task that closes arrives in a delta and then leaves the open set; a client holding the closed page sees it there (test).
- [ ] C4. The Neovim explorer and board render closed children through the page request with the same counts as before, in headless tests on the copied tracker.
- [ ] C5. `hub/README.md` and `nvim/README.md` describe the open snapshot and the closed pages.
- [ ] C6. startup-replies-scale's thousand-item test runs in under 10 s on a Linux droplet at the task head (it ran 14.6 s at T-1058's head, A-8722, against 6.8–11 s before), so its first hub.status regains margin under the 15 s budget.
