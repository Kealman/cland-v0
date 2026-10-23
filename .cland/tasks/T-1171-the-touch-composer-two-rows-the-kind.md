---
id: T-1171
kind: task
title: "The touch composer: two rows, the kind sheet and Withdraw"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1170
topic: null
branch: null
created: 2026-10-23T07:00:03.184Z
updated: 2026-10-23T16:51:24.451Z
---

## Summary

At phone width the composer docks above the bottom bar in two rows, its kind chip opens a sheet of Message, Decision and Question, return breaks the line and only Send sends, and a queued message shows a 44 px Withdraw.

## Parent

E-419 (§3.6 the touch composer, P33 to P35; the second half of tracer step 3).

## What to build

- **Two rows** docked above the bar: the kind chip and the addressee chip (the Coordinator by default in an item's topic, as on the desktop); then the text field and Send. Attaching an artifact stays on the desktop in 0.2.0.
- **Return** in the field breaks the line at phone width; only Send sends. The key goes through the key map's composer context, never a component-local listener.
- **The kind sheet.** The kind chip opens a small sheet rising from the composer with Message, Decision and Question as three large buttons, the current one checked; no scrim, and the thread moves up by the sheet's height.
- **Queued messages.** A message to a busy session shows its queued mark under the text with a Withdraw at least 44 px tall until the turn starts; Withdraw puts the text back into the composer as on the desktop.
- **Drafts** are the existing per-topic drafts and survive a reload with their kind.

## Acceptance criteria

- [ ] C1. At 390x844 the composer sits above the bottom bar in two rows, the kind and addressee chips over the field and Send, each control at least 44 px tall (Web test).
- [ ] C2. Return in the field breaks the line and sends nothing, and Send sends both lines as one message, as a frame client reads it (Web test).
- [ ] C3. The kind chip opens a sheet of Message, Decision and Question with the current one checked and no scrim, and choosing Question sends a question (Web test).
- [ ] C4. A message to a busy fake session shows queued with a Withdraw at least 44 px tall, and Withdraw returns its text to the composer (Web test).
- [ ] C5. A draft typed at 390x844 survives a reload with its kind (Web test).
- [ ] C6. `web/README.md` describes the composer on the phone (docs).
