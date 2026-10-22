---
id: T-1129
kind: task
title: Approval cards on the hub's approval records
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1123
  - T-1126
  - T-1111
topic: null
branch: null
created: 2026-10-22T15:16:14.682Z
updated: 2026-10-22T15:16:14.682Z
---

## Summary

A relayed approval shows as a card with the command in full and Approve once, Always for this command and Deny with a note, answered through E-414's gate; an approval that stays in a harness's TUI is marked "answer in Neovim" and has no buttons.

## Parent

E-417 (§3.4 approvals as cards; §3.8; P23; tracer step 5, the approvals half; answers through the gate of E-414).

## What to build

The asks and approvals section of the inbox shows each approval record of E-414 as a card (P23): the session, the harness, the command or the file change in full, since when, and the choices the record offers. Approve once and Always for this command answer at once; Deny opens a note that must be filled before Deny is enabled, and Escape never answers. The answer goes through the hub's gate, is shown pending until the receipt, then applied or failed; an answer refused because another client or the harness's TUI answered first folds the card to that outcome. An answered approval folds to one line with its outcome and follows the inbox's leave rule. A record the hub marks as staying in the harness's TUI (Claude Code) shows the command and "answer in Neovim" with no buttons. With an approval row selected, the drawer shows the session's recent thread. The card is one component the session's drawer of E-418 reuses. This ticket waits for E-414's record and Codex relay; if E-414 has not landed when its stage starts, the Coordinator moves it after E-414.

## Acceptance criteria

- [ ] C1. A fake Codex approval shows in the inbox as a card with its command in full and Approve once, Always for this command and Deny, and Approve once folds it with "approved once by the human", as a frame client reads it (Web test).
- [ ] C2. Deny stays disabled until a note is typed and Escape never answers; a denial reaches the record with its note (Web test).
- [ ] C3. A fake Claude Code approval shows marked "answer in Neovim" with no buttons (Web test).
- [ ] C4. An answer refused because another client answered first folds the card to the winner's outcome (Web test).
