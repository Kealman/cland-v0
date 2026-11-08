---
id: T-1766
kind: task
title: project-probes zero-child census fails when the file runs outside the suite runner
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
created: 2026-11-08T20:50:12.497Z
updated: 2026-11-08T20:50:12.497Z
---

## Summary

`hub/test/project-probes.test.ts` (T2) fails its zero-child census when run directly with `node --test`: it gets `{execFileSync: 1}`, where it expects `{}`, so 1 test passes and 2 fail. It passes through the suite runner, for example in the macOS stage cover a4a59a7c at 966f6fef. A targeted run therefore produces a false red, which cost an implementer a classification round on 2026-11-08 (T-1750).

## Evidence

- A direct `node --test --test-reporter=tap hub/test/project-probes.test.ts` on macOS fails at dev 5e0ba307, 241992ac, 4668f181, d57dd020, 7c032082 and 966f6fef. It fails the same way with a clean `env -i HOME PATH TMPDIR`.
- The failing tests: "projectHub defaults launch, signal and stop every harness with zero child processes", plus the file-level failure.
- The suite runner passes the same file, so its setup supplies something the direct run lacks.

## Acceptance criteria

- [ ] C1. A direct `node --test hub/test/project-probes.test.ts` on macOS and Linux passes, or the file refuses with a clear message naming the runner it needs (test).
- [ ] C2. The census counts only processes the test's own harness spawns, independent of the invocation (test).
