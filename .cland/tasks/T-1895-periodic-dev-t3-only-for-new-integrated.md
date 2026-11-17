---
id: T-1895
kind: task
title: Periodic dev T3 only for new integrated evidence
state: open
status: planned
size: S
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:29:45.935Z
updated: 2026-11-17T23:15:25.523Z
---

## Summary

It already skips an unchanged tree, or a green full cover on dev's ancestry within 1 h (`suites.ts:1203–1226`). Batches likely don't suppress it, because their candidate head is not on dev's ancestry (unverified). Skip when dev's tree equals a green T1+T3 batch candidate tree, and lengthen `dev_t3_every`. Merges impl #5 and §7 #5.

Kind: product + config. Triage ticket H-7 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes rule 6 ("periodic dev T3 covers T2 on integrated dev") and `verification.dev_t3_every`. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [ ] C1. A dev tree equal to a green T1+T3 batch candidate tree skips the periodic run, with a notice naming the batch (test).
- [ ] C2. `dev_t3_every` is raised (for example 2h to 8h), and a week's ledger shows at most 3 periodic runs a day (evidence).
- [ ] C3. Integrated T2 keeps a stated cadence of at least once a day, or rule 6's text changes with the human's yes (test or doc).

## Dependencies

none; suites.ts
