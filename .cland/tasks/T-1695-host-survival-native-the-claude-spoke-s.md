---
id: T-1695
kind: task
title: "host-survival-native: the Claude spoke's persisted response misses its 15 s window after master loss under load"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1686
topic: null
branch: null
created: 2026-11-05T19:05:01.746Z
updated: 2026-11-05T19:05:01.746Z
---

## Summary

`hub/test/host-survival-native.test.ts` "three remote harnesses retain births, forwards and welcomed spokes across 20s hub downtime and master loss" failed in impl-1692's loaded macOS batch (T-1692 evidence, about 13.7 of load, 7 burners, repetition 2). The error was `persisted spoke response cc tunnel: not within 15000 ms` after 56.8 s, for the Claude Code harness. T-1686 found and fixed the same symptom for Codex (`cx`): its confirmed resume path never emitted the reconnect signal, so a refused delivery was never retried. T-1686 judged Claude unaffected at the time, because its authenticated mod bridge already triggers `Sessions.#retry`. This failure suggests a remaining gap for Claude under load. The 15 s wait is a behaviour bound (post-master-loss response), so T-1692 kept it unchanged.

## What to build

Use the bounded bridge, recovery and injection diagnostics in impl-1692's artifact to find why the Claude spoke's persisted response does not arrive within 15 s after master loss under load. Candidates:
- the mod bridge re-attaching later than the window;
- the retry not firing after re-attach;
- a delivery being refused during reconnect and never replayed.

Fix it in the product. If the 15 s is not a real guarantee, derive the bound from the product's reconnect cadence and document it.

## Acceptance criteria

- [ ] C1. The cause is named with a reproduction under CPU load or a deterministic held-bridge test (red before the fix).
- [ ] C2. After the fix, host-survival-native passes 10/10 under CPU load (load 12–15) on macOS and in a Linux container run with `docker run --init` (evidence).
