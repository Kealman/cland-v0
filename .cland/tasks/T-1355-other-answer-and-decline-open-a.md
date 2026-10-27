---
id: T-1355
kind: task
title: '"Other answer…" and "Decline…" open a ForceReply prompt; the next text answers, `/cancel` keeps the ask open, and a typed reply to the card answers it'
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1354
topic: null
branch: null
created: 2026-10-27T05:43:01.372Z
updated: 2026-10-27T05:43:01.372Z
---

## Summary

"Other answer…" and "Decline…" each send a separate prompt with the reply field open. The next text, or a reply to the prompt, answers the ask as a free answer or as a decline with that reason. `/cancel` keeps the ask open, and a typed reply to the card itself answers it too.

## What to build

A press on "Other answer…" or "Decline…" answers the press. It then sends a prompt replying to the card ("Your answer to: …" or "Why decline: …", with "/cancel keeps the ask open"). The prompt carries ForceReply and a placeholder, and is mapped to its ask and mode. The card itself never carries ForceReply, because a message that ever did can never be edited.

While a prompt waits, the human's next ordinary text in the chat answers through `topic.answer`, as a free `text` or as `declined` with that `reason`. A reply to the prompt does the same even after other text. That text does not go to General. `/cancel` clears the waiting prompt, replies "Cancelled. The ask stays open." and leaves the ask open. This replaces the placeholder in `telegram-commands.ts`.

A typed reply to the card answers it as a free answer when the ask takes one. When it does not, the reply counts only as an option's number; anything else gets a one-line note and leaves the ask open. A prompt whose ask closed meanwhile says so, and the text goes nowhere. The wait for a prompt is stored in the remote tables, so it survives a restart. Spec §3.5 and §3.10; builds on the inbound's reply mapping (T-1344).

## Acceptance criteria

- [ ] C1. "Other answer…" sends a ForceReply prompt as a reply to the card, the card's own markup never contains `force_reply`, and the next text answers the ask with that text "via Telegram" and is not posted to General (test).
- [ ] C2. "Decline…" followed by a reply to its prompt records `declined` with that reason, and the card's outcome shows the reason (test).
- [ ] C3. "Decline…" followed by `/cancel` leaves the ask open, its card keeps its buttons, and the next text goes to General as a message (test).
- [ ] C4. A typed reply to a free-answer card answers it, and a non-number reply to an options-only card gets a note and leaves the ask open (test).
