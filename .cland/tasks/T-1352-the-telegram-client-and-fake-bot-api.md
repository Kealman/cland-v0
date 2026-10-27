---
id: T-1352
kind: task
title: The Telegram client and fake Bot API learn inline keyboards, presses, answerCallbackQuery and editMessageText under the server's rules
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by: []
topic: null
branch: null
created: 2026-10-27T05:43:00.814Z
updated: 2026-10-27T05:43:10.009Z
---

## Summary

The Bot API client gains the calls cards need: inline keyboards on `sendMessage`, `answerCallbackQuery`, and `editMessageText` with an empty keyboard. The fake Bot API models the server rules that cards depend on, so every later ticket can test against it.

## What to build

Hand-written types and methods on `TelegramApi` (the T-1340 seam: plain `fetch`, redaction, loopback fake root): `reply_markup` with `inline_keyboard` buttons (`text`, `callback_data`, optional `style`), `force_reply` with `input_field_placeholder`, `reply_parameters`, `answerCallbackQuery` (text, `show_alert`), and `editMessageText` (text, entities, `reply_markup`). `TelegramError` keeps the description so callers can tell "message is not modified" apart. The fake Bot API stores every sent message with its markup. It gains a control endpoint that presses a button as a given user on a given message, which queues a `callback_query` update. Like the server, the fake:
- refuses an answer to a press older than 150 seconds under the injected clock ("query is too old");
- refuses `callback_data` over 64 bytes;
- silently drops buttons past 12 per row and 300 in all;
- answers an identical edit with 400 "message is not modified";
- refuses to edit a message that ever carried ForceReply;
- fails an edit on request through the existing fault control.

Spec §3.5 and §3.7; Q-1287 (keyboard and callback limits, the 150-second press).

## Acceptance criteria

- [ ] C1. A message sent with an eleven-row inline keyboard comes back from the fake with every button, and a press through the control endpoint arrives as a `callback_query` update naming the message, the presser and the data (test).
- [ ] C2. The fake answers 400 to `answerCallbackQuery` 151 seconds after the press under the injected clock, to `callback_data` of 65 bytes, to an identical edit with "message is not modified" and to any edit of a message that carried ForceReply, and drops a thirteenth button in a row (test).
- [ ] C3. No token appears in any error, log line or receipt from the new calls, including a fault that echoes the token (test).
