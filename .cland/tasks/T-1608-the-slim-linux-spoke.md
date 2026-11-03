---
id: T-1608
kind: task
title: The slim Linux spoke
state: open
status: review
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1600
topic: topic-1374
branch: t/T-1608-the-slim-linux-spoke
created: 2026-11-02T03:33:57.391Z
updated: 2026-11-03T22:05:30.692Z
---

## Summary

The spoke loads only what a session's connection needs at start, with the rest imported on first use, to bring its Linux resident size of 105–125 MB toward its macOS size. A measurement test records the spoke's RSS on the platform it runs on, and the task's evidence carries the values before and after from the branch's own Linux droplet verification.

Hot files: `hub/src/spoke/spoke.ts`, `hub/bin/cland-spoke.ts`, `hub/src/spoke/*.ts`, `hub/test/spoke-footprint.test.ts` (new)

## Acceptance criteria

- [ ] C1. A T1 test fails when the spoke's start-up import graph (before the hub's welcome) reaches `node:sqlite`, the journal, the tracker or another module on a named deny list (test).
- [ ] C2. A measurement test starts the spoke against a test hub, waits for the welcome and an idle 10 s, and reports its RSS. It fails only when the spoke does not start, never on the number (test).
- [ ] C3. The task's evidence records the spoke's RSS on Linux at `dev`'s head and at the branch head, both from droplet runs, with the reduction.
- [ ] C4. Every spoke tool still answers, and the spoke, spoke-reconnect and spoke-tools test files pass with no test edited.

## Notes

Shared files: `hub/src/spoke/spoke.ts`, `hub/bin/cland-spoke.ts`

## Comments

### impl-1608 · 2026-11-03T22:04:11.388Z

Coordinator6d12bbe1 approved two reviewed heads: test-only dev-equivalent baseline, then lazy-import split. Baseline local Darwinarm64 Node24.21 T4 measurement pass, RSS60129280bytes after welcome+10s, no tools invoked, native cleanup/census pass. All-package typecheck pass. Linux C3 unexecuted; static lint still running. Requested allowance owner decision and C4 current-file mapping.

### coord · 2026-11-03T22:05:30.692Z

Coord decision 2026-11-03 22:05Z. C4's names map to current files: spoke = in-process-spoke, spoke-stdio, spoke-unix-edge and spoke-identity; spoke-reconnect = spoke-readiness and bridge-grace; spoke-tools = tool-arguments-spoke plus the documented-tools census, with scenario hub-lifecycle also checked. All must pass unedited at the branch head. The T4 baseline measurement's duration allowance is 30 s, owner C-216, expiring 2026-11-20, with no RSS threshold (C3 carries RSS as droplet evidence).
