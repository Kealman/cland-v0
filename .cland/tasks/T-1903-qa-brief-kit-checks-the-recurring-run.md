---
id: T-1903
kind: task
title: QA brief kit checks the recurring run-copy corrections
state: open
status: backlog
size: S
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1861
topic: null
branch: null
created: 2026-11-16T07:29:47.508Z
updated: 2026-11-16T07:29:49.236Z
---

## Summary

More than 22 run-copy corrections in v0.4.0 (§3.5). `cland qa lint` exists (`qa-lint-references.ts`). §7 #12, with T-1868, T-1808, T-1665 and T-1861.

Kind: product (qa lint) + skill. Triage ticket H-15 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [ ] C1. `cland qa lint` flags the five most frequent corrections: seals, kit pins, `npm run build`, census filters and exact lists (test).
- [ ] C2. The qa skill starts each run from the latest corrected run copy (docs check).

## Dependencies

T-1861
