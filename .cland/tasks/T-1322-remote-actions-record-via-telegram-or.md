---
id: T-1322
kind: task
title: Remote actions record via telegram or discord on messages, answers, approvals and ask outcomes, shown in both workbenches
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by:
  - T-1321
topic: null
branch: null
created: 2026-10-26T02:28:46.572Z
updated: 2026-10-26T03:41:12.931Z
---

## Summary

Messages, answers, approvals and ask outcomes made through a remote record `via` with the values `"telegram"` and `"discord"`, and both workbenches show it. Today an ask's outcome lacks `via`, while an approval's already has it (Q-1292).

## What to build

Add `"telegram"` and `"discord"` to the `via` values on messages, answers and approvals. Record `via` on an ask's outcome the way an approval's outcome already does. Neovim's and the web's inbox and message rows render "via Telegram" or "via Discord". Older clients must keep working when they meet the new values (rule 20: list every consumer of the changed shapes in this item). Spec §3.1.

## Acceptance criteria

- [ ] C1. An ask and a fake Codex approval answered through the test messenger record `via` on the outcome, and a message sent through it records `via` (test).
- [ ] C2. Headless Neovim and headless Chromium show "via Telegram" on those rows, and a client at the previous wire shape still reads them (test).
