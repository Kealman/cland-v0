---
id: T-915
kind: task
title: Switch duration budgets from report to enforce before the v0.1.4 release build (D71, E-678 C6)
state: open
status: backlog
size: M
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-19T22:37:49.124Z
updated: 2026-10-19T22:37:49.124Z
---

## Summary

D71 (2026-10-19 22:37Z): E-678 C6 counts the budget-enforce mechanism, and switching `hub/test/durations.json` from report to `"budget": { "mode": "enforce" }` is a separate v0.1.4 task before the release build. Today every run prints "budget (report only): would fail …" lines and "budget missing baselines: 55".

## What to build

- Refresh `hub/test/durations.json` from the green stage-cover logs (Linux and macOS) at the stage-cover-#2 tree, so no test file lacks a baseline.
- For every test or file over its tier budget in those logs, either make it faster or add an allowance with a reason and an owner, following the existing allowance format and the legacy-allowance rules.
- Set `budget.mode` to `"enforce"`. Show that a task verify at the head shows `budget` lines (not "report only") and passes.

## Acceptance criteria

- [ ] C1. At the head, a mode-free task verify and a dry run show enforce-mode budget lines with zero failures and zero missing baselines.
- [ ] C2. A planted over-budget T2 test without an allowance fails its run, and a planted T3 growth without an allowance is refused with `merge-budget` (throwaway branches, never merged), with receipts in the report.
- [ ] C3. The task report lists every allowance added, with its reason and measured seconds.
