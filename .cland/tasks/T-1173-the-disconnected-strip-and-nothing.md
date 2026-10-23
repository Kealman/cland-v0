---
id: T-1173
kind: task
title: The disconnected strip and nothing queued
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1168
  - T-1171
topic: null
branch: null
created: 2026-10-23T07:00:04.276Z
updated: 2026-10-23T07:00:04.276Z
---

## Summary

When the socket drops, the phone shows a strip under the header saying since when and when the next retry runs, with Retry; the last snapshot stays with its time; answers, approvals and Send are disabled and nothing is queued; on reconnect the client resumes and the strip goes.

## Parent

E-419 (§3.6 the disconnected strip, P41 and P42; tracer step 5).

## What to build

- **The connection** exposes when it dropped, when the next attempt runs on its backoff, the time of the last frame it applied, and a retry that connects at once and resets the backoff. Resume from the sequence number and the fresh snapshot after a refused resume stay as they are.
- **The strip** sits under the header at phone width: "Disconnected since 14:10 · retry in 8 s", counting down, with a Retry at least 44 px tall. The desktop keeps its hub dot.
- **The last snapshot** stays on screen; the inbox title adds "as of" with the time of the last applied frame.
- **Disabled while disconnected:** ask options, the free answer, Decline, approval buttons, the composer's Send and the reply's Send, whose label row reads unsent. Nothing is queued: no command leaves the page while disconnected and none is replayed after reconnecting, since another client may answer first; drafts stay drafts.
- **On reconnect** the strip goes and the screens show the current state without a reload.

## Acceptance criteria

- [ ] C1. With the hub stopped, the strip at 390x844 shows when the socket dropped and a counting retry time, and Retry starts an attempt at once (Web test).
- [ ] C2. While disconnected the inbox keeps its rows with "as of" and the time, and ask options, approval buttons and Send are disabled with the reply's label reading unsent (Web test).
- [ ] C3. A draft written while disconnected is not sent after the hub restarts, as the topic's history reads, and stays in the composer (Web test).
- [ ] C4. After the hub restarts the strip goes and an ask raised while the page was disconnected shows without a reload (Web test).
- [ ] C5. `web/README.md` describes the disconnected state and why nothing is queued (docs).
