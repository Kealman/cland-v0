---
id: T-689
kind: task
title: cland verify all is reserved to the Coordinator, the human and occasions; task runs use the diff selection
state: open
status: planned
size: S
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: null
branch: null
created: 2026-10-16T19:59:28.743Z
updated: 2026-10-16T20:00:51.706Z
---

## Summary

142 of 475 task runs were full because a session typed `all`, mostly for the flaky gate's second receipt, experiments and briefs (report-strategy §1.3). With quarantine (T-657) in place, the memo reserves `all` to the Coordinator and occasions (memo §5.2.6, §5.5 step 1). The flaky gate's second run (spec v0.1.3 §5) becomes an ordinary diff-selected verify.

## What to build

A `verify` request with mode `all` (CLI `all` or `--all`, MCP `mode: "all"`) from a session that holds neither the Coordinator role nor the human's shell is refused with `verify-all-reserved`, naming the diff selection it would get without the mode. The Coordinator, the human shell and `--occasion` requests keep `all`. Integrated `dev` runs stay full as today. `docs/agents/tests.md`, the Implementer and Lead clause lines that mention `all`, and spec v0.1.4's flaky-gate sentence say the second receipt is a diff-selected run; the clause change stays within `roles.test.ts`'s byte headroom.

## Acceptance criteria

- [ ] C1. An Implementer's `cland verify all` and MCP `verify` with mode `all` are refused with `verify-all-reserved` and leave no queue entry, proved by CLI and frame tests.
- [ ] C2. The Coordinator's and the human shell's `all` and any `--occasion` request are admitted, proved by the same tests.
- [ ] C3. `docs/agents/tests.md`, the role clauses and `docs/spec/v0.1.4.md` describe the reserved mode and the diff-selected second receipt, and `roles.test.ts` passes its byte headroom.
