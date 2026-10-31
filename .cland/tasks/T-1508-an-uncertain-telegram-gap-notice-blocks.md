---
id: T-1508
kind: task
title: An uncertain Telegram gap notice blocks all outbound Telegram traffic indefinitely
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-31T08:43:38.437Z
updated: 2026-10-31T08:43:38.437Z
---

## Summary

Outbound Telegram has been stalled since 2026-10-30 21:25Z: General mirror messages, notices and ask cards reach Discord but not Telegram (reported by the human on 2026-10-31 08:41Z). The cause is the Telegram gap notice ("N General messages missed since …"). It was sent during poll stalls, and its single attempt ended `unknown`. The outbox keeps an uncertain send fenced without proof, which is correct, but `#caughtUp()` re-sends the saved gap with the same key on every poll. It throws every time, so catch-up never completes and the remote stays offline indefinitely. The hub log shows 13,762 `telegram-poll-retry` lines with reason `catch-up incomplete`, and no line names the underlying error. No operator command clears this state. Unpairing and pairing again in the same chat keeps the saved gap.

## Evidence

Read-only from hub.db, hub #64:
- `remote_outbox` has one Telegram `message` job `3a5acb7d-…` in state `uncertain`, created 21:25:25.228Z. Its one attempt has outcome `unknown`, and its `updated` field changes on every catch-up.
- `remote_state` `telegram.gap` holds key `telegram-gap-c99ee3f5-…` with the text "1 General messages missed since 22:21", one captured job.
- 8 `general` jobs are `missed` (21:21Z to 08:41Z) and 1 `card` is `queued` (the 08:17Z rule-batch ask).
- Code path: `hub/src/remote/telegram.ts` `#caughtUp()` → `flushTelegramGap` → `outbox.send({…}, { key })`. The exception is caught in `telegram-polling.ts`, which logs only `catch-up incomplete`.

## Acceptance criteria

- [ ] C1. When the gap notice's send ends uncertain, catch-up still completes. The gap line is never resent (the fence holds), its captured jobs settle as reported, the saved gap clears, and later General messages, notices and cards flow again. A test on a fake Telegram server reproduces the stuck state and fails before the fix.
- [ ] C2. A hub that starts with this exact persisted state (an uncertain gap job with a saved `telegram.gap`) recovers on its own: after the first successful poll the queued card and new General messages are delivered. This is tested from a seeded hub.db state, not only from the live sequence.
- [ ] C3. A catch-up failure logs a fixed, redacted reason class that names the failing step (gap, outbox resume, inbound recover or card catch-up) instead of the bare `catch-up incomplete`.
- [ ] C4. When a remote stays offline because catch-up keeps failing for more than 5 minutes, an `offline` notice reaches General through the hub, not only through the stalled messenger, so the human learns about it from the workbench or the other remote. The notice is sent once per outage.
