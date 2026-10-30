---
id: T-1471
kind: task
title: One harness process per Claude Code launch
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: null
branch: null
created: 2026-10-30T07:50:17.744Z
updated: 2026-10-30T07:50:17.744Z
---

## Summary

A relaunch that follows a TERM leaves the daemon's job alive or respawns it. Both processes share the same settings and CLAND_SESSION_ID, so two "coord" processes join one session: the last bridge wins, and the hooks and poll mix both. This happened at 06:23 and again at 07:34; two twins are live now. Stop the old job explicitly, and bind spokes, hooks and bridges to a fresh per-launch id in a new settings file, so the old job's processes are refused.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [ ] C1. `session resume --relaunch` on a Claude Code row runs `claude stop <previous harnessId>` even when the recorded pid is gone or the row is `exited`.
- [ ] C2. Each launch writes its own settings and MCP files with a new launch id; a spoke, hook or bridge carrying an earlier launch id is refused with "belongs to an earlier launch".
- [ ] C3. A second spoke whose hooks carry a different harness session id than the row logs `duplicate-harness` and posts one Agents notice naming both job ids and pids.
