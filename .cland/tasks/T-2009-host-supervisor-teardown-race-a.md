---
id: T-2009
kind: task
title: "host-supervisor teardown race: a replacement 'host serve' started while restart-owner shutdown is held can escape the join on Linux"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-19T14:42:13.379Z
updated: 2026-11-19T14:42:13.379Z
---

## Summary

`hub/test/host-supervisor.test.ts :: teardown joins a replacement started while restart-owner shutdown is held` failed once on Linux, in T-1991's full run 56cc3b92 (droplet, x64, Node 24.21.0, A-21814 lines 47340–47365). That item doesn't touch the supervisor. Literal output: `AssertionError [ERR_ASSERTION]: replacement started during teardown is joined`, with actual `[{ pid:123505, parent:1, …, command:'/opt/node/bin/node /home/runner/cland/hub/bin/cland.ts host serve' }]` and expected `[]`, at host-supervisor.test.ts:216. The file then passed 5 times out of 5 alone on local macOS arm64 at the same head (impl-1991, 2026-11-19 14:42Z), so this is an intermittent teardown race on Linux. A replacement `host serve` was left orphaned (parent 1).

## What to build

Find why a replacement started during held restart-owner shutdown can escape the teardown join on Linux, and fix the join so the case is deterministic. Reproduce first with a forced ordering at the restart-owner hold.

## Acceptance criteria

- [ ] C1. A deterministic regression forces the replacement to start at the hold point, fails on the current code, and passes after the fix (test).
- [ ] C2. No `host serve` process outlives the file in a post-run census on Linux (test).
