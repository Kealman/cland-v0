---
id: T-906
kind: task
title: cland hub status reports a live, serving hub as 'does not answer' (hub.status slower than the probe timeout)
state: open
status: in progress
size: S
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: topic-647
branch: t/T-906-cland-hub-status-reports-a-live-serving
created: 2026-10-19T20:06:03.703Z
updated: 2026-10-19T20:28:12.019Z
---

## Summary

On 2026-10-19, with about 40 sessions, `cland hub status` reported "pid … holds hub.json but does not answer" for a live, serving hub (pid 14662 before restart #21 and pid 98217 after it). Other requests (`session list`, `merge queue`, `verify queue`) answered within 0.15 s. The CLI's `hub.status` request (socket-client `probe`) exceeds its timeout, so `hub status` and `hub start`'s live check misreport a healthy hub as mute.

## Acceptance criteria

- [ ] C1. (T1/T2) `hub.status` answers within the probe's timeout for a hub with 40 sessions and a 200 MB log, or the probe uses a lightweight liveness request and `hub status` fetches the full status separately. A test with a slow status computation shows that `inspect` still reports the hub live.
- [ ] C2. The slow part of `hub.status` is identified and named in the item (for example executor or session probing), with its measured time.
