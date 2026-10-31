---
id: T-1574
kind: task
title: "Discord: several users in one channel"
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
created: 2026-10-31T23:47:54.017Z
updated: 2026-10-31T23:47:59.692Z
---

## Summary

In users mode the Discord remote tells paired users apart by Discord user id, in one channel or in several, and ignores unpaired members as in v0.3. General and cards go once per paired channel, and a card folds with the answerer's name on every copy.

Hot files: `hub/src/remote/discord.ts`, `discord-inbound.ts`, `discord-outbox.ts`, `discord-cards.ts` [Host: E-1534/E-1535 cards], `discord-commands.ts`, `discord-catchup.ts`, `hub/src/remote/cards.ts` [Host].

## Acceptance criteria

- [ ] C1. Two users paired in one test Discord channel each have their messages and answers recorded as their own user.
- [ ] C2. A member of that channel who is not paired is ignored, and no message or answer of theirs reaches the hub.
- [ ] C3. General and each card are posted once per paired channel, and an answer by one user folds every copy with the answerer's name.
- [ ] C4. Users paired in two different channels each receive General and the cards in their own channel.
- [ ] C5. In single mode the Discord remote's tests pass unchanged.
