---
id: T-1802
kind: task
title: "cland-auth thaw is not idempotent: a replay after a lost thaw receipt is refused when the disk is already unfrozen"
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1884
blocked_by:
  - T-1781
regression_of: T-1776
found_by: review
topic: null
branch: null
created: 2026-11-10T08:10:09.103Z
updated: 2026-11-16T07:29:11.668Z
---

## Summary

`hub/src/host/cland-auth.sh` runs `thaw` as a bare `fsfreeze -u`. If the hub loses a thaw's receipt and replays it, the helper refuses because the filesystem is already unfrozen, so the caller cannot tell a completed thaw from a failed one. T-1781's snapshot scheduler therefore keeps the freeze and the release fence on that refusal, which is safe but blocks the login until someone reconciles it.

## Context

Found in T-1781's source work, 2026-11-10 (impl-1781). No agent or helper edit was made in T-1781.

## Acceptance criteria

- [ ] C1. A `cland-auth thaw` on an unfrozen mount of a validated `/cland/auth/<x>` path exits 0 with a distinct "already thawed" result, and a thaw on a frozen mount still unfreezes it (test).
- [ ] C2. Malformed paths and volume names are still refused before any `fsfreeze` call (test).
- [ ] C3. T-1781's replay after a lost thaw receipt clears the freeze and the fence on "already thawed" (test).
