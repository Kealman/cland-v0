---
id: T-2113
kind: task
title: "A droplet lost after the suite finished drops the completed tier receipts: result.json keeps only T0 and reports 'remote machine lost'"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-26T20:12:05.539Z
updated: 2026-11-26T20:12:05.539Z
---

## Summary

T-2044's verify e94867ad at 3af173d30 (A-23611, 2026-11-26, droplet lifetime 3838 s) ended code 1 with cause "remote machine lost". The retained log shows `Finished: exit 0` and tiers T1, T2, T3 and Web all exit 0 (9,782 completed, 9,770 passed, 0 failed, 12 skipped). The final result.json kept only the T0 receipt and labelled the run interrupted, so a fully green run cost a retry.

## What to build

When the machine is lost after the suite reported its finish, reconcile the result from the receipts already streamed into the retained log: keep each tier whose completion receipt arrived, and report the loss as a collection failure rather than discarding completed tiers. A loss before completion still counts as interrupted.

## Acceptance criteria

- [ ] C1. With a fake remote that finishes every tier and is then lost during collection, result.json keeps every completed tier receipt and names the loss as post-completion (test).
- [ ] C2. A loss before the finish receipt still yields an interrupted result with no tier claimed complete beyond its receipt (test).
