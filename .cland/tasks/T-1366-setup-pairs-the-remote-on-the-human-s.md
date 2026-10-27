---
id: T-1366
kind: task
title: Setup pairs the remote on the human's yes
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1365
topic: null
branch: null
created: 2026-10-27T05:46:50.530Z
updated: 2026-10-27T05:47:00.331Z
---

## Summary

Once Telegram is enabled, setup prints the bot's `t.me` link and waits while the human presses Start. It then shows the waiting code as "Pair Telegram user 12345 (Name)? code …" and approves it with `pairing.approve` on the human's yes.

## What to build

Spec §3.11 (setup approves the code on the human's yes) and §3.2. Setup's hub client gains three calls: remote status (for the bot link), the inbox's pairing rows and `pairing.approve`. It sends them over the local connection that the CLI uses, which the hub accepts.

After enabling, the step prints the link and pauses ("press Start, then Enter"). It then reads this messenger's waiting codes.
- One code: a confirm with the pairing row's text. Yes approves it and prints `done` with the paired name and id. No leaves `open` with `cland remote approve telegram <code>`.
- No code: an offer to wait once more, else `open` with the link.
- Several codes: a choose among them.

Write the wait, confirm and approve logic without anything Telegram-specific, keyed by messenger, so that 11 reuses it with `/cland pair`. Without a terminal, an enabled, unpaired remote prints `open` with the link and the approve command.

**External wait and shared files:** E-1309 (Telegram pairing, T-1342, is on dev) · **Shared files:** hub/src/setup/steps/ (the remote step), hub/src/setup/hub.ts

## Acceptance criteria

- [ ] C1. With the fake Bot API and a scripted prompter, a Start sent during the pause shows "Pair Telegram user <id> (<Name>)? code …", a yes pairs it, and the step prints `done` with the name and id (test).
- [ ] C2. A no pairs nothing, and the step prints `open` with `cland remote approve telegram <code>` (test).
- [ ] C3. With no waiting code after the pause, setup offers one more wait and then prints `open` with the bot link. With two codes it asks which one to approve (test).
- [ ] C4. Without a terminal, an enabled, unpaired Telegram remote prints `open` with the bot link and the approve command, and a second terminal run after pairing prints `ok` (test).
