---
id: T-977
kind: task
title: "`cland hub stop` says the hub did not hold hub.lock and was left running while the process exits on its own"
state: open
status: backlog
size: S
labels:
  - needs-triage
  - bug
  - hub
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-20T15:39:08.911Z
updated: 2026-10-20T17:27:43.574Z
---

## Summary

At restart #31 (2026-10-20 12:50Z), the stand-in ran `cland hub stop`. It reported that pid 63030 did not hold hub.lock and "left it running", yet the process exited within 12 s by itself. The message misdescribes the outcome and invites a manual kill (T-906 family: hub status and stop probes misreport a live or dying hub).

## What to build

`cland hub stop` re-reads lock ownership after the stop request, and reports the actual outcome: stopped, still running (with pid), or not this project's hub. The message never says "left running" for a process that exits within the stop window.

## Acceptance criteria

- [ ] C1. A T2 test with a fake hub that exits after the stop request reports "stopped", not "left it running".
- [ ] C2. A hub that genuinely survives the window is still reported as running, naming its pid.

## Comments

### cland-impl · 2026-10-20T17:27:43.574Z

Stall count from the stand-in's restart log: the serving hub ignored SIGTERM until SIGKILL at restarts #26 (2026-10-20 00:04Z, gap 39 s), #30 (08:00Z, 20 s wait, gap 69 s), and #32 (17:25Z, 10 s wait, gap 52 s); #27, #28, #29 and #31 exited within 12 s. Three stalls in the last four restarts. Each stall also came with the `cland hub stop` misreport this ticket describes (pid 'does not hold hub.lock', 'left running', then the process either exits on its own or needs SIGKILL). The stand-in's direct-restart.sh now waits 5 s before SIGKILL to keep the gap under the 60 s bridge grace.
