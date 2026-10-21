---
id: T-1060
kind: task
title: A stopped hub with the web edge does not exit, and hub stop calls it not this project's hub
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-807
branch: t/T-1060-a-stopped-hub-with-the-web-edge-does-not
created: 2026-10-21T14:06:08.818Z
updated: 2026-10-21T14:06:49.695Z
---

## Summary

After `hub stop`, the hub at cb231eeb logs "stopped" but its process stays alive past the CLI's 10 s stop deadline. `cland hub stop` then reports the live pid as "not this project's hub" and leaves it running. Something that landed between 7c5e4028 and cb231eeb keeps the event loop alive after shutdown.

## Evidence

- Restart #38, 2026-10-21. The old hub pid 33756 (code cb231eeb) logged stop-requested at 14:03:21.79Z, stopping, 9 byes, and "stopped" at 14:03:23.80Z. The process did not exit within the CLI's 10 s STOP_DEADLINE.
- `cland hub stop` found the lock released (hub/src/cli/hub.ts ownsProject false) and printed "pid 33756 … is not this project's hub (it does not hold .cland/hub.lock); left it running and removed the stale hub.json". The restart recipe SIGKILLed it at +16 s. State had been flushed at "stopped", so nothing was lost, but the stop-to-serve gap grew to 20 s.
- At restart #37 the same recipe saw pid 92080 (code 7c5e4028) exit at once.
- Log: .cland/log/hub.log 14:03:21–14:03:38Z.
- Candidates: the web edge, tunnel and liveness timers of T-988/T-989, or T-1039's start path.

## Acceptance criteria

- [ ] C1. After "stopped", a served hub with the web edge enabled exits within 2 s with no open handles (test through a real `hub serve` process).
- [ ] C2. When `cland hub stop` sees the lock released by the pid it asked to stop and that pid is still alive, it reports "stopped, lock released, process still alive" and names the pid, not "not this project's hub" (test).
- [ ] C3. The handle that kept the loop alive is named in the item topic, with the commit that introduced it.
