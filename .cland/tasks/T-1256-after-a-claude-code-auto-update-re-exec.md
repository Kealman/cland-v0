---
id: T-1256
kind: task
title: After a Claude Code auto-update re-exec the coordinator's bridge reconnects but its deliveries are acked and never run, with no alarm for an hour
state: open
status: in progress
size: M
labels:
  - needs-triage
assignee: null
parent: E-1280
blocked_by: []
topic: null
branch: t/T-1256-after-a-claude-code-auto-update-re-exec
created: 2026-10-24T18:39:16.111Z
updated: 2026-10-25T09:54:28.388Z
---

## Summary

At 17:28:20Z on 2026-10-24, Claude Code's fifth auto-update re-exec (2.1.309→2.1.310) restarted coord. hub.log shows bridge-closed at 17:28:20.215Z and bridge-connected at 17:28:23.776Z, and the role was refilled (T-1034). From then on every delivery to coord was acked but never ran as a turn. hub.log has no coord `inject-unconfirmed` between 17:28 and 18:28Z, so the hub kept believing it was delivering. The process exited at 18:28:20Z, exactly one hour later. cland-impl relaunched it at 18:35Z, and the 32 queued deliveries were injected at 18:38Z. Meanwhile impl-1255 waited 34 min for a coordinator-only verify resubmit, and the human's question waited too.

## Acceptance criteria

- [ ] C1. A delivery the mod acknowledges but never turns into a model turn within the confirmation window is reported as `inject-unconfirmed`, including after a re-exec that reconnects the bridge, with a red test reproducing the re-exec shape (test).
- [ ] C2. When the Coordinator has unconfirmed deliveries for more than 5 minutes, the hub posts a notice to the human in General and to the Aide or stand-in, naming the session and the recovery command (test).
