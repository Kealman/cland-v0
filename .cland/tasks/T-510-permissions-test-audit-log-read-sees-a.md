---
id: T-510
kind: task
title: "permissions test: audit log read sees a partial JSONL line while the hub appends (Linux)"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T15:56:19.661Z
updated: 2026-10-15T15:56:19.661Z
---

## Problem

`hub/test/permissions.test.ts:24`: `audits()` JSON.parse threw "Unexpected end of JSON input" while `check()` read the audit log on Linux, in T-459's droplet verify bbf38383 (A-3136:4015–4024). The test reads the JSONL audit log while the hub is still appending, so it can see a partial last line.

## Acceptance criteria

- [ ] C1. The audit reader in the test ignores, or waits past, a trailing partial line, or reads only after an observed flush boundary. Every assertion stays, and the root cause is recorded in the commit. If the product's own audit reader has the same exposure, say so in the commit and file it.
- [ ] C2. permissions.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
