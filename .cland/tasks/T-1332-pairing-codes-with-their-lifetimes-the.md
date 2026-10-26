---
id: T-1332
kind: task
title: Pairing codes with their lifetimes, the three-waiting cap and the two-reply limit for strangers
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by:
  - T-1331
topic: null
branch: null
created: 2026-10-26T07:54:42.838Z
updated: 2026-10-26T07:54:58.680Z
---

## Summary

A stranger who writes to a paired-capable messenger gets a pairing code. It has 8 characters drawn without 0, O, 1 and I, and comes with the sender's numeric id and the approve command. Codes expire, at most three wait at once, and a stranger gets at most two replies, then silence.

## What to build

Pairing-code generation and the per-messenger limits over T-1323's remote tables (waiting codes, stranger counts). A Telegram code lives one hour and a Discord code 15 minutes. At most three wait per messenger. A stranger gets the code and one more reply, then nothing. Each waiting code is a needs-you inbox row ("Pair Telegram user 12345 (Name)? code …"), and pairing rows never reach a remote. Spec §3.2.

## Acceptance criteria

- [ ] C1. Through a test messenger a stranger gets a well-formed code with their id and the approve command, then one more reply, then nothing, and a fourth waiting code is refused (test).
- [ ] C2. Codes expire at one hour (Telegram) and 15 minutes (Discord) under an injected clock, and the waiting code appears as a needs-you inbox row that no remote receives (test).
