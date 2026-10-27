---
id: T-1352
kind: task
title: The Telegram client and fake Bot API learn inline keyboards, presses, answerCallbackQuery and editMessageText under the server's rules
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by: []
topic: topic-1107
branch: t/T-1352-the-telegram-client-and-fake-bot-api
created: 2026-10-27T05:43:00.814Z
updated: 2026-10-27T08:32:34.645Z
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

- [x] C1. A message sent with an eleven-row inline keyboard comes back from the fake with every button, and a press through the control endpoint arrives as a `callback_query` update naming the message, the presser and the data (test).
  - done: impl-1352 · 2026-10-27T08:30:27.970Z
- [x] C2. The fake answers 400 to `answerCallbackQuery` 151 seconds after the press under the injected clock, to `callback_data` of 65 bytes, to an identical edit with "message is not modified" and to any edit of a message that carried ForceReply, and drops a thirteenth button in a row (test).
  - done: impl-1352 · 2026-10-27T08:30:28.204Z
- [x] C3. No token appears in any error, log line or receipt from the new calls, including a fault that echoes the token (test).
  - done: impl-1352 · 2026-10-27T08:30:28.565Z

## Comments

### impl-1352 · 2026-10-27T08:23:41.577Z

Rule 20 consumer inventory before edits: production TelegramApi/type consumers are hub/src/remote/{telegram.ts,telegram-inbound.ts,telegram-outbox.ts,telegram-polling.ts,messenger.ts}; all existing members/fields stay unchanged and new markup is optional. Fake consumers: hub/test/{telegram-api,telegram-messenger,telegram-polling,telegram-polling-restart,telegram-inbound,telegram-liveness,telegram-rendering,telegram-pacing,telegram-pairing,telegram-mute,telegram-commands,setup-pairing-component}.test.ts, telegram-{liveness,polling}-fixture.ts and fakes/telegram/held-reaction.ts. Search covered hub/web/nvim/shared/docs/.agents/qa for TelegramApi,TgMessage,TgCallbackQuery,SendMessage,fakeTelegram,telegramControl; no other wire clients, persisted-record readers, startup probes, T3/T4 or QA consumers found. Docs/skills: docs/agents/tests/hub-test-telegram-api.test.ts.md, hub/README.md Telegram client section, implement skill. This is an additive native client/fake contract: old parameterless markup and existing callback update fields remain supported; existing API override test is the previous-shape regression. No frame, admission, persisted schema or gateway send-failure policy change. Pre-agreed seam: actual fetch against the loopback fake/control endpoints; no process or external platform needed.

### impl-1352 · 2026-10-27T08:29:45.148Z

TDD on macOS local working tree: C1 first failed with `actual undefined` for returned reply_markup; C2 slices failed with `api.answerCallbackQuery is not a function`, `Missing expected rejection` at 65 bytes, `api.editMessageText is not a function`, and `Telegram sendMessage failed: 400 Invalid fake request` for ForceReply; C3 failed `diagnostics, captured logs and receipts must be token-free` before successful fake responses were sanitized. Each slice now passes. Six generated cases: Telegram card keyboard preserves eleven rows and a press identifies its message and presser; Telegram callback answers expire after 150 seconds on the fake clock; Telegram keyboard limits count UTF-8 bytes and silently cap rows and total buttons; Telegram outcome edits retain entities, remove buttons and distinguish an identical edit; Telegram ForceReply prompts retain their reply target and can never be edited; Telegram card calls redact successful receipts and echoed faults while preserving failure classes. Local serial regression: all 14 hub/test/telegram-*.test.ts files, 125 tests passed, including T1 render/gap, T2 native/frame/fake files and the T3 SIGKILL/restart file. npm run typecheck passed (hub/nvim/shared/web), diff whitespace, closed-item-wording and skill provenance checks passed. These are targeted local receipts, not queued verification or Linux/duration-gate evidence. No browser launched. No new CLI/help or role permission changes; README, per-test guide and implement skill/CHANGES document the additive native API.

### rev-26 · 2026-10-27T08:32:34.645Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1352-source-1
commit: f8edfcd3e2d13f831ab02e88258c7b39b9300ecc
scope: full
findings: [{"severity":"medium","text":"M1 Standards/fixture: callback-expiry case injects the stationary FakeClock into TelegramApi, so its HTTP abort deadline cannot fire while awaited responses are missing; no independent live test bound exists. Keep fake server time for exact 150/151-second assertions, with live bounded client I/O and separate native test bound.","file":"hub/test/telegram-api.test.ts","line":41}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated source audit A-12655: Standards M1 only; no additional Spec/fixture findings. Reviewed additive client methods/types, stored markup/press identity, UTF-8 and row/total caps, edits/ForceReply/expiry/faults, token-free captures/error controls, previous send shape and all listed consumers. Existing T2 manifest/docs index valid, README/skill provenance updated. A-12654 remains reported local macOS targeted summary (14 files/125 cases), not configured/Linux/browser proof. C1–C3 unverified. Corrected pushed-head source review required before mode-free verify; Coordinator owns any later dev merge and landing.
