---
id: T-1259
kind: task
title: executor-safety-component's foreign-lease case misses its 15 s completion window under macOS cover load
state: open
status: planned
size: S
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
topic: null
branch: null
created: 2026-10-24T19:31:37.373Z
updated: 2026-10-25T09:53:53.282Z
---

## Summary

The macOS stage cover 83b0e729 at 5d1fa288 (A-11361) failed `hub/test/executor-safety-component.test.ts:207` "a short-lived hub preserves a foreign live lease beyond its own lifetime threshold" with `remote completion collected: not within 15000 ms` (harness.ts:848, from finish() at line 45). The run peaked at 1-minute load 10.17. The case took 16.1 s against a 0.63 s baseline. Run alone on Darwin arm64, it passed 5/5 at 5d1fa288 (about 0.53 s each) and 3/3 at 8fd6195f, before T-1255/T-1257. So it is load-sensitive, not a regression.

## Acceptance criteria

- [ ] C1. The case waits on the exact settlement receipt it asserts (rule 9), not on a scheduler tick racing a loaded event loop, and it passes 10/10 at 2 workers under CPU load on macOS (test).
