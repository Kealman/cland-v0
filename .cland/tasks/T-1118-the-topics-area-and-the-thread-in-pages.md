---
id: T-1118
kind: task
title: The Topics area and the thread in pages, with read marks
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1115
topic: topic-858
branch: t/T-1118-the-topics-area-and-the-thread-in-pages
created: 2026-10-22T15:16:12.659Z
updated: 2026-10-22T16:29:55.183Z
---

## Summary

The Topics area lists the topics in their four groups and opens a topic's thread at its end, paging back by message number and growing with the hub's message deltas; the web marks a topic read by the epic's rule.

## Parent

E-417 (§3.2 the Topics area; §3.3 history in pages; §3.6 what counts as read; tracer step 1).

## What to build

The Topics area shows the topics in groups (§3.2): those waiting for the human first; then General and Agents, set apart with their own look; then the topics opened under items; then the closed ones, folded. Each group folds with the shared fold and keeps its state in the browser; each row shows the title, the item it belongs to, its unread count from the hub and its last activity. Selecting a topic shows its thread beside the list in the pane, as the Thread board draws it. The thread opens at its last message with the latest page of history and loads earlier pages by message number as the human scrolls up, keeping the scroll position and leaving no gap or repeat. New messages, stage changes and ask changes arrive as deltas and update the thread in place without re-reading its history; a reconnect re-reads only what the resume does not cover. Messages render as plain blocks in this ticket (sender, time, text with item ids as links); the message block of P12 is the next ticket. The thread's keys live in the topics and thread contexts. Read rule: once the thread has been in view with the page visible for one second, the web sends `topic.read` up to the last message on screen; a hidden page sends nothing. The unread count is the hub's, so Neovim and every browser agree (T-1054). The connection keeps a per-topic store fed by the `message`, `delivery`, `ask` and `topic` frames instead of re-reading the topic list on each frame.

## Acceptance criteria

- [x] C1. The Topics area lists waiting topics first, then General and Agents with their own look, then item topics, then closed topics folded, and a group's fold survives a reload (Web test).
  - done: impl-1118 · 2026-10-22T16:22:06.595Z
- [x] C2. A topic of 300 messages opens at its last message, and scrolling up loads earlier pages by message number until the first message with no gap or repeat (Web test).
  - done: impl-1118 · 2026-10-22T16:29:17.966Z
- [x] C3. A message sent into the open topic appears at the thread's end without another history read (Web test).
  - done: impl-1118 · 2026-10-22T16:22:07.989Z
- [x] C4. After the thread's end has been on screen with the page visible for one second, a second frame client reads the topic's unread count as 0, and a hidden page sends no read mark (Web test).
  - done: impl-1118 · 2026-10-22T16:22:09.345Z

## Comments

### impl-1118 · 2026-10-22T16:09:12.856Z

TDD progress at working tree: grouping/fold persistence and 300-message numeric-page/scroll-anchor tests pass in isolated Headless Shell on local Darwin arm64. Live ask/message updates pass without additional history or topic-list reads and match fresh real-frame history. Adding the visible one-second read rule, keyboard controls and reconnect/race coverage. No suite run yet; source review precedes mode-free verification.

### rev-26 · 2026-10-22T16:25:05.023Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1118-source-1
commit: 8e6a73eb9fddc45a3c895ab4059fdf63f42aa2f8
scope: full
findings: [{"severity":"medium","text":"M1: Earlier-page Retry calls the cache directly after the failed load clears the saved anchor; a successful prepend leaves scrollTop at zero and jumps the reader back by the fetched page. Capture and restore the retry anchor.","file":"web/src/Thread.tsx","line":46},{"severity":"medium","text":"M2: A fresh snapshot clearing an initial pending history load keeps loaded false→false, so Thread's effect at Thread.tsx:25 does not reload; the old generation's reply is discarded and the selected thread can remain empty. Expose/reset the load generation and restart initial history.","file":"web/src/topic-threads.ts","line":17}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; A-9304 records both axes and the completed audit. M1: failed earlier-page Retry bypasses prepend anchor capture, so a successful retry jumps the visible message. M2: resetting an initial pending history generation leaves loaded false→false, which does not retrigger Thread's load effect; the stale reply is discarded and the selected thread can stay empty. C2 failed; C1/C3/C4 remain runtime-dependent/unverified. Add the two boundary regressions, fix, push and request fresh source review before verification. Standards 0 separate findings; Spec 2 medium findings.

Criteria: C2 failed (Earlier-page retry loses the visible anchor, and a snapshot invalidating an initial pending history read can strand the thread empty.).

### rev-26 · 2026-10-22T16:29:55.183Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1118-source-2
commit: eb8fe2500677569d36235ceb294cff37d48dedfd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-9313 incorporates the first full audit and every corrective change. M1 retry now captures the prepend anchor; M2 exposes reset generation to restart pending initial loads. Both Web regressions retain durable boundary observations and final ordered-identity/anchor assertions, including a live DOM fence before the stale-reply negative assertion. No remaining findings. A-9311 is exact-head targeted Darwin check/9-test evidence, not configured suite proof. C1–C4 remain unverified pending mode-free same-head verification.
