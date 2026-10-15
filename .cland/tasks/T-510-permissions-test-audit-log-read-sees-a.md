---
id: T-510
kind: task
title: "permissions test: audit log read sees a partial JSONL line while the hub appends (Linux)"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-309
branch: t/T-510-permissions-test-audit-log-read-sees-a
created: 2026-10-15T15:56:19.661Z
updated: 2026-10-15T17:00:00.746Z
---

## Problem

`hub/test/permissions.test.ts:24`: `audits()` JSON.parse threw "Unexpected end of JSON input" while `check()` read the audit log on Linux, in T-459's droplet verify bbf38383 (A-3136:4015–4024). The test reads the JSONL audit log while the hub is still appending, so it can see a partial last line.

## Acceptance criteria

- [x] C1. The audit reader in the test ignores, or waits past, a trailing partial line, or reads only after an observed flush boundary. Every assertion stays, and the root cause is recorded in the commit. If the product's own audit reader has the same exposure, say so in the commit and file it.
  - done: impl-510 · 2026-10-15T16:59:49.540Z
- [ ] C2. permissions.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-510 · 2026-10-15T16:47:07.642Z

Read task, E-482 Coordinator decisions, and release spec. Plan: reproduce audit helper on a deterministic partial-tail fixture, read only completed JSONL lines, preserve every permission/audit assertion, inspect product reader exposure, then collect five serial labelled Mac whole-file passes before review and droplet verification.

### impl-510 · 2026-10-15T16:59:50.167Z

Implemented and pushed 805972cf6803332a1eaf35dcf83be7918de1f297 on t/T-510-permissions-test-audit-log-read-sees-a after fetching/merging origin/dev. Diff against dev is only permissions.test.ts (7 additions/2 deletions). Product readAudit catches partial JSON already: no product crash follow-up. Deterministic actual-helper red/green: partial tail, partial-only, empty, complete, malformed complete (still throws). A-3196 records five quiet serial Mac whole-file passes, 25/25 tests, 5.01–5.55 s per file; preflight free/no Coordinator local run and load1 6.00–8.06 before each. C2 droplet evidence pending source review. Shared manifest 051db745 included. No QA brief required (qaPolicy scope none, no qaCriteria).
