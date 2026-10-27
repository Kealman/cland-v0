---
id: T-1359
kind: task
title: Cards arrive oldest first, and `/inbox` re-sends every open card at the bottom or says "Nothing needs you"
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1357
  - T-1358
topic: null
branch: null
created: 2026-10-27T05:43:02.158Z
updated: 2026-10-27T20:05:44.163Z
---

## Summary

One inbox publication sends its new cards and notices oldest first, so the newest sits at the bottom. `/inbox` re-sends every open card and notice at the bottom as live copies, or says "Nothing needs you".

## What to build

The card jobs of one inbox publication go into the outbox sorted by the row's `since`, then its id, across asks, approvals and notices. `/inbox` replaces the text-only reply in `telegram-commands.ts`. It reads `inbox.list` and sends a new copy of each open row, oldest first. Each copy is mapped like the first, so every copy takes the later outcome edit, and older copies keep working. An empty inbox (pairing rows excluded) gets the one line "Nothing needs you". Spec §3.5 and §3.10.

## Acceptance criteria

- [ ] C1. Three asks posted in one publication, newest first, arrive in the chat oldest first, ahead of a General message queued at the same time (test).
- [ ] C2. After one of three asks is answered, `/inbox` re-sends the two open cards at the bottom oldest first, and answering one from its new copy edits both of its copies to the outcome (test).
- [ ] C3. `/inbox` with no open rows replies "Nothing needs you" (test).
