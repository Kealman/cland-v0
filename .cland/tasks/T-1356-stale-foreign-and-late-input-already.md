---
id: T-1356
kind: task
title: 'Stale, foreign and late input: "Already answered", a privately refused foreign press, and a late message that answers no ask'
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1355
topic: null
branch: null
created: 2026-10-27T05:43:01.630Z
updated: 2026-10-27T11:28:09.059Z
---

## Summary

A press on a closed card gets "Already answered" and changes nothing. A press from anyone but the paired human is refused privately and changes nothing. A message that arrives late answers no ask by itself, and a reply answers only its own card, and only while that ask is open.

## What to build

A press whose key maps to a closed ask or approval answers the press "Already answered" and makes no hub request. If that copy still shows buttons, it queues the copy's outcome edit. When the hub refuses an answer because another client won, the press gets the same reply.

The poller admits one narrow exception to the silence of §3.2: a `callback_query` from a non-paired user on one of the bot's own mapped cards. It gets one private `answerCallbackQuery` ("This card is for the project's owner"). Nothing else happens, and the update is confirmed. Every other foreign update stays dropped.

A message that T-1348's catch-up marks as late never answers a waiting prompt (ticket 04). It goes to General as a late message. A late reply to a card answers that card only while its ask is open. A replayed press with the same callback id, or after a restart, changes nothing. Spec §3.5 and §3.9; builds on the polling's dedupe (T-1341) and T-1348's lateness.

## Acceptance criteria

- [ ] C1. A press replayed on a card after its ask was answered gets "Already answered", sends no hub request, and the stored outcome is unchanged (test).
- [ ] C2. A press on a card from another Telegram user gets one private answer with `show_alert`, sends no frame to the hub, and leaves the card and the ask unchanged (test).
- [ ] C3. A late message that arrives while a prompt waits goes to General marked late and does not answer the ask, and a late reply to a closed card answers nothing (test).
