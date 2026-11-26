---
id: T-2111
kind: task
title: Prove the cause of the Linux slowdown in executor completion, stage landing and merge enqueue paths localized by T-2099
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by:
  - T-2099
topic: null
branch: null
created: 2026-11-26T17:44:14.264Z
updated: 2026-11-26T17:44:14.264Z
---

## Summary

T-2099 (A-23532, A-23533; run 415fc047, reviewed head 1c7e26f40) localized the Linux slowdown in three T3 files to phases but did not prove the cause. executor-safety time sits in completion reporting (66.5 s across the timeout cases), stage-qa time in stage landing (92.7 s, 10–14.3 s per three-item group), and much of the merge-policy body cost is unexplained by setup or branch preparation.

## What to build

Add narrower receipts inside the three owning paths: executor completion collection, release and report; stage per-item public merge against restart; merge public merge and enqueue. Then run one task verify and attribute the cost, fixing what is attributable.

## Acceptance criteria

- [ ] C1. Each of the three owning paths has a Linux receipt that splits its time into named sub-steps, from one task verify (evidence).
- [ ] C2. Each attributable cost is fixed or filed, with the expected Linux per-case value recorded for the baseline refresh (evidence).
