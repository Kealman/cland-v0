---
id: T-1083
kind: task
title: Two Web fixtures in one worker overwrite each other's failure trace
state: open
status: in progress
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-976
branch: t/T-1083-two-web-fixtures-in-one-worker-overwrite
created: 2026-10-21T19:12:58.162Z
updated: 2026-10-24T11:53:27.279Z
---

## Summary

`web/test/harness.ts` keeps its failure-trace serial inside `webFixture`, so two fixtures in one worker can write the same `${pid}-0.zip`. In impl-1071's red run (T-1071), the copied-tracker case and the 300-item case both reported `web/test-results/51103-0.zip`, and one failure trace overwrote the other.

## Acceptance criteria

- [x] C1. Two failing Web fixtures in one worker leave two distinct trace files, each named in its own failure (test).
  - done: impl-1083 · 2026-10-24T11:53:27.279Z

## Comments

### impl-1083 · 2026-10-24T11:52:24.271Z

Red on macOS arm64 local executor, targeted Web file at ad611df9 + regression test (duration gate not run): node --test web/test/smoke.test.ts failed with `AssertionError [ERR_ASSERTION]: fixtures in one worker retain different trace files`; both actual and expected were web/test-results/2170-0.zip. Both failure diagnostics named that same ZIP. This reproduces the fixture-local serial collision at the agreed seam. Build passed; browser/hub cleanup census reached zero.

### impl-1083 · 2026-10-24T11:53:03.307Z

Green targeted Web smoke at ad611df95d015191b8b8af11fd7aa81bcd599b6d + implementation/test edits, macOS arm64 local: all 4 node:test assertions passed; failures saved distinct 5693-0.zip and 5693-1.zip, diagnostics matched each path, first ZIP bytes remained identical, both contexts closed and browser process groups reached zero. Top-level test 1.048 s (below Web 4 s budget; direct targeted run has no duration gate). Counter now shared at module/worker scope. Fresh origin/dev fetch + merge reports already up to date. Full check is running before commit/source review.
