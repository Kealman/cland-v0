---
id: T-1472
kind: task
title: A `deaf` state for a live harness that cannot take deliveries
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: null
branch: null
created: 2026-10-30T07:50:18.206Z
updated: 2026-10-30T11:34:08.728Z
---

## Summary

A live process with deliveries held or unconfirmed for minutes looks like `running/busy` today. Retry refuses it and nobody is told. Derive a `deaf` mark and tell the human.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

The existing `inject-stalled` alert is the wrong signal today. After each hub restart it fires on a replay of an id that was already delivered or superseded (178eaf76 at 08:43Z, 09:15Z and 11:06Z; merge-batch:334e3a59 at 09:18Z and 11:01Z), while fresh deliveries land within seconds. It reaches the human's Telegram and tells them to relaunch the Coordinator when nothing is wrong, yet the real deaf spell at 06:53Z raised no alert until 07:26Z (cland-impl, 2026-10-30 11:32Z, at the human's question). `deaf` replaces that alert.

## Acceptance criteria

- [ ] C1. A running session with a human delivery queued, or a delivery acked but not injected, for over 5 min while its pid is alive shows `deaf` in `cland session list`, `hub.status` and the workbench.
- [ ] C2. On entering `deaf`, the hub posts one Agents notice and one human inbox entry naming the session, the oldest held message id and the recovery command; for the Coordinator, also one General line.
- [ ] C3. The `deaf` mark and its inbox entry clear on the session's next `injected` event.
- [ ] C4. A replayed id the session already confirmed, or one followed by a later `injected` for the same session, raises no `inject-stalled` or `deaf` alert and no human inbox entry. Shown by a restart fixture that replays a confirmed id while fresh deliveries inject.
