---
id: T-516
kind: task
title: Neovim smoke set omits explorer-card, so hub-only selections miss its regressions
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-15T16:50:21.238Z
updated: 2026-10-15T16:50:21.238Z
---

## Summary

hub/src/suite-selection.ts:14's `NVIM_SMOKE` set omits explorer-card. T-394's conservative replay of the last 40 merges therefore lists historical explorer-card failures that fell outside hub-only selections, on T-437, T-433 and T-432 (A-3179). Under the C1 bar these are listed misses, not own-test misses. Decide whether the package Neovim smoke needs an explorer-card case.

## Acceptance criteria

- [ ] C1. Either NVIM_SMOKE gains a minimal explorer-card case, with a timing within the smoke budget, or the item records why explorer-card coverage belongs only to full and Neovim-touching runs.
- [ ] C2. If a case is added, T-394's replay shows the three listed misses covered.
