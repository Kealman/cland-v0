---
id: T-1354
kind: task
title: "One gate across the clients: answers from Neovim and the web, withdrawn and cancelled asks, and closed cards dropped from the outbox"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1353
topic: null
branch: null
created: 2026-10-27T05:43:01.228Z
updated: 2026-10-27T05:43:10.544Z
---

## Summary

The first answer from any client or remote wins. When that answer comes from Neovim or the web, or the ask is withdrawn or cancelled, every copy of the card turns into that outcome. A card job whose ask closed before it left is dropped.

## What to build

The card follows the hub's record, not the remote's own press. On the ask's state change (its `ask` frame, or its inbox departure with the outcome), every mapped copy is edited:
- an ask answered elsewhere shows the choice or the decline reason, who, where ("via Neovim", "via web") and when;
- a withdrawn ask says so, naming its session;
- a cancelled ask says its topic or item closed.

`TelegramOutbox` wires the outbox's `sourceOpen` to the hub's record, so a queued card job for a closed ask is dropped. Edits of one card merge, and edits ride ahead of General like cards do. When a tap and a Neovim answer race, the hub's one gate (v0.2 §3.3) keeps exactly one outcome, and the card shows the winner. Spec §3.5; v0.2 §3.3.

## Acceptance criteria

- [ ] C1. An ask answered by a Neovim client over the frame protocol edits its card to an outcome "via Neovim" with no buttons, and one declined from a web client shows the reason "via web" (test).
- [ ] C2. An ask withdrawn by its session edits its card to say it was withdrawn, and an ask whose topic closes edits its card to say it was cancelled (test).
- [ ] C3. An ask answered while its card job waits behind a 429 hold is never sent, and its job is marked dropped (test).
- [ ] C4. A tap and a Neovim answer racing on one ask store exactly one outcome, and every copy of the card shows that one (test).
