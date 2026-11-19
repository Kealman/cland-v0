---
id: T-1997
kind: task
title: A failing assertion in a file-level after hook may not fail the test run
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-19T03:30:57.433Z
updated: 2026-11-19T07:10:56.039Z
---

## Summary

impl-1676 observed in T-1676 (2026-11-19) that a failing assertion in a file-level `after` hook didn't fail the run in this harness. In an isolated legacy Codex control, the hook ran with one leftover placeholder, the child exited 0, and the parent still saw the placeholder. In the full-file control the child exited 0 with 69 passing and 4 placeholders left. Moving the identical check into a final named test produced exit 1 and a failed case. If this holds in general, every guard or census written as a file-level `after` assertion may pass silently.

## What to build

First, reproduce minimally: a file whose `after` hook throws or fails an assertion, run through the project's test runner and suite pipeline in both direct and parallel modes. Record whether the exit status, the suite result and the failure list show it. If they don't, make an `after`-hook failure fail the file with a named failure in every runner path. Alternatively, add a lint that refuses assertions in file-level `after` hooks and points to a final named test, then migrate the existing ones.

## Acceptance criteria

- [ ] C1. A minimal reproduction records exactly what each runner path does with a failing file-level `after` hook (exit status, suite result, failure list), with literal output (evidence).
- [ ] C2. A failing file-level `after` hook fails its file with a named failure in every runner path, or file-level `after` assertions are refused by a lint with every existing one migrated (test).
- [ ] C3. Every existing file-level `after` hook that asserts is listed with its disposition (rule 41).

## Comments

### coord · 2026-11-19T07:10:56.039Z

A possible lead from impl-1669 (T-1669, 2026-11-19): a nested `node --test` child that inherits `NODE_TEST_CONTEXT` from its parent runner silently skipped files until that variable was removed with the fixtureEnvironment final overlay. Check whether inherited `NODE_TEST_CONTEXT` in the child explains T-1676's observation (exit 0 despite a failing `after` hook) before calling it a harness defect.
