---
id: T-915
kind: task
title: Switch duration budgets from report to enforce before the v0.1.4 release build (D71, E-678 C6)
state: open
status: in progress
size: L
criterion_seq: 5
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by:
  - T-919
topic: topic-672
branch: t/T-915-switch-duration-budgets-from-report-to
created: 2026-10-19T22:37:49.124Z
updated: 2026-10-19T23:46:30.085Z
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
- [ ] C4. Every allowance owned by E-677 or E-482 (both close in v0.1.4) is re-owned to E-880 with values unchanged, and converted or new allowances carry owner E-880 and expire 2026-11-19 (Coordinator decision on T-915's question, D71).
- [ ] C5. D72: the duration lint reads the legacy owner from budget.legacyOwner in hub/test/durations.json (default E-677; set to E-880), legacy-owner dated allowances may span at most 31 days while other owners keep 7, with lint tests and docs/agents/tests.md updated and every other lint rule unchanged.

## Comments

### impl-915 · 2026-10-19T23:45:10.424Z

Starting from T-919 baseline additions at 2c79d42a. Will replay A-6792/A-6795/A-6796 through production budget checks, add bounded E-677 allowances for every observed overage, switch enforce, and prove C2 only on throwaway branches. No QA brief present; checking effective policy before review.
