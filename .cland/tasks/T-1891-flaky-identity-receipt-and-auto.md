---
id: T-1891
kind: task
title: Flaky-identity receipt and auto-quarantine
state: open
status: backlog
size: M
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:29:45.132Z
updated: 2026-11-16T07:29:45.132Z
---

## Summary

A cover or batch whose only failures are open flaky-labelled identities, each passing 5/5 in a hub rerun at the same tree, closes with a receipt. The identity gets a dated `hub/test/quarantine.json` entry (the mechanism exists; the file is empty). Merges impl #3 and §7 #1 option 3.

Kind: product. Triage ticket H-3 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes the flaky rerun rule (human 2026-10-15) and T-469's green-cover stage gate. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [ ] C1. A cover whose only failure is a filed flaky identity passing 5/5 in a hub rerun at the same tree records a green-with-receipt outcome that the stage gate accepts (test).
- [ ] C2. An unfiled failure, or one that fails any rerun, keeps the run red (test).
- [ ] C3. Each excused identity gets a quarantine entry with an owner item and an expiry of at most 7 days, and an expired entry fails the manifest lint (test).

## Dependencies

none; `merge-batches.ts` (already has "flaky failing files" repeats at :346), `suite-quarantine.ts`, tracker stage cover
