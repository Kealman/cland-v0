---
id: T-1324
kind: task
title: "A durable outbox per remote: attempts, provable resends, merged edits, dropped closed jobs, missed General jobs"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by:
  - T-1323
topic: null
branch: null
created: 2026-10-26T02:28:46.997Z
updated: 2026-10-26T03:41:13.406Z
---

## Summary

Each remote gets a durable outbox: an attempt record before every send, a resend only for what provably never left, merged edits, dropped jobs whose source closed, and General jobs during an outage counted as missed for the gap line instead of dropped.

## What to build

An outbox per remote over the remote tables. Write the attempt record before each send. Resend only when the messenger client supplies proof the job never left (Discord's enforced nonce, Telegram's message map); the client interface carries that proof. Merge consecutive edits of one target. Drop a job whose source closed, such as the card of an answered ask. While the messenger refuses sends, mark General jobs missed and count them for the gap line. Spec §3.9; the patterns in `docs/research/messenger-bridges.md` (research/messenger-bridges ffee79d8).

## Acceptance criteria

- [ ] C1. While the test messenger refuses sends, three General messages are marked missed and counted, a card whose ask is answered meanwhile is dropped, and after recovery nothing leaves twice (test).
- [ ] C2. An attempt record exists before each send, a job whose client cannot prove non-delivery is never resent, and two edits of one target queued together leave as one edit (test).
