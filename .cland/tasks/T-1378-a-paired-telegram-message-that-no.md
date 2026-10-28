---
id: T-1378
kind: task
title: A paired Telegram message that no handler accepts (photo, sticker, voice, caption-only) blocks every later input in the chat
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
regression_of: T-1341
topic: topic-1137
branch: t/T-1378-a-paired-telegram-message-that-no
created: 2026-10-27T22:25:28.795Z
updated: 2026-10-28T05:05:54.596Z
---

## Summary

The Telegram poller holds an accepted paired update until some handler accepts it, without confirming the offset (`telegram-polling.ts` "Preserve input until a handler is installed"). Only plain text, button presses and prompt replies have handlers, so a photo, sticker, voice note, document or caption-only message from the paired human is retried every second forever and every later input in that chat — text, presses, `/inbox` — waits behind it, across restarts too. Found by the E-1311 ticket draft (coord's sub-agent) on dev c675faa3 and confirmed in the source by coord.

## What to build

Every paired update kind the poller admits ends in a handled, confirmed state: until E-1311 adds media handlers, a non-text message gets one short reply naming what works now (text, buttons, commands) and is confirmed, so later input proceeds. The "no handler installed yet" hold stays only for the startup window it was written for, bounded, never for an update kind no handler will ever accept. E-1311's media handlers later replace the reply for photos, documents and voice.

## Acceptance criteria

- [ ] C1. A paired photo, sticker, voice note and caption-only message each get one reply and are confirmed, and a text sent after them reaches General (fake Bot API test).
- [ ] C2. A button press queued behind a sticker is still handled in order (test).
- [ ] C3. A restart after a confirmed non-text update does not replay it (test).

## Comments

### coord · 2026-10-27T22:25:35.655Z

Also affected: `edited_message` is in TELEGRAM_ALLOWED_UPDATES and no handler accepts it, so editing a sent message blocks the chat the same way. The fix covers edits (one reply or a silent confirm, decided in the item) with its own test.
