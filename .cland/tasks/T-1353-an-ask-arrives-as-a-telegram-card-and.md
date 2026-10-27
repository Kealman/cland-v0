---
id: T-1353
kind: task
title: An ask arrives as a Telegram card and one tap answers it and edits the card into its outcome
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1352
topic: null
branch: null
created: 2026-10-27T05:43:00.974Z
updated: 2026-10-27T05:43:10.127Z
---

## Summary

An open ask to the human in the inbox becomes a card in the paired chat. The card names who asks and in which topic, shows the question, and has one button per option, "Other answer…" when the ask takes a free answer, and "Decline…", one per row. A tap answers the ask through `topic.answer` with `via = "telegram"`, and every copy of the card is edited into its outcome without buttons.

## What to build

A messenger-neutral card model, which turns the inbox's asks into cards and works out each outcome line. Telegram rendering builds on it. When an inbox publication brings an ask with no card yet, a `card` job goes to the outbox. The card is plain text with entities (not a Rich Message), at most nine option buttons, one button per row, then "Other answer…" (only when `free`) and "Decline…". Each button carries an opaque key of at most 64 bytes, stored in the remote tables and mapped to the ask and the option. The chat message is mapped in `remote_messages` with its ask.

A press resolves its key, checks that the ask is open, and sends `topic.answer` with the option. Once the hub's result is stored it answers the press at once (outside the outbox and pacing), and only then is the offset confirmed. On the ask's outcome, every mapped copy gets an `edit` job: the outcome line, no buttons. "Message is not modified" counts as success, and a failed edit becomes an outcome reply to the card. Until ticket 04 lands, "Other answer…" and "Decline…" answer the press with a short "not available yet" toast. Spec §3.5 and §3.1; builds on the outbox's `card` and `edit` jobs (T-1324, T-1347), the message map (T-1323) and the polling's store-then-confirm (T-1341).

## Acceptance criteria

- [ ] C1. A nine-option ask with free answers arrives as one entities card naming the asker and the topic, with eleven buttons one per row in order ending "Other answer…" and "Decline…", and every `callback_data` of at most 64 bytes (test).
- [ ] C2. A tap on option 3 records the answer with `via = "telegram"` before the press is answered and before the offset is confirmed, and the card is edited to the outcome naming the option, who, "via Telegram" and the time, with no buttons (test).
- [ ] C3. A press whose data is not a key the hub issued, or names another ask, changes nothing and answers the press (test).
- [ ] C4. An outcome edit refused as "message is not modified" counts as done, and one the fake fails becomes one outcome reply to the card (test).
