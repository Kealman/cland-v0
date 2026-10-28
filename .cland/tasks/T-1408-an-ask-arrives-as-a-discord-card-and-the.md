---
id: T-1408
kind: task
title: An ask arrives as a Discord card, and the paired human's click answers it with one update within 3 seconds
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1397
  - T-1404
topic: null
branch: null
created: 2026-10-27T23:38:47.479Z
updated: 2026-10-28T22:06:37.993Z
---

## Summary

An open ask to the human becomes a legacy-message card in the paired channel. It has option buttons five to a row, then "Other answer…" and "Decline…". The paired human's click is stored in the hub first, then answered within 3 seconds by one update that turns the card into its outcome without buttons. Cards go out oldest first, even while General is muted.

## What to build

**Publication.** On an inbox publication, each open ask without a Discord card gets a `card` job, which goes ahead of General. Asks go oldest first through `inboxPublication`. The card is mapped in `remote_messages` with its ask.

**The card.** Its content is the bold title from `askCard`, then the question. When the buttons are numbered, the options are listed in the content.

**The buttons.**
- At most three action rows: the options five to a row, then a row with "Other answer…" (only when the ask takes free answers) and "Decline…".
- Each option is labelled with its text when every option fits in 34 characters, and with its number otherwise.
- Labels stay within 80 characters.
- Custom ids are `ask:<id>:<n>`, `ask:<id>:other` and `ask:<id>:decline`, within 100. They are checked against the hub's record and the card's mapped message, never trusted.

**A click.** The paired human's click sends `topic.answer` with the option, `via = "discord"` and the ingress `interaction:<id>`. After the hub stores the answer, one `UPDATE_MESSAGE` (type 7) sets the outcome line from `outcomeLine` and `components: []`. When the hub's result is not back within 2 seconds, a `DEFERRED_UPDATE_MESSAGE` (type 6) goes out and the card is edited afterwards through an outbox edit. Until ticket 14, "Other answer…" and "Decline…" answer ephemerally "not available yet".

The fake enforces the 3-second deadline and records each callback's arrival time under the injected clock.

Spec §3.5 (Discord cards, one gate, order); research rules 23 and 24; Q-1293 (0.42 to 0.69 seconds per click).

## Acceptance criteria

- [ ] C1. A nine-option free-answer ask whose options fit 34 characters arrives as one card with the options five to a row labelled with their text, then "Other answer…" and "Decline…", in three rows, every label within 80 and every custom id within 100 (test).
- [ ] C2. An ask with one option over 34 characters gets numbered buttons with the options listed in the card's content (test).
- [ ] C3. The paired human's click records the answer with `via = "discord"` before the callback, and one `UPDATE_MESSAGE` turns the card into its outcome with no components within 3 seconds under the injected clock (test).
- [ ] C4. A click whose hub result takes longer than 2 seconds is deferred before 3 seconds and the card is edited to its outcome afterwards (test).
- [ ] C5. Two asks published together arrive oldest first, and a card still arrives while General is muted (test).

## Notes

Shared files: new hub/src/remote/discord-cards.ts, discord-interactions.ts, discord.ts, discord-outbox.ts; hub/test/fakes/discord/ (components)
