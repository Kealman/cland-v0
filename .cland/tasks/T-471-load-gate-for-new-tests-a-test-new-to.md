---
id: T-471
kind: task
title: "Load gate for new tests: a test new to the manifest runs five times under load in its task's verify before it can reach dev"
state: open
status: in progress
size: M
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by: []
topic: topic-317
branch: t/T-471-load-gate-for-new-tests-a-test-new-to
created: 2026-10-15T09:13:16.338Z
updated: 2026-10-15T19:07:35.811Z
---

## Summary

Retrospective A-2783, START 5: most red covers were new tests that passed once alone and then failed under the next full run's load. A test new to `hub/test/durations.json` must pass 5 of 5 under load before its task merges.

## What to build

In a task's verify, the runner repeats each test that is new to the manifest five times (`--test-name-pattern` on its file), in parallel with the rest of the phase, so it runs under the suite's own load. Any red repetition fails the run with a `load gate` line naming the test and the passing count. The duration manifest's refresh at stage close makes the test known, and known tests are not repeated.

## Acceptance criteria

- [ ] C1. A planted flaky new test that fails 1 time in 3 fails its task's verify with a `load gate` line, while a stable new test passes all five repetitions.
- [ ] C2. Known tests are not repeated, and the gate adds no repetitions to integrated dev runs.
- [ ] C3. The extra wall time is reported on the run, and hub/README.md and docs/agents/tests.md describe the gate.
