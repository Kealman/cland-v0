---
id: T-660
kind: task
title: A merge-time lint refuses new wall-clock waits and elapsed-ms assertions in tests
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - flaky
  - verification
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-16T16:29:57.042Z
updated: 2026-10-16T16:29:57.042Z
---

## Summary

Rules 9–12 exist as text, so new tests keep being written in the style that flakes under load (A-4004, recommendation 4). A lint, run like the typecheck, refuses a new numeric sleep or setTimeout wait and a new elapsed-milliseconds assertion in a test file, and points at one shared until(event) helper with a single load-scaled deadline.

## What to build

A shared test helper `until(predicate, { what })` with one deadline scaled by a load factor (an environment knob with a default from the executor). A lint, run in the host gate next to the typecheck, flags in changed test files a numeric literal passed to setTimeout, sleep or delay used as a wait, and an assertion comparing elapsed milliseconds, unless the line carries `// lint-allow-wall-clock: <reason>`. Existing occurrences go into a baseline file that can only shrink.

## Acceptance criteria

- [ ] C1. The lint fails a planted new numeric-sleep wait and a planted elapsed-ms assertion in a changed test file, and passes when the line uses until or carries the reasoned marker, proved by a lint test.
- [ ] C2. Existing occurrences are recorded in a baseline the lint accepts and that can only shrink, and the host gate runs the lint for task and integrated runs.
- [ ] C3. docs/agents/tests.md documents until with its load-scaled deadline and the marker, with one existing flaky test file converted as the example.
