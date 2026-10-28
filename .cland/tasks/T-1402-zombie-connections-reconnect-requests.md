---
id: T-1402
kind: task
title: Zombie connections, reconnect requests and invalid sessions resume without an identify, with the offline and recovery lines
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1400
  - T-1401
topic: null
branch: t/T-1402-zombie-connections-reconnect-requests
created: 2026-10-27T23:38:46.285Z
updated: 2026-10-28T09:16:04.643Z
---

## Summary

A missing heartbeat acknowledgement terminates the socket and resumes, and so do an op 7, a resumable invalid session and a dropped connection. The replayed events are deduplicated. A remote offline for 3 minutes says so once in General, and once more on recovery.

## What to build

**Zombies and resumes.** When no ACK arrived between two heartbeats, the socket is terminated without a close frame (never 1000 or 1001). The remote reconnects to `resume_gateway_url` and sends RESUME with the session id and the last sequence.

**The cases.**
- An op 7, a drop without a close code, and the close codes that allow it all resume.
- An op 9 with `d: true` resumes.
- An op 9 with `d: false` identifies afresh after a random 1 to 5 seconds.
- Reconnects back off with jitter and a cap.

**Replays.** Replayed dispatches arrive in order and are deduplicated by message and interaction id against what was already handled. Handling a replayed click is ticket 17's.

**Liveness.** The remote shows connected only after a recent acknowledgement. After 3 minutes offline, the socket down past a resume or REST sends failing, General gets one line "Discord remote offline since HH:MM: <reason>". It gets one more line on recovery, and the status row turns offline at once.

**The fake gateway.** Its sessions buffer events and replay them on RESUME inside a window under the injected clock. Its control withholds acknowledgements, drops the socket, sends op 7 or op 9 and counts identifies and resumes.

Spec §3.8 (connection, resume), §3.9 (liveness, telling the human); research rules 9, 10 and 14.

## Acceptance criteria

- [ ] C1. With the fake withholding heartbeat acknowledgements, the remote terminates the socket without code 1000 or 1001 and resumes, and a message the human typed meanwhile reaches General exactly once (test).
- [ ] C2. Ten forced drops, an op 7 and an op 9 with `d: true` each resume, and the fake counts no identify beyond the first (test).
- [ ] C3. An op 9 with `d: false` leads to one fresh identify after a wait of 1 to 5 seconds under the injected clock (test).
- [ ] C4. Three minutes without a working connection give one "Discord remote offline since" line in General and one recovery line, and the status row shows offline at once (test).

## Notes

Shared files: discord-socket.ts, discord.ts; hub/test/fakes/discord/ (gateway sessions)
