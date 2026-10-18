---
id: T-777
kind: task
title: selection-replay.ts ignores --count for package replay and iterates every landing
state: open
status: backlog
size: XS
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-18T05:03:00.942Z
updated: 2026-10-18T06:27:15.053Z
---

## Summary

Found by impl-709 on 2026-10-18 at 05:01Z, during T-709. hub/test/selection-replay.ts parses `--count`, but only the coverage replay applies it. The non-coverage package replay iterates every landing instead of the requested window. T-709's dedicated Neovim replay slices exactly 40 itself.

## What to build

Package replay slices to the last `--count` landings, the same way coverage replay does, and fails clearly when fewer landings exist than requested.

## Acceptance criteria

- [ ] C1. A T1 test runs package replay with `--count 3` over five recorded landings and gets exactly the last three, and fails before the fix.
