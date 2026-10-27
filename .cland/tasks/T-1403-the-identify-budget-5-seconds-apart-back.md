---
id: T-1403
kind: task
title: "The identify budget: 5 seconds apart, back-off only after failed identifies, the floor of remaining starts and the warning at 500"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1402
topic: null
branch: null
created: 2026-10-27T23:38:46.427Z
updated: 2026-10-27T23:38:46.427Z
---

## Summary

Identifies are spaced, counted in `hub.db` and guarded, so no crash or reconnect loop can reach Discord's 1000 a day, which would reset the token. Resume always comes first, and back-off follows only identifies that never reached READY. The remote stops below a floor of remaining session starts, and the human is warned at 500 identifies in a day.

## What to build

**The count.** Identify timestamps live in `hub.db` under the `discord` messenger, as a rolling 24 hours. Each identify waits at least 5 seconds after the previous one, across hub restarts too.

**Back-off.** It grows only after identifies that ended before READY, from 5 seconds, doubling, capped at 5 minutes, with equal jitter. A drop after READY reconnects without it.

**The floor.** Before each identify the remote reads `session_start_limit` from `GET /gateway/bot`. Below the floor of 100 it stops through 06's `identify-budget` cause with a warning naming when starts reset (`reset_after`), and sends no identify.

**The warning.** When the hub's own count reaches 500 in 24 hours, General gets one warning line, at most once per rolling day.

The fake's control sets `remaining` and `reset_after`.

Spec §3.8 (identify budget); research rule 12; Q-1293 (the 33-second recovery delay that back-off after every drop caused).

## Acceptance criteria

- [ ] C1. Two identifies are never less than 5 seconds apart under the injected clock, including across a hub restart, and the identify count is read back from `hub.db` (test).
- [ ] C2. Identifies that end before READY are followed by growing jittered waits, and a drop after READY reconnects without that back-off (test).
- [ ] C3. A `remaining` below the floor on the fake stops the remote with the `identify-budget` cause and a warning naming when starts reset, and sends no identify (test).
- [ ] C4. The 500th identify in 24 hours writes one warning line in General, and the 501st writes none (test).

## Notes

Shared files: discord-socket.ts
