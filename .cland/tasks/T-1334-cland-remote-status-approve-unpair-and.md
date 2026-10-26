---
id: T-1334
kind: task
title: cland remote status, approve, unpair and test, and token rotation that keeps the pairing
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by:
  - T-1333
  - T-1331
topic: null
branch: null
created: 2026-10-26T07:54:43.248Z
updated: 2026-10-26T07:54:59.219Z
---

## Summary

`cland remote status|approve|unpair|test` manage remotes from the terminal. A rotated token keeps its pairing, since pairings key on numeric ids.

## What to build

`status` per messenger shows: token presence with its fingerprint, paired with whom, connection state, last inbound and outbound, outbox depth, mute, and the bot link. `approve <messenger> <code>` prints the paired name and id. `unpair <messenger>` forgets a pairing. `test <messenger>` checks the token through the messenger client seam and sends one line to the paired chat (the test messenger here; the platform side comes with the clients). Token rotation through `cland secret set` plus `cland hub reload` keeps the pairing. Spec §3.10 and §3.3.

## Acceptance criteria

- [ ] C1. Each of `status`, `approve`, `unpair` and `test` behaves as spec §3.10 says against a test messenger, with no token value in any output (test).
- [ ] C2. After `cland secret set` with a new token and `cland hub reload`, the test messenger reconnects still paired (test).
