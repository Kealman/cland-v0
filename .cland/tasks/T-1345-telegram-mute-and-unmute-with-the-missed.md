---
id: T-1345
kind: task
title: Telegram mute and unmute with the missed count and the mute_default key
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
created: 2026-10-26T19:09:07.071Z
updated: 2026-10-26T19:09:14.652Z
---

## Summary

`/mute` silences the General stream while cards and notices still arrive. `/unmute` posts one line, "N messages arrived while muted", and `[remote] mute_default` sets the state a new pairing starts in.

## What to build

Mute state per pairing in the remote tables, read by the mirror out. Spec §3.4.

## Acceptance criteria

- [ ] C1. Three General messages during mute are not sent, a hub notice still is, `/unmute` posts "3 messages arrived while muted", and a new pairing starts muted when `mute_default` is true (test).
