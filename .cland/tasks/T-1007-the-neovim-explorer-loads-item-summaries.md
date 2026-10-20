---
id: T-1007
kind: task
title: The Neovim explorer loads item summaries, open items first
state: open
status: in progress
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1006
blocked_by: []
topic: topic-755
branch: t/T-1007-the-neovim-explorer-loads-item-summaries
created: 2026-10-20T17:01:23.939Z
updated: 2026-10-20T17:04:53.644Z
---

## Summary

The Neovim explorer loads item summaries without bodies: open items first, closed items when the human asks for them. Today a single `task.list` sends all 1,005 items with their full bodies (1.8 MB), and the hub and Neovim both choke on it.

## What to build

- `task.list` gets a summary projection: id, kind, title, state, status, size, labels, parent, blockers, claim, the latest verdict of each kind, and criteria counts. No body, no comments, no verdict history.
- The projection takes a state filter. The explorer asks for open items first, and fetches closed items only when the human expands a closed group or searches for them.
- Opening an item's card reads its body through `task.view`.
- A `task.list` without the projection answers as it does today, so the CLI and `--json` users keep working.
- Measure the projection's bytes on a copy of the live tracker and post the figure in the item topic.

## Acceptance criteria

- [ ] C1. The summary projection returns no body, comments, verdict history, plans or verification, and on a 1,000-item fixture tracker with 100 open items the open-only first payload stays under 60 KB, with the all-items projection bytes recorded in the test output (test).
- [ ] C2. On start the explorer requests open items only, and closed items are requested when the human expands the closed group or searches (test on recorded frames).
- [ ] C3. Opening an item's card reads its body with `task.view` and renders it (test).
- [ ] C4. `task.list` without the projection answers as today, and the CLI's `task list --json` output is unchanged (test).
- [ ] C5. The projection's bytes and compose time on a copy of the live tracker are posted in the item topic (local evidence).
- [ ] C6. `hub/README.md` documents the projection, and `nvim/README.md` documents lazy loading of closed items.
