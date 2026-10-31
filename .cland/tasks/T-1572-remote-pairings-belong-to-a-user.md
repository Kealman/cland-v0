---
id: T-1572
kind: task
title: Remote pairings belong to a user
state: open
status: backlog
size: M
criterion_seq: 8
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1561
  - T-1562
topic: null
branch: null
created: 2026-10-31T23:47:53.485Z
updated: 2026-10-31T23:52:17.496Z
---

## Summary

In users mode a pairing belongs to one user. An admin approves the code from Neovim or `cland remote approve <messenger> <code> --user <name>`, a new pairing of the same user and messenger replaces the old one, and input from a paired chat arrives as that user. This ticket is the expand step: storage, approval, inbound identity and the journal. Outbound fan-out follows in L16 and L17. Single mode keeps one pairing per messenger.

Hot files: `hub/src/remote/state.ts` (a new per-user pairings table; `remote_pairings` stays for single mode), `hub/src/remote/pairing.ts`, `hub/src/remote/telegram-inbound.ts`, `hub/src/remote/discord-inbound.ts`, `hub/src/remote/gateway.ts` (trusted per-input user beside the ingress), `hub/src/hub/dispatch.ts` [Host] (`pairing.approve`), `hub/src/cli/remote.ts`, `nvim/lua/cland/pairing_card.lua`, `hub/src/hub/web-authority.ts` [Host] (unchanged rule, new field).

## Acceptance criteria

- [ ] C1. In users mode `cland remote approve <messenger> <code> --user <name>` pairs that chat with that user, and the approval without `--user` is refused with a message naming the flag.
- [ ] C2. The Neovim pairing card asks for the user in users mode and approves the pairing for the chosen user.
- [ ] C3. Two users pair two Telegram chats, and each chat's messages and answers arrive in the hub as its own user.
- [ ] C4. A new pairing of one user and messenger replaces only that user's old pairing.
- [ ] C5. The pairing's journal record carries the paired user's id and the approving user's id, and never the code.
- [ ] C6. The gateway's authority table and its refusals are unchanged, and the user of a remote input comes only from its pairing, never from the frame.
- [ ] C7. In single mode pairing, replacement and inbound tests pass unchanged.
- [ ] C8. `cland auth reset` keeps the first user's pairing per messenger and revokes the other users' pairings through T-1558's reset step (A-15078 A3), proven by a test.
