---
id: T-1320
kind: task
title: The hub ran out of its 4 GB heap during a release dry-run's web bundle build
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1185
branch: t/T-1320-the-hub-ran-out-of-its-4-gb-heap-during
created: 2026-10-26T02:27:30.262Z
updated: 2026-10-29T16:00:08.554Z
---

## Summary

The hub (pid 686, restart #56, default 4 GB heap, about 23.6 h up) died with "FATAL ERROR: Reached heap limit" at about 02:21Z on 2026-10-26, while serving `cland release --item R-1277 --dry-run`. The last log lines before the Mark-Compact at 4091 MB are the dry-run's web bundle build ("✓ built in 1.06s"); .cland/release-web/7f4d74d2… holds the bundle and an 82 MB source.tar. A rerun on the restarted hub (#57, 8 GB heap) passed at about 780 MB RSS, and the real release also passed.

## What to build

Find what the release preview holds in hub memory during the web bundle build (the 82 MB source tar, build output buffers, or the hub's accumulated state over a long uptime), and keep it bounded so a dry-run on a long-lived default-heap hub cannot exhaust it. Profile with the SIGUSR1 inspector recipe on a scratch hub (rule 15), never the live one.

## Acceptance criteria

- [ ] C1. A release dry-run with the web bundle on a scratch project's hub peaks within a stated heap bound, measured and recorded with the commands used, and a regression test asserts the bundle step streams rather than buffers the source tar (test).
