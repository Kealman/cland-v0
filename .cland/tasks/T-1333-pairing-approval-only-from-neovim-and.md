---
id: T-1333
kind: task
title: Pairing approval only from Neovim and the CLI, binding numeric ids and replacing an earlier pairing
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by:
  - T-1332
topic: null
branch: null
created: 2026-10-26T07:54:42.979Z
updated: 2026-10-26T07:54:58.801Z
---

## Summary

Approving a pairing is new access, like `web.link`. The hub accepts it only from Neovim's connection and from the CLI, and refuses it from the web edge and from remotes. Approval binds the messenger's numeric ids in `hub.db`, replaces an earlier pairing with a line to the old chat, and clears the other waiting codes. Usernames never identify.

## What to build

A pairing-approve request authorized for the Neovim client and the CLI only, refused by the web authority and by the gateway's table. On approval: store the numeric ids, notify the previously paired chat with one line and replace it, and clear every other waiting code of that messenger. Spec §3.2. See Q-1296 §13.

## Acceptance criteria

- [ ] C1. Approving a waiting code is refused through the web edge and through the gateway, and accepted from a Neovim-client connection and from the CLI (test).
- [ ] C2. An approval binds the numeric ids in hub.db and clears the other waiting codes, and a second approval replaces the first with one line to the old chat (test).
