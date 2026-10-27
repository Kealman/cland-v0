---
id: T-1409
kind: task
title: Modals take free answers and declines, and one gate holds across Discord, Telegram and the workbenches
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1408
topic: null
branch: null
created: 2026-10-27T23:38:47.618Z
updated: 2026-10-27T23:38:47.618Z
---

## Summary

"Other answer…" and "Decline…" open a modal that shows the question above one paragraph field of up to 4000 characters. Its submission answers or declines the ask and turns the card into its outcome. An ask answered anywhere else edits every Discord copy over REST, and the first answer from any client or remote wins.

## What to build

**The modal.** A click on "Other answer…" or "Decline…" answers with `MODAL` (type 9): a title within 45 characters ("Your answer" or "Why decline"), a Text Display with the question (truncated to fit) and a Label around a required paragraph Text Input of up to 4000 characters. The `MODAL_SUBMIT` from the paired user sends `topic.answer` with the text, or `declined` with the reason. The answer is stored first, then `UPDATE_MESSAGE` turns the card into its outcome. Discord needs no reply mode and no `/cancel`.

**One gate.** On the ask's state change (an `ask` frame or an inbox departure), every mapped Discord copy gets an outbox edit over `PATCH /channels/{c}/messages/{m}` with the outcome and no components. The state change can be an answer from Telegram, Neovim or the web, a withdrawal or a cancellation. These edits merge per card and go ahead of General. A `card` job whose ask closed before it left is dropped through `sourceOpen`.

Telegram's cards already follow the hub's record, so an answer given on Discord edits the Telegram copy. One test with both fakes proves it.

Spec §3.5 (free answers and declines on Discord, one gate); research rules 26 and 27; v0.2 §3.3.

## Acceptance criteria

- [ ] C1. "Other answer…" opens a modal with the question above one paragraph field of up to 4000 characters, and submitting it answers the ask with that text and turns the card into its outcome (test).
- [ ] C2. "Decline…" followed by a submitted reason records `declined` with that reason, and the card's outcome shows it (test).
- [ ] C3. An ask answered from a Discord modal turns its Telegram copy into the same outcome, and one answered from Telegram, Neovim or the web edits the Discord card over REST with no components (test).
- [ ] C4. A withdrawn ask's card says it was withdrawn, a cancelled ask's card says its topic or item closed, and a card job whose ask closed before sending is dropped (test).
- [ ] C5. A Discord click and a Telegram press racing on one ask store exactly one outcome, and every copy in both remotes shows it (test).

## Notes

Shared files: discord-cards.ts, discord-interactions.ts, discord.ts
