---
id: T-1349
kind: task
title: "Telegram liveness: stalled polls, a lasting 409, and a 401 or 403 that stops only this remote"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1341
topic: topic-1097
branch: t/T-1349-telegram-liveness-stalled-polls-a
created: 2026-10-26T19:09:07.935Z
updated: 2026-10-26T23:19:09.092Z
---

## Summary

Liveness and failure on Telegram: a poll that hasn't returned within its timeout plus 15 s restarts the loop, a lasting 409 shows as "another consumer of the token", and a 401 or 403 stops only this remote with the cause and the fix in General.

## What to build

Stall detection on the poll, 409 handling within T-1323's poller lease (ride out up to 60 s at start; a lasting 409 is reported and never settled by stopping another process), and 401 and 403 handling through T-1326's isolation. Spec §3.9.

## Acceptance criteria

- [ ] C1. A stalled poll restarts after its timeout plus 15 s under an injected clock, and a lasting 409 shows as "another consumer of the token" in General and `cland remote status` (test).
- [ ] C2. A 401 stops only the Telegram remote with its cause and fix in General while the hub and the web edge serve on (test).

## Comments

### impl-1349 · 2026-10-26T23:19:09.092Z

Consumer inventory before liveness/failure policy changes (rule 20): production TelegramApi.getUpdates and TelegramRemote.run/start/test/pairingReplaced; messengerFactory and daemon startup/reload; Gateway runtime/start disable path; PollerLease (inspection/CAS only, unchanged); remote.status/doctor read RemoteStore.status.reason via existing schema. Tests: telegram-api, telegram-messenger, telegram-polling, telegram-polling-restart (T3), poller-lease, gateway-state, gateway, remote-cli, config-set, gateway-secrets, project-hub-lifecycle, cli-imports. Shipped implement skill and README polling guidance, per-file test guides and future E-1309 QA fake controls consume this behavior. No wire, persisted shape or rows change; old injected clients remain compatible via optional notice callback. Existing API already aborts a 40-second stalled poll at 55 seconds; retain that regression, add explicit wording/short offline deadline coverage and 409/401/403 frame evidence. Lease never signals a token consumer.
