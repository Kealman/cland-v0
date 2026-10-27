---
id: T-1360
kind: task
title: "The cards' part of the catch-up: missed cards, failed outcome edits, and every open card re-sent after 150 seconds"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1356
  - T-1359
topic: null
branch: null
created: 2026-10-27T05:43:02.419Z
updated: 2026-10-27T20:05:45.050Z
---

## Summary

After an outage the chat gets the cards of open asks it never received and the outcome edits that did not go through, after T-1348's late messages and gap line. After an outage longer than 150 seconds, the life of a press, every open card is re-sent at the bottom with "a button pressed then may have been lost; press again", and its old copy is marked "↓ Re-sent below".

## What to build

On recovery the catch-up runs in §3.9's order:
1. what Telegram kept;
2. the gap line (T-1348);
3. the cards of open rows that have no delivered copy, and the queued or failed outcome edits;
4. when the outage lasted over 150 seconds under the injected clock, a re-send of every open card at the bottom with the note.

Each old copy is edited to "↓ Re-sent below" without buttons. The outbox drops the card job of a row that closed meanwhile (ticket 03's `sourceOpen`), so an ask answered in the web during the outage gets only its outcome edit. The outage's start and length come from T-1348's offline record. A plain hub restart shorter than 150 seconds re-sends nothing. Spec §3.9 and §3.7; builds on T-1348 and the outbox drain (T-1325).

## Acceptance criteria

- [ ] C1. A 60-second fake outage during which an ask is posted ends with that card arriving after the gap line, and no open card is re-sent (test).
- [ ] C2. A four-minute fake outage in which one ask is answered in the web and another is posted ends with the outcome edit, the new card, and every open card re-sent at the bottom with the note and each old copy marked "↓ Re-sent below" without buttons (test).
- [ ] C3. A card job queued before the outage for an ask answered during it is dropped, and an outcome edit that failed during the outage is applied on recovery (test).
