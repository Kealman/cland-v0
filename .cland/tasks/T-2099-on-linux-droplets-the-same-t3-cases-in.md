---
id: T-2099
kind: task
title: On Linux droplets the same T3 cases in executor-safety, stage-qa and merge-policy run 2–4x their per-case baselines (integrated two-worker runs)
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: null
branch: null
created: 2026-11-25T03:41:35.690Z
updated: 2026-11-25T03:41:35.690Z
---

## Summary

This is a follow-up from T-2098 (impl-2098, 2026-11-25). Comparing the same cases, the per-test baseline sum against three Linux integrated runs, rules out new tests and stale file aggregates as the cause:

| file | cases | per-case baseline sum | stage cover A-23095 | batch A-23215 | soak A-23224 |
|---|---|---|---|---|---|
| executor-safety | 15 | 42.9 s | 110.8 s | 98.3 s | not run |
| stage-qa | 12 | 54.1 s | 140.6 s | 103.7 s | 94.0 s |
| merge-policy | 26 | 22.1 s | 94.7 s | 70.0 s | 68.0 s |

Main executor-safety outliers: remote-shell/host timeout, 13.3 s to 55.8 s and 51.3 s; prepare/fallback/cancel/watchdog, 18.8 s to 42.7 s and 37.2 s.

Limits: the Linux evidence comes only from integrated two-worker runs, so it doesn't separate a landing, machine load, fixture overhead or compile cost. Mac measurements under a pinned Node 24 show only gradual creep (merge-policy 36.7 s to 57.2 s across landings, no single culprit) and don't establish Linux causality. One Mac confounder was found and excluded: Homebrew's Node 25 on PATH roughly doubles these files.

## What to build

Attribute the Linux slowdown in these files: per-test timing under a controlled single-file Linux run, or a per-phase breakdown of setup, compile and body time from the existing timing receipts. Fix what's attributable; for the rest, record the expected Linux cost so the duration-baseline refresh can take it.

## Acceptance criteria

- [ ] C1. Each of the three files has a recorded Linux cause per slow case group, with evidence that names the run and its isolation level (evidence).
- [ ] C2. Each attributable regression is fixed or filed separately, and the baseline refresh records which per-case values it accepts and why (evidence).
