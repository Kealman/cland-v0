---
id: T-2009
kind: task
title: "host-supervisor teardown race: a replacement 'host serve' started while restart-owner shutdown is held can escape the join on Linux"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: topic-1740
branch: t/T-2009-host-supervisor-teardown-race-a
created: 2026-11-19T14:42:13.379Z
updated: 2026-11-24T11:06:40.587Z
---

## Summary

`hub/test/host-supervisor.test.ts :: teardown joins a replacement started while restart-owner shutdown is held` failed once on Linux, in T-1991's full run 56cc3b92 (droplet, x64, Node 24.21.0, A-21814 lines 47340–47365). That item doesn't touch the supervisor. Literal output: `AssertionError [ERR_ASSERTION]: replacement started during teardown is joined`, with actual `[{ pid:123505, parent:1, …, command:'/opt/node/bin/node /home/runner/cland/hub/bin/cland.ts host serve' }]` and expected `[]`, at host-supervisor.test.ts:216. The file then passed 5 times out of 5 alone on local macOS arm64 at the same head (impl-1991, 2026-11-19 14:42Z), so this is an intermittent teardown race on Linux. A replacement `host serve` was left orphaned (parent 1).

## What to build

Find why a replacement started during held restart-owner shutdown can escape the teardown join on Linux, and fix the join so the case is deterministic. Reproduce first with a forced ordering at the restart-owner hold.

## Acceptance criteria

- [ ] C1. A deterministic regression forces the replacement to start at the hold point, fails on the current code, and passes after the fix (test).
- [ ] C2. No `host serve` process outlives the file in a post-run census on Linux (test).

## Comments

### impl-2009 · 2026-11-24T10:57:14.327Z

Initial audit: specified hold regression is still present, including native birth check before release and empty post-file cwd census. closeSupervisors/restartOwners are file-local; production supervisor.sh is unchanged since triage. No source edits yet; native red/green admission queued by Coordinator. Local macOS forced ordering evidence will be distinguished from original Linux timing.

### impl-2009 · 2026-11-24T11:06:40.587Z

A-22865 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22865-t-2009-deterministic-discovery-loss-red-and-green.md) records local macOS arm64 Node24.21.0 red/green. Discovery-loss control: replacement relocates cwd after owner stop, with durable pid/cwd receipt and independent native census. Current teardown failed literal 'replacement started during teardown is joined' (parent1); capturing births before owner stop plus final discovery passed 4/4 and empty post-file census. This control does not establish original Linux timing cause. Linux C2 pending reviewed-head mode-free verification. Audit: closeSupervisors/restartOwners are file-local; only per-file test guidance references flow; shared cleanup and production supervisor unchanged; no reachable T1 test from test-only diff.
