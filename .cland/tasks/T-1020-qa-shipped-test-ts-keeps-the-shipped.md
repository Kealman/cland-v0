---
id: T-1020
kind: task
title: qa-shipped.test.ts keeps the shipped-case catalogue on one line, so every case addition conflicts
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-20T18:14:40.036Z
updated: 2026-10-20T18:14:40.036Z
---

## Summary

`nvim/test/qa-shipped.test.ts` keeps the whole shipped QA case catalogue on one long line, so any two items that each add a shipped case (ARTIFACT-001, PANELS-017, PANELS-018 on 2026-10-20) conflict and invalidate otherwise green, reviewed heads. Reported by impl-796.

## What to build

One case per line (or per-feature lists) so independent additions merge cleanly, keeping the curated shipped set and its order checks.

## Acceptance criteria

- [ ] C1. The shipped catalogue lists one case per line, and two branches that each add a different case merge without conflict (demonstrated with a scratch merge in the item topic).
- [ ] C2. qa-shipped.test.ts runs the same cases as before (test).
