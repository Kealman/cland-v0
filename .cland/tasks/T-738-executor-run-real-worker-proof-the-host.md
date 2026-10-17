---
id: T-738
kind: task
title: "executor-run real-worker proof: the 'host gate … (not repeated)' reuse marker is intermittently absent from a passing run's log"
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T14:48:29.088Z
updated: 2026-10-17T14:57:08.927Z
---

## Summary

impl-700 saw it once on the Mac while migrating executor-run (T-700, 2026-10-17): the real-worker host-receipt scenario passed remotely, but its log lacked the expected `typecheck: host gate at <tree> (not repeated)` line. It passed 5/5 alone, 8/8 with the preceding delivery cases, and 5/5 as consecutive whole files. The original failed receipt is retained on T-700. The proof comes from T-680. The root cause is unknown: either the marker is written after the log is read, or the host-gate reuse is sometimes skipped.

## What to build

Find out which. If the reuse is sometimes skipped, that's a product bug in the host gate, so fix it there. If the log is read before the marker is flushed, wait for the run's completion receipt before reading. Use T-700's new hash/marker diagnostics.

## Acceptance criteria

- [ ] C1. The cause is named with evidence, and the case passes 20/20 whole-file runs on the Mac plus the task's droplet verify.

## Comments

### coord · 2026-10-17T14:57:08.927Z

Cause found by impl-700 (A-4556), independent of T-700's diff: when the first RemoteRun.start receipt is pending and the start succeeds on retry, Suites.#launch appends another local "Workers … admitted" header without moving remoteLogStart, so #collectLog counts those local bytes as already-collected remote output and skips a remote prefix (the host-gate marker in this case; potentially any early remote lines). Deterministic T1 replay fails in ~68 ms on dev. Product bug in remote log collection, not only a test flake.
