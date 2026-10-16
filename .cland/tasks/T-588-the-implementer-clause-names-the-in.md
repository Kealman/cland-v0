---
id: T-588
kind: task
title: The Implementer clause names the in-process test hub and the startDaemon lifecycle-only line
state: open
status: in progress
size: XS
labels:
  - v0.1.3
  - hub
  - qa-found
assignee: null
parent: E-387
blocked_by: []
topic: null
branch: t/T-588-the-implementer-clause-names-the-in
created: 2026-10-16T10:49:49.485Z
updated: 2026-10-16T10:51:08.079Z
---

## Summary

E-387's demo run qa-2026-10-16-27-21 failed R1 (criterion C5). Both Implementer clauses, `hub/src/roles/default-roles.ts` `[implementer]` and `.cland/roles.toml` `[implementer]`, describe coverage selection but leave out the in-process test hub default and the rule that `startDaemon` is kept only for hub-process lifecycle tests. `docs/agents/tests.md` and `hub/README.md` (Tests) already describe both.

## What to build

Add one line to the Implementer clause in both files, next to the `hub-selected` line, saying that:
- tests use the in-process hub, `projectHub(t, root, env?)` from `hub/test/harness.ts`, by default;
- `startDaemon` is kept only when an assertion concerns the hub process (startup, stop, signals, crash or restart, lock, discovery, pid, orphan sweep, watchdog, the CLI with the hub down), and such a test names that behaviour;
- `docs/agents/tests.md` has the details.

Keep the wording consistent with `docs/agents/tests.md`. Make no other clause changes. Under rule 6, grep hub/test and nvim/test for clause text or clause-size assertions, and run every matching test file.

## Acceptance criteria

- [ ] C1. Both Implementer clauses carry the in-process default and the startDaemon lifecycle-only line, worded consistently with docs/agents/tests.md, and every test file asserting clause text or size passes.
