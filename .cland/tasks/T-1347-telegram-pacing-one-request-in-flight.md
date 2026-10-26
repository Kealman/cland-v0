---
id: T-1347
kind: task
title: "Telegram pacing: one request in flight per chat and a bot-wide 429 hold"
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1343
topic: null
branch: null
created: 2026-10-26T19:09:07.525Z
updated: 2026-10-26T19:09:14.240Z
---

## Summary

Pacing: one queue per chat with one request in flight, about a message a second, cards first. A 429 holds the whole bot for its `retry_after`, capped at 5 minutes, with nothing lost or reordered.

## What to build

Bind T-1324's and T-1325's outbox drain to the Telegram client: per-chat ordering, priority for cards, bot-wide 429 hold. Hard-code no limit beyond the documented ones. Use an injected clock. Spec §3.7 and §3.9.

## Acceptance criteria

- [ ] C1. A burst of 20 General messages against a fake that answers one 429 arrives complete and in order after the wait, with one request in flight per chat and the hold applied bot-wide under an injected clock (test).
