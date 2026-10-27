---
id: T-1366
kind: task
title: Setup pairs the remote on the human's yes
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1365
topic: topic-1105
branch: t/T-1366-setup-pairs-the-remote-on-the-human-s
created: 2026-10-27T05:46:50.530Z
updated: 2026-10-27T06:46:04.413Z
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

- [x] C1. With the fake Bot API and a scripted prompter, a Start sent during the pause shows "Pair Telegram user <id> (<Name>)? code …", a yes pairs it, and the step prints `done` with the name and id (test).
  - done: impl-1366 · 2026-10-27T06:45:52.624Z
- [x] C2. A no pairs nothing, and the step prints `open` with `cland remote approve telegram <code>` (test).
  - done: impl-1366 · 2026-10-27T06:45:52.714Z
- [x] C3. With no waiting code after the pause, setup offers one more wait and then prints `open` with the bot link. With two codes it asks which one to approve (test).
  - done: impl-1366 · 2026-10-27T06:45:52.813Z
- [x] C4. Without a terminal, an enabled, unpaired Telegram remote prints `open` with the bot link and the approve command, and a second terminal run after pairing prints `ok` (test).
  - done: impl-1366 · 2026-10-27T06:45:53.032Z

## Comments

### impl-1366 · 2026-10-27T06:39:20.070Z

Implementation starts at the assigned seams: setup runner/scripted prompter, local CLI frames via setupHub, and fake Telegram Bot API. Reuse remote.status, inbox.list (pairings optional for old hubs), and pairing.approve without changing wire shapes or admission policy. New SetupHub wrapper methods are additive and optional for existing injected setup clients. No new dependencies or role-clause lines.

### impl-1366 · 2026-10-27T06:44:51.102Z

TDD receipts on local macOS: setup-pairing-component initially left 2 prompts unconsumed (C1), then passed after local inbox/approve integration; declining initially returned the placeholder command instead of the waiting code's exact command (C2), then passed; empty-code scripts left retry prompts unconsumed and multi-code script left selection/confirmation unconsumed (C3), then passed; nonterminal C4 initially reported only 'optional Telegram remote', then passed after adding the known bot link. Wire shapes and admission are unchanged. SetupHub consumers found in cli/setup, setup/types, steps/{hub,aide,remotes}, handover, and setup-{hub,hub-component,handover,remote-component,remotes} tests; existing injected clients retain optional methods. Running the Coordinator-requested complete setup/onboarding/Telegram-pairing file list serially before source review.
