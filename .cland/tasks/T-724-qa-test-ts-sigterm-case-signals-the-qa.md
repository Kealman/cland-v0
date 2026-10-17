---
id: T-724
kind: task
title: qa.test.ts SIGTERM case signals the QA run before its handler is installed and sees no BLOCKED line
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - flaky
  - nvim
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T05:55:15.692Z
updated: 2026-10-17T05:55:15.692Z
---

## Summary

nvim/test/qa.test.ts "a run that is interrupted (SIGTERM) takes its Neovim with it and still says BLOCKED" failed in integrated cover b0cd94d7 at 7d6ebc1f (A-4317): `one JSON line on stdout, got: 0` after 126 ms. It passed 5 of 5 times alone at the same commit on the Mac, 278–403 ms each. The early failure time suggests the test signals the QA run before the run has installed its SIGTERM handler, so the run dies without printing its BLOCKED line.

## What to build

The case waits for an observable readiness signal from the QA run, such as its start line, the Neovim child's pid or a ready marker, before it sends SIGTERM. It then asserts the same outcome: Neovim is gone and stdout carries one BLOCKED JSON line. No fixed delay before the signal.

## Acceptance criteria

- [ ] C1. The case sends SIGTERM only after an observable readiness signal from the QA run, with its assertions unchanged in meaning, proved by the file passing with an injected start delay in the run.
- [ ] C2. nvim/test/qa.test.ts passes 10/10 serially as a whole file on the Mac and once in the task's droplet verify.
