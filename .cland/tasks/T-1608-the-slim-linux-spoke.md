---
id: T-1608
kind: task
title: The slim Linux spoke
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1600
topic: null
branch: null
created: 2026-11-02T03:33:57.391Z
updated: 2026-11-02T03:33:57.391Z
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
