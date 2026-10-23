---
id: T-1169
kind: task
title: "Approvals on the phone: the sheet and the TUI mark"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1168
  - T-1129
topic: null
branch: null
created: 2026-10-23T07:00:02.795Z
updated: 2026-10-23T07:00:02.795Z
---

## Summary

At phone width a relayed approval opens in the ask's bottom sheet with its command in full, Approve once, Always for this command and Deny with a note on the label row; an approval that stays in a harness's TUI shows marked "answer in Neovim" and never opens a sheet.

## Parent

E-419 (§3.6 what stays on the desktop; §3.8; P41's marked row; tracer step 2, approvals). Reuses the approval card of T-1129.

## What to build

- **Relayed approvals** (Codex, OpenCode): a tap on the row opens the sheet of the ask ticket with the session, the harness, the command or file change in full and since when, then Approve once and Always for this command as full-width buttons at least 44 px tall. Deny sits on the note field's label row and stays disabled until a note is typed. The same closing rules hold: Escape, the scrim, the close button and a swipe never answer.
- **The outcome.** The answer goes through the hub's gate as T-1129's card sends it; the sheet closes and the row folds to its outcome, including the winner's outcome when another client or the TUI answered first.
- **TUI-bound approvals** (Claude Code): the row shows the command marked "answer in Neovim", has no buttons and opens no sheet.

## Acceptance criteria

- [ ] C1. At 390x844 a fake Codex approval row opens a sheet with its command in full and Approve once, Always for this command and Deny, each at least 44 px tall, and Approve once folds the row to its outcome as a frame client reads it (Web test).
- [ ] C2. Deny on the label row stays disabled until a note is typed, and Escape, the scrim and a swipe leave the approval pending (Web test).
- [ ] C3. A fake Claude Code approval row shows marked "answer in Neovim" with no buttons and opens no sheet at 390x844 (Web test).
