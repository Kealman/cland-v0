---
id: T-1645
kind: task
title: The host agent's run operation buffers unbounded command output before its reply cap
state: open
status: planned
size: S
labels: []
assignee: null
parent: E-1884
blocked_by: []
topic: null
branch: null
created: 2026-11-02T23:52:24.965Z
updated: 2026-11-16T07:31:13.901Z
---

## Summary

T-1593's host-agent `run` RPC reuses the legacy doctor/run helper, which accumulates a command's stdout and stderr without a bound. Only afterwards does the 1 MiB reply cap refuse an oversized result. A noisy command on a small agent host can therefore grow the agent's memory before the refusal. The reviewer flagged this as low in A-16003; the behaviour otherwise matches the spec.

## What to build

Bound output while it is collected. Stop reading, or truncate, at the reply cap plus a margin, and report truncation explicitly. Keep the doctor's existing behaviour unchanged for its callers.

## Acceptance criteria

- [ ] C1. An agent `run` of a command that writes 10× the reply cap holds at most the cap plus a fixed margin in memory, and answers with an explicit truncated or refused result (test).
- [ ] C2. The doctor checks that use the same helper produce unchanged results (test).
