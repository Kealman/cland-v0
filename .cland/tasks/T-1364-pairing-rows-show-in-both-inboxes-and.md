---
id: T-1364
kind: task
title: Pairing rows show in both inboxes, and Neovim's card approves them
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by: []
topic: null
branch: null
created: 2026-10-27T05:46:50.196Z
updated: 2026-10-27T05:46:59.738Z
---

## Summary

A waiting pairing code shows in Neovim's and the web's inbox as "Pair Telegram user 12345 (Name)? code …". Neovim's card approves it through `pairing.approve`. The web row says "approve in the terminal or Neovim", shows the CLI command, and offers no approve.

## What to build

Spec §3.2 and §3.11; ADR 0005 (Neovim stays the host). The hub already publishes `inbox.pairings` rows with their text, command and expiry, and accepts `pairing.approve` only from a Neovim connection or the CLI. Both inboxes render these rows in the asks and approvals section (see the open question), counted in that section's count.

Neovim: the row opens a small card with the messenger, the user's name and id, the code and when it expires. One key approves, bound through Neovim's key map. The card sends `pairing.approve` over Neovim's connection and reports the paired name or the hub's refusal.

Web: the row and its detail show the text, "approve in the terminal or Neovim" and the command as copyable text. There is no approve button and no binding that approves, at desktop and phone width.

An approved, replaced or expired code leaves both inboxes when the next inbox update arrives.

**External wait and shared files:** none (codes and `pairing.approve`, T-1332 and T-1333, are on dev) · **Shared files:** nvim/lua/cland/inbox.lua, web/src/InboxArea.tsx, web/src/InboxArea.module.css

## Acceptance criteria

- [ ] C1. Headless Neovim shows a waiting Telegram code and a waiting Discord code from the test messenger as "Pair <Messenger> user <id> (<Name>)? code …" rows in the inbox (test).
- [ ] C2. Approving from Neovim's card pairs the test messenger, and the row leaves both Neovim's and the web's inbox (test).
- [ ] C3. Headless Chromium shows the row with "approve in the terminal or Neovim" and its `cland remote approve` command, at desktop and phone width, with no approve control and no key that approves (test).
- [ ] C4. A code that expires under an injected clock leaves both inboxes (test).
