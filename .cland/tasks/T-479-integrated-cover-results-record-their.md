---
id: T-479
kind: task
title: Integrated cover results record their status and cause, so incidents are data instead of T-204 prose
state: open
status: in progress
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-468
blocked_by:
  - T-472
topic: topic-363
branch: t/T-479-integrated-cover-results-record-their
created: 2026-10-15T09:13:20.192Z
updated: 2026-10-16T07:16:09.645Z
---

## Summary

Retrospective A-2783, START 2: green, red and cancelled covers, and why, were reconstructed from T-204 comments. The suite result of an integrated run records `cover: {status: green|red|cancelled, cause: test-failure|budget|load-flake|cancel-head|cancel-requester|timeout, tests: [...]}`.

## What to build

The hub derives the cause from the outcome (failed tests, a `duration budget` line, the cancellation reason, a timeout). The Coordinator can set `load-flake` afterwards with `cland verify classify <run> load-flake --note …`. `hub status` lists the last 10 covers with status and cause.

## Acceptance criteria

- [ ] C1. A red integrated run records `cover.status: red` with cause `test-failure` and the failing tests, and a budget failure records `budget`.
- [ ] C2. A cancelled run records the cancellation cause, and `cland verify classify` updates a red run's cause with a note.
- [ ] C3. `hub status` shows the last 10 covers.

## Comments

### impl-479 · 2026-10-16T07:16:09.645Z

TDD underway at confirmed Suites/status/CLI seams. First failing test proved missing cover metadata; now failing-test identities and b5643d32 budget-only fixture pass. Cancellation, classification authorization/persistence, and last-10 status slices next. Thin suites.ts hook delegates outcome derivation to hub/src/hub/suite-cover.ts.
