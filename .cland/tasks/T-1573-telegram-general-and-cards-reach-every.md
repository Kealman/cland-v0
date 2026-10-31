---
id: T-1573
kind: task
title: "Telegram: General and cards reach every paired user"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1572
topic: null
branch: null
created: 2026-10-31T23:47:53.814Z
updated: 2026-10-31T23:47:59.241Z
---

## Summary

In users mode the Telegram remote mirrors General to every paired user's chat, and sends every ask and approval card to each of them. When one user answers, the card in every other chat folds with the answerer's name. A message from one user's chat is mirrored to the other chats with that user named, and is not echoed back to its own chat.

Hot files: `hub/src/remote/telegram.ts`, `telegram-outbox.ts`, `telegram-cards.ts` [Host: E-1534/E-1535 cards], `telegram-gap.ts`, `hub/src/remote/media.ts`, `hub/src/remote/cards.ts` [Host], `hub/src/remote/outbox.ts`.

## Acceptance criteria

- [ ] C1. With two paired users on the test Telegram, a Coordinator line in General reaches both chats once each.
- [ ] C2. A Coordinator ask reaches both chats as a card, and an answer from one chat folds the other chat's card with a line naming the answerer.
- [ ] C3. A message one user sends from their chat reaches the other chat attributed to that user, and is not echoed to its own chat.
- [ ] C4. The outbox retries and gap recovery work per chat, so a failure on one chat does not hold back the other.
- [ ] C5. In single mode the Telegram remote's mirror, cards and outbox tests pass unchanged.
