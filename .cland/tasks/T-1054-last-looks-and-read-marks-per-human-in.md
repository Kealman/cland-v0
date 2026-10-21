---
id: T-1054
kind: task
title: Last looks and read marks per human in the hub, with Neovim moved onto them
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: null
branch: null
created: 2026-10-21T14:04:14.830Z
updated: 2026-10-21T14:04:14.830Z
---

## Summary

Hold the events' last look, each plan's last look and the topics' read marks in the hub per human, and move Neovim onto them with a one-time import from `ui.json`.

## Parent

E-413 (§3.6 marks; §3.3 "The last look and the read marks per human"; tracer step 3).

## What to build

The hub stores the marks per human, not per client. A mark only moves forward, and the latest from any client wins. Clients read the marks with the snapshot, set them through frames, and receive changes as deltas. Neovim reads and sets its events' last look and its plans' marks through the hub. On first start after this change, it imports the values `ui.json` holds once, never losing the human's current last look. `ui.json` keeps only interface state (filters, folds, the current release); pins and mutes stay where they are. What counts as read stays the client's act (`topic.read` up to a message number); the hub keeps the highest mark.

## Acceptance criteria

- [ ] C1. A mark set by one frame client is read by a second client, and an older mark sent later does not move it back (test).
- [ ] C2. Opening the events view in a headless Neovim workbench sets the events' last look that a frame client then reads, and a topic marked read by a frame client reads as read in Neovim (test).
- [ ] C3. A Neovim start with the last look and plan marks present in `ui.json` and absent in the hub imports them once; a second start does not re-import, and `ui.json` no longer carries them (test).
- [ ] C4. Marks survive a hub restart (test).
- [ ] C5. `hub/README.md` and `nvim/README.md` describe the marks and the import.
