---
id: T-1122
kind: task
title: Ask cards in the thread and the inbox on one record
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1119
topic: null
branch: null
created: 2026-10-22T15:16:13.408Z
updated: 2026-10-22T23:07:35.745Z
---

## Summary

An ask is one record shown as a card in its thread and as a row in the Inbox, answered with the same keys: options on `1` to `9`, a free answer, and decline with a reason on `d`, never on Escape. Once answered from any client it folds to one line with its outcome in both places.

## Parent

E-417 (§3.4 "An ask lives in two places with one state"; P14, P37, P38; choice "Decline's key"; tracer step 2).

## What to build

The card (P14) is an amber band with the question, each option as a button with its number key, and a free answer with Send answer when the ask allows one, plus a link to the same ask in the inbox. A click or the number key answers at once while the card or its inbox row has focus. `d` turns the free answer into a reason field and its button into a red Decline that stays disabled until a reason is typed; Answer instead turns it back (P37). Escape never answers or declines. An answer is shown pending until the hub's receipt, then applied or failed, and a failure keeps what the human typed. The first answer from any client wins: a client whose answer lost folds the card to the winner's outcome. An answered ask folds to one line with the option or the answer, who answered and when (the hub's outcome, T-1057), in the thread for good and in the inbox row. In the Inbox area the asks show as these rows in the asks and approvals section; the other kinds keep their stand-in rows until the inbox ticket. Answering marks the topic read up to the ask. A declined ask leaves its topic open.

## Acceptance criteria

- [ ] C1. An open ask shows as a card in its thread and as a row in the Inbox with the same question and options, and `2` answers it with option 2, as the asking fake session receives it (Web test).
- [ ] C2. An ask answered in one browser context folds to one line with the option, who answered and when in a second context's thread and inbox within a second (Web test).
- [ ] C3. Escape on an open ask leaves it open, and `d` turns the free answer into a reason field whose Decline stays disabled until a reason is typed, with Answer instead turning it back (Web test).
- [ ] C4. A decline with a reason reaches the fake asker as `declined` with that reason, and the topic stays open (Web test).
- [ ] C5. An answer refused because another client answered first folds the card to the winner's outcome, and an answer marks the topic read up to the ask (Web test).
