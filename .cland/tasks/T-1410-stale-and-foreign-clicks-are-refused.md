---
id: T-1410
kind: task
title: Stale and foreign clicks are refused privately, and /cland inbox re-sends the open cards
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1407
  - T-1409
topic: null
branch: null
created: 2026-10-27T23:38:47.898Z
updated: 2026-10-28T22:06:38.413Z
---

## Summary

A click on a closed card gets "Already answered" privately and changes nothing. A click or modal submission from anyone but the paired human is refused privately and changes nothing. `/cland inbox` re-sends every open card at the bottom of the channel, or says "Nothing needs you".

## What to build

**Stale clicks.** A click on a card whose ask is closed is answered with an ephemeral "Already answered" and makes no hub write. So is a click the hub refuses because another client won. If that copy still shows buttons, its outcome edit is queued.

**Foreign clicks.** A click or `MODAL_SUBMIT` from another member gets an ephemeral "This card is for the project's owner" and sends no frame.

**Bad custom ids.** A custom id the hub did not issue, or one naming another ask than its message's mapping, is refused privately and changes nothing.

**`/cland inbox`.** It re-sends every open card oldest first at the bottom, with a re-send key separate from the live copy, as Telegram's `/inbox` uses. It answers ephemerally with the count, or "Nothing needs you".

Spec §3.5 (stale and foreign taps, order), §3.10 (`/inbox`); research rule 25.

## Acceptance criteria

- [ ] C1. A click on a card whose ask was answered elsewhere gets an ephemeral "Already answered", sends no answer to the hub, and leaves the card without buttons (test).
- [ ] C2. Another member's click and modal submission are refused ephemerally and change neither the card nor the ask (test).
- [ ] C3. A custom id the hub did not issue, or one naming another ask than its message, changes nothing (test).
- [ ] C4. `/cland inbox` re-sends every open card oldest first at the bottom of the channel, or answers "Nothing needs you" (test).

## Notes

Shared files: discord-interactions.ts, discord-commands.ts, discord-cards.ts
