---
id: T-1341
kind: task
title: Telegram polling with store-then-confirm offsets, dedupe and paired-chat filtering
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1340
topic: null
branch: null
created: 2026-10-26T19:09:06.217Z
updated: 2026-10-26T19:09:12.954Z
---

## Summary

The Telegram remote polls `getUpdates` and confirms the offset only after an update is handled and stored. It deduplicates by update id and by chat and message id, drops the bot's own messages and anything not from the paired chat and sender, and polls with a zero timeout while offline.

## What to build

Long poll with a 30 to 50 s timeout, an HTTP timeout above it, and explicit `allowed_updates`: messages, edited messages, callback queries, the bot's membership. Offset and dedupe state live in T-1323's remote tables. Updates from any chat, sender or type other than the paired ones are dropped before any work, downloads included. Spec §3.7 and §3.9.

## Acceptance criteria

- [ ] C1. An update the fake delivers twice is handled once, and a hub killed mid-update handles it after the restart, because the offset advances only after the update is stored (test).
- [ ] C2. Updates from another chat, another sender or an unlisted type are dropped before any work, and the bot's own messages are ignored (test).
