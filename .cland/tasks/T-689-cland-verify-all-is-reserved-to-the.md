---
id: T-689
kind: task
title: cland verify all is reserved to the Coordinator, the human and occasions; task runs use the diff selection
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-413
branch: t/T-689-cland-verify-all-is-reserved-to-the
created: 2026-10-16T19:59:28.743Z
updated: 2026-10-16T23:34:36.363Z
---

## Summary

142 of 475 task runs were full because a session typed `all`, mostly for the flaky gate's second receipt, experiments and briefs (report-strategy §1.3). With quarantine (T-657) in place, the memo reserves `all` to the Coordinator and occasions (memo §5.2.6, §5.5 step 1). The flaky gate's second run (spec v0.1.3 §5) becomes an ordinary diff-selected verify.

## What to build

A `verify` request with mode `all` (CLI `all` or `--all`, MCP `mode: "all"`) from a session that holds neither the Coordinator role nor the human's shell is refused with `verify-all-reserved`, naming the diff selection it would get without the mode. The Coordinator, the human shell and `--occasion` requests keep `all`. Integrated `dev` runs stay full as today. `docs/agents/tests.md`, the Implementer and Lead clause lines that mention `all`, and spec v0.1.4's flaky-gate sentence say the second receipt is a diff-selected run; the clause change stays within `roles.test.ts`'s byte headroom.

## Acceptance criteria

- [ ] C1. An Implementer's `cland verify all` and MCP `verify` with mode `all` are refused with `verify-all-reserved` and leave no queue entry, proved by CLI and frame tests.
- [ ] C2. The Coordinator's and the human shell's `all` and any `--occasion` request are admitted, proved by the same tests.
- [ ] C3. `docs/agents/tests.md`, the role clauses and `docs/spec/v0.1.4.md` describe the reserved mode and the diff-selected second receipt, and `roles.test.ts` passes its byte headroom.

## Comments

### impl-689 · 2026-10-16T23:29:19.096Z

Implementation started. Agreed acceptance seams: verify CLI and suite.run/verify frame admission. Will refuse explicit all before queue admission and retain occasion/Coordinator/human behavior; docs and role clause changes remain scoped.

### impl-689 · 2026-10-16T23:34:36.363Z

Implemented e70ea5a7: shared CLI/MCP admission checks hub-held role, refuses all before scheduler entry, and describes auto diff selection. Added T2 frame/CLI proof and actual MCP check in existing selection-report test; existing fixture callers now auto, while tests requiring forced full use Coordinator. Docs and Implementer/Lead clauses updated; QA default's stale exception removed. origin/dev merged (already current). Typecheck and test:tiers pass at committed head; serial touched-file checks underway.
