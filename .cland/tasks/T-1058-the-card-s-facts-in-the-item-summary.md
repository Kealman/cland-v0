---
id: T-1058
kind: task
title: The card's facts in the item summary
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by:
  - T-1052
topic: null
branch: t/T-1058-the-card-s-facts-in-the-item-summary
created: 2026-10-21T14:04:18.959Z
updated: 2026-10-21T18:41:15.163Z
---

## Summary

Put a card's facts into the item summary so no client needs a `task.view` per card or a `task.plan show` per epic row.

## Parent

E-413 (§3.3 "The card's facts in the snapshot and the deltas"; tracer step 1).

## What to build

The item summary in the snapshot and the deltas also carries: the latest verdict's one-line reason, round and scope; the Decision block; for an epic with a plan, each stage's state; and the sections and size of the agents' text, for its fold line. The full body and the comments still come only when the human opens the agents' text. `nvim/lua/cland/explorer_card.lua` defines what the card shows.

## Acceptance criteria

- [ ] C1. A frame client reads a task's latest verdict reason, round and scope and its Decision block from the snapshot, with no `task.view` (test).
- [ ] C2. A frame client reads each stage's state for an epic with a plan from the snapshot, with no `task.plan show`, and a stage change arrives as a delta (test).
- [ ] C3. The summary carries the agents' text sections and size but never the full body or comments, and a thousand-item snapshot stays within T-1038's startup reply budgets (test).
- [ ] C4. `hub/README.md` lists the card fields.
- [ ] C5. Each stage of an epic with a plan carries merged/total counts that include closed members, and Neovim's stage counters (plan.lua progress, the card's current-stage "X of N merged", listed by T-1061 in its topic) read them instead of loaded rows (tests).
