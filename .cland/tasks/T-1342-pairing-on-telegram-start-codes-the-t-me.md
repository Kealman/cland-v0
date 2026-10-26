---
id: T-1342
kind: task
title: "Pairing on Telegram: start, codes, the t.me link and a blocked bot"
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1341
topic: null
branch: null
created: 2026-10-26T19:09:06.499Z
updated: 2026-10-26T19:09:13.344Z
---

## Summary

Pairing on Telegram: `/start` in an unpaired chat gives the code, the sender's id and the approve command; `/start` in the paired chat names the project; and `cland remote status` prints the bot's `t.me/<bot>` link. A blocked bot stops sending and reports it.

## What to build

Wire T-1332's codes and limits and T-1333's approval to the Telegram client. Detect a block from the membership update and a 403, stop sending, and report it in General and `cland remote status`. Spec §3.2.

## Acceptance criteria

- [ ] C1. On the fake, a stranger's `/start` gets a code with their id and the approve command and at most two replies, `cland remote approve telegram <code>` pairs the human, and `/start` in the paired chat names the project (test).
- [ ] C2. After the fake reports the bot blocked, through a membership update and then a 403, the remote stops sending and reports it, and `cland remote status` shows the `t.me/<bot>` link (test).
