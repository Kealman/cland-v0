---
id: T-1134
kind: task
title: "The account model: the Accounts area and the accounts strip"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1130
topic: null
branch: null
created: 2026-10-22T15:16:15.395Z
updated: 2026-10-22T15:16:15.395Z
---

## Summary

The Accounts area lists the registry with every window its source sent, and the Sessions area gains the strip of P20, both drawn from one account model over the snapshot's account views.

## Parent

E-418 (§3.2 the Accounts area and the accounts strip, P20; v0.1.2 §3.13; tracer steps 2 and 5). One ticket because the area and the strip are two read-only renderings of the same model and fixture.

## What to build

- **The account model** (pure): per account its windows with the used share, the reset time and the colour (amber from 75 percent, red from 90, or the source's severity); the worst window (the highest used share); the reading's age and source (the session that sent it, or a poll); the limited mark (since, reason, the session that hit it, the reset or "until cleared"); and the cases without data (no reading yet, signed out, OpenCode's none), which never read 0 percent.
- **The Accounts area** (read-only): one block per account in registry order, the synthetic defaults last, with its name, harness and directory or database path (never a secret), then every window with its share, reset, the reading's age and source, and the limited mark; the registry's error when it fails to read. Opening the area asks the hub to poll the idle accounts (`account.poll`), as Neovim's sessions panel does; clearing a limited mark stays in the CLI.
- **The strip** in the Sessions area: one cell per account in registry order with its name, harness and worst window as a share, a meter along the foot and the reset; a limited account in red with its reset and the session that hit it; a dash without data; the other windows, the age and the source in the cell's tooltip. The strip folds like a block and links to the Accounts area.

Neovim's `accounts.lua` defines the formats. The profile block joins the top of this area in the sign-in slice.

## Acceptance criteria

- [ ] C1. The account model gives the worst window, amber from 75 and red from 90 percent, the limited mark with its reset, and a dash, never 0 percent, for an account with no reading, signed out or on OpenCode (T1 test).
- [ ] C2. With a registry of three fake accounts with limit readings, one limited, the Accounts area lists each in registry order with its harness, path and every window with its share, reset, age and source, and the limited one with its mark (Web test).
- [ ] C3. Opening the Accounts area sends one `account.poll` (Web test).
- [ ] C4. The strip shows a cell per account with its worst window and reset, the limited account in red with its reset and the session that hit it, the other windows in the tooltip, and its link opens the Accounts area (Web test).
- [ ] C5. `web/README.md` describes the Accounts area and the strip (docs).
