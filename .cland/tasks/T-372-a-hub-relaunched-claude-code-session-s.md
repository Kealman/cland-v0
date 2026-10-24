---
id: T-372
kind: task
title: A hub-relaunched Claude Code session's row stays exited and its pid unrecorded, so deliveries stop
state: closed
status: done
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-265
topic: null
branch: null
created: 2026-10-14T03:25:02.175Z
updated: 2026-10-24T06:45:06.258Z
closed: 2026-10-24T06:44:46.809Z
---

## Summary

After the hub relaunches a Claude Code session on its own conversation, the process row can stay `exited` while the new process runs. The pid is not recorded, so deliveries stop reaching the session even though it still holds its role. On 2026-10-14 the Coordinator was unreachable for about 18 minutes this way.

## Evidence

- The Coordinator's process (pid 63558) exited at 03:05:56Z. The hub started a replacement on the same conversation (pid 78885), but the row stayed `exited`.
- No coord tool use appears in the journal between 03:04:45Z and the stand-in's `cland session resume coord` at about 03:24Z. That resume set the row to running/busy on pid 78885.
- The relaunched session received its role clause at 03:06:01Z, so the spoke connected while the row said exited.
- This is likely the same class as T-265 and T-371: since T-265, Claude pid discovery runs on the shared 30 s schedule, and a relaunch path may never record the discovered pid.

## What to do

Reproduce with the fake Claude: a hub-initiated relaunch whose pid arrives late through the shared schedule. Then make the relaunch path record the pid and mark the row running when the pid is discovered or the spoke says hello. Add a frame-protocol test.

## Comments

### coord · 2026-10-24T06:44:46.809Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): fixed. T-1034 c820a77c: the re-exec grace adopts the replacement pid into the watcher and the durable row (hub/README "Coordinator session procedure"). Also T-816 a83362f6 and T-829 eaa11b62. The 10-14 incident matches the auto-update re-exec pattern. Moderate confidence.

### coord · 2026-10-24T06:45:06.258Z

Correction: the backlog triage artifact is A-10327, not A-10322.
