---
id: T-1362
kind: task
title: The hub pushes remote state to the workbenches, and Neovim's sessions panel shows a Remotes row
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1361
  - T-1348
topic: null
branch: null
created: 2026-10-27T05:46:49.834Z
updated: 2026-10-27T05:46:59.137Z
---

## Summary

A new remote-state frame reaches every client on connect and on every change. For each messenger it carries the connection, who is paired, mute, the outbox depth and the last error. Neovim's sessions panel shows one Remotes row per messenger from it, red the moment a remote goes offline or stops, long before General's 3-minute offline line.

## What to build

Spec §3.11 (the workbenches) and §3.9 (liveness, "the Remotes row turns red at once").

The gateway emits a change whenever a remote is disabled, stopped with a cause, goes offline at its first failed exchange (Telegram's poll loop already knows it is offline), recovers, is paired or unpaired, or changes mute. Outbox depth changes are coalesced to at most one push a second. The hub turns these changes into a client frame of the one protocol, sent in the connect snapshot and on every change. The frame is a client-safe projection of the status row: messenger, enabled, connection (connected, offline since, stopped, disabled), the paired name, mute, the outbox depth, and the last error with the cause from 01. It never carries a token, a fingerprint or a chat id. Older clients ignore it (additive frame; rule 20 consumer list).

Neovim's sessions panel draws a Remotes row beside the verification line. It shows facts only: for example "telegram · connected · paired Name · muted · outbox 0", and the cause on failure. The row uses the error highlight while the remote is offline or stopped. The row hides when no messenger is enabled.

**External wait and shared files:** E-1309 (T-1348's offline-since tracking must be on dev) · **Shared files:** hub/src/protocol.ts, hub/src/remote/gateway.ts, hub/src/remote/telegram-polling.ts, hub/src/hub/daemon.ts, nvim/lua/cland/panels.lua, nvim/lua/cland/hub.lua, nvim/lua/cland/init.lua

## Acceptance criteria

- [ ] C1. Through the frame harness, a client receives the remote-state frame on connect and after each change, with the fields named above and no token, fingerprint or chat id (test).
- [ ] C2. A failed exchange on the fake Bot API pushes the Telegram remote as offline within one second under an injected clock, and the next successful poll pushes it as connected (test).
- [ ] C3. Headless Neovim's sessions panel shows the Remotes row with connection, paired name, mute, outbox depth and last error, red within one second of a fake outage and plain again on recovery (test).
- [ ] C4. A client speaking the previous wire shape connects and works unchanged while the frame is sent (test).
