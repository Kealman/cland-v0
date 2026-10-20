---
id: T-984
kind: task
title: Thread history in pages by message number
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-979
topic: topic-776
branch: t/T-984-thread-history-in-pages-by-message
created: 2026-10-20T16:50:00.375Z
updated: 2026-10-20T20:59:18.494Z
---

## Summary

Each message carries its number, and `topic.history` reads a thread in pages before or after a number, at most 200 a page. A client can then read a long thread without gaps or repeats.

## What to build

Messages get a monotonically increasing number in the store, and the number rides on `TopicMessage`. `topic.history` takes `before` or `after` a number. Without either, it answers as it does today, so Neovim keeps working. `events.list` keeps its own cursor.

## Acceptance criteria

- [ ] C1. Each stored message carries a number, and `topic.history` with `before` or `after` returns at most 200 messages a page (test).
- [ ] C2. A thread of 450 messages reads in three pages backwards and three pages forwards with no gap and no repeat (test).
- [ ] C3. A message recorded between two page reads appears once, in a later `after` page (test).
- [ ] C4. `topic.history` without `before` or `after` answers as today, and Neovim's thread tests pass without edits.
- [ ] C5. `hub/README.md` documents the pages.

## Comments

### impl-984 · 2026-10-20T20:59:18.494Z

Existing messages.seq/counters.message_seq already provide durable monotonic numbering and messages_seq(topic,seq) indexing. Plan: expose seq on TopicMessage and support numeric exclusive before/after; retain string before for Neovim. No new schema migration/backfill is needed. Store/core T1 tests will cover the 450-message traversal, interleaved insert, filter/cursor validation, and legacy limit/order.
