---
id: T-1026
kind: task
title: Reduce the CPU of T-1003's 20,000-line incremental parse proof to fit the T2 budget
state: open
status: in progress
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1195
blocked_by: []
topic: topic-943
branch: t/T-1026-reduce-the-cpu-of-t-1003-s-20-000-line
created: 2026-10-20T19:23:30.653Z
updated: 2026-10-24T08:33:24.465Z
---

## Summary

The 20,000-line incremental-parse proof added by T-1003 takes about 6 s on a Linux droplet (5.7-6.3 s over five load runs), past the 5 s budget for a new T2 case; T-1003 carries a dated 8 s allowance owned by E-880 through 2026-10-27. Reduce its total CPU while keeping the deterministic caps and semantics it proves.

## Acceptance criteria

- [ ] C1. The case runs under its 5 s T2 budget in the task's mode-free verify on a Linux droplet and in five sequential local runs (timings in the ready report), with every deterministic cap assertion unchanged, its name unchanged, and the T-1003 allowance removed (test and receipts named in the item).
