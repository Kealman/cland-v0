---
id: T-483
kind: task
title: "Hotfix: T-253's fail-fast exits on the 5 s stall warning threshold; a slow tracker operation under load kills the hub"
state: open
status: in progress
size: S
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: R-294
blocked_by: []
regression_of: T-253
topic: null
branch: t/T-483-hotfix-t-253-s-fail-fast-exits-on-the-5
created: 2026-10-15T09:18:55.709Z
updated: 2026-10-15T09:19:40.369Z
---

## Summary

The hub exited at 09:14:40Z on 2026-10-15 through T-253's fail-fast. A "planned check" on T-467 had run for about 5.2 s under load. `onStorageStall` (hub/src/hub/daemon.ts:144) fires at the stall-detection threshold STORAGE_STALL_MS = 5000 (tracker.ts:73), the threshold that before T-253 only logged a `tracker-storage-stalled` warning, as one did at 05:03Z for T-390's ready check. A slow but finishing operation under load now takes down the hub and every session's connection. This is a hotfix, rank top.

## What to fix

Separate the two thresholds. At STORAGE_STALL_MS the hub keeps warning (`tracker-storage-stalled`, `hub status`). The fail-fast fires only when the same operation is still outstanding at a fatal deadline, for example 60 s, configurable as `[tracker] fatal_stall`, with the test knobs kept separate. A slow operation that completes before the fatal deadline costs a warning, never an exit.

## Acceptance criteria

- [ ] C1. An operation held for 6 s and then released logs `tracker-storage-stalled` and completes, and the hub keeps serving, proven by a test.
- [ ] C2. An operation still held at the fatal deadline triggers T-253's fail-fast exactly as before, proven by T-253's tests with the fatal deadline set.
- [ ] C3. hub/README.md describes both thresholds and the setting.
