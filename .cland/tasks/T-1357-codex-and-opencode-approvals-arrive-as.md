---
id: T-1357
kind: task
title: Codex and OpenCode approvals arrive as cards with coloured choices, answered with `via` and shown as approved via Telegram
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1354
topic: null
branch: null
created: 2026-10-27T05:43:01.767Z
updated: 2026-10-27T11:28:09.351Z
---

## Summary

A Codex or OpenCode approval answered in the hub becomes a card. The card names the session, the harness and the command or the files, truncated with "full command in the workbench", and offers the harness's choices as coloured buttons. A tap answers through `approval.answer` with `via = "telegram"`, the card turns into its outcome, and both inboxes show the approval as answered via Telegram.

## What to build

The card model gains approvals with `answerIn = "hub"`. The text is "<session> asks to run" plus the harness, then the command (or the files of a change) truncated to a safe length that keeps the card inside 4096 code points and 100 entities, then "full command in the workbench" when cut. One row per choice the record offers, labelled "Approve once", "Always allow" and "Deny", styled success, primary and danger. There is no second confirmation for a dangerous command.

A press goes through `approval.answer` with the choice, and the hub stores it before the press is answered. The outcome edit shows the choice, who, where and when. An approval closed elsewhere, withdrawn by its harness or answered in the harness edits every copy the same way as ticket 03. Spec §3.5 and §3.1; v0.2 §3.4 and §3.8; fake harnesses in `hub/test/fakes/` (scripted Codex and OpenCode).

## Acceptance criteria

- [ ] C1. A fake Codex approval for a 5000-character command arrives as a card naming the session and "codex", with the command truncated, "full command in the workbench" and three styled buttons one per row (test).
- [ ] C2. "Approve once" on a fake Codex approval's card lets the fake command run, the outcome records `via = "telegram"`, and the card is edited to the outcome without buttons (test).
- [ ] C3. "Deny" on a fake OpenCode approval's card stops its command, and an approval answered in the web edits its card to "via web" (test).
- [ ] C4. Headless Neovim and headless Chromium show both answered approvals as answered "via Telegram" in their inboxes (test).
