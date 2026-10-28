---
id: T-1419
kind: task
title: web Items tree misses a verifier-hold row within its 3 s wait once in a loaded task run
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
created: 2026-10-28T08:45:08.519Z
updated: 2026-10-28T08:45:08.519Z
---

## Summary

`web/test/items.test.ts::claims and verifier holds arrive in the task and ancestor rows` failed once in T-1401's mode-free run 5b47c186 (Linux droplet c-8 lon1, head e35d4d32, log A-13145): `locator.waitFor: Timeout 3000ms exceeded` waiting for `getByText('reviewer tree-verifier', { exact: true })` in the Items tree row E-900001 (items.test.ts:130). It passed in the 17 earlier runs checked (A-13041–A-13114); T-1401 touches no web code.

## What to build

Find why the ancestor row's verifier-hold text can take over 3 s under load (an event delivery behind other work, a render that waits on a full snapshot, or a fixed wall-clock wait) and make the test wait on the row's own render receipt with a bound sized for a loaded runner, without hiding a missing hold.

## Acceptance criteria

- [ ] C1. The cause is attributed with the failing output and a reproduction under load.
- [ ] C2. The identity passes 10/10 at two workers plus owned CPU load.
