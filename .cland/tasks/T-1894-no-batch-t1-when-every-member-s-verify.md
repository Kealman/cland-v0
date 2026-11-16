---
id: T-1894
kind: task
title: No batch T1 when every member's verify is current
state: open
status: backlog
size: S
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1582
topic: null
branch: null
created: 2026-11-16T07:29:45.714Z
updated: 2026-11-16T07:29:48.286Z
---

## Summary

A member's mode-free verify already ran T0–T2 at its head. Skip the batch's T1 when every member's verify is green at its exact head. Merges §7 #6 option 2 ("stop paying twice") with impl #1.

Kind: product. Triage ticket H-6 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes rule 6 and `merge.batch_tiers`. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [ ] C1. A batch whose members all have green mode-free verifies at their exact heads runs no T1, and its summary names those verifies (test).
- [ ] C2. A stale or missing member verify brings T1 back for the batch (test).

## Dependencies

T-1582
