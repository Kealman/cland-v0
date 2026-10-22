---
id: T-1118
kind: task
title: The Topics area and the thread in pages, with read marks
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1115
topic: topic-858
branch: t/T-1118-the-topics-area-and-the-thread-in-pages
created: 2026-10-22T15:16:12.659Z
updated: 2026-10-22T16:09:12.856Z
---

## Summary

The Topics area lists the topics in their four groups and opens a topic's thread at its end, paging back by message number and growing with the hub's message deltas; the web marks a topic read by the epic's rule.

## Parent

E-417 (§3.2 the Topics area; §3.3 history in pages; §3.6 what counts as read; tracer step 1).

## What to build

The Topics area shows the topics in groups (§3.2): those waiting for the human first; then General and Agents, set apart with their own look; then the topics opened under items; then the closed ones, folded. Each group folds with the shared fold and keeps its state in the browser; each row shows the title, the item it belongs to, its unread count from the hub and its last activity. Selecting a topic shows its thread beside the list in the pane, as the Thread board draws it. The thread opens at its last message with the latest page of history and loads earlier pages by message number as the human scrolls up, keeping the scroll position and leaving no gap or repeat. New messages, stage changes and ask changes arrive as deltas and update the thread in place without re-reading its history; a reconnect re-reads only what the resume does not cover. Messages render as plain blocks in this ticket (sender, time, text with item ids as links); the message block of P12 is the next ticket. The thread's keys live in the topics and thread contexts. Read rule: once the thread has been in view with the page visible for one second, the web sends `topic.read` up to the last message on screen; a hidden page sends nothing. The unread count is the hub's, so Neovim and every browser agree (T-1054). The connection keeps a per-topic store fed by the `message`, `delivery`, `ask` and `topic` frames instead of re-reading the topic list on each frame.

## Acceptance criteria

- [ ] C1. The Topics area lists waiting topics first, then General and Agents with their own look, then item topics, then closed topics folded, and a group's fold survives a reload (Web test).
- [ ] C2. A topic of 300 messages opens at its last message, and scrolling up loads earlier pages by message number until the first message with no gap or repeat (Web test).
- [ ] C3. A message sent into the open topic appears at the thread's end without another history read (Web test).
- [ ] C4. After the thread's end has been on screen with the page visible for one second, a second frame client reads the topic's unread count as 0, and a hidden page sends no read mark (Web test).

## Comments

### impl-1118 · 2026-10-22T16:09:12.856Z

TDD progress at working tree: grouping/fold persistence and 300-message numeric-page/scroll-anchor tests pass in isolated Headless Shell on local Darwin arm64. Live ask/message updates pass without additional history or topic-list reads and match fresh real-frame history. Adding the visible one-second read rule, keyboard controls and reconnect/race coverage. No suite run yet; source review precedes mode-free verification.
