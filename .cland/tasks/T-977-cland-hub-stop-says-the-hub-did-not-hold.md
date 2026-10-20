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
updated: 2026-10-20T15:39:08.911Z
---

## Summary

At restart #31 (2026-10-20 12:50Z), the stand-in ran `cland hub stop`. It reported that pid 63030 did not hold hub.lock and "left it running", yet the process exited within 12 s by itself. The message misdescribes the outcome and invites a manual kill (T-906 family: hub status and stop probes misreport a live or dying hub).

## What to build

`cland hub stop` re-reads lock ownership after the stop request, and reports the actual outcome: stopped, still running (with pid), or not this project's hub. The message never says "left running" for a process that exits within the stop window.

## Acceptance criteria

- [ ] C1. A T2 test with a fake hub that exits after the stop request reports "stopped", not "left it running".
- [ ] C2. A hub that genuinely survives the window is still reported as running, naming its pid.
