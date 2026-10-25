---
id: T-1266
kind: task
title: T-1205's grouped parsed-metadata recorder case runs 2.4–2.5 s against the 2 s T2 budget
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-24T23:57:53.599Z
updated: 2026-10-24T23:57:53.599Z
---

## Summary

impl-1205 reported that T-1205's grouped parsed-metadata recorder case (skills-qa, T2) takes 2.383 s base and 2.516 s at worst repeat in run 209dbd96 (A-11544, Linux c-8), over the report-only 2 s T2 per-test budget. All assertions pass 5/5. Make it fit the budget (smaller fixture or a cheaper tier) rather than widening the budget.

## Acceptance criteria

- [ ] C1. The case runs under 2 s on the Linux droplet at 2 workers with its assertions unchanged, or moves to the tier whose budget fits it, recorded in the test docs (test).
