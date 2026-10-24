---
id: T-516
kind: task
title: Neovim smoke set omits explorer-card, so hub-only selections miss its regressions
state: closed
status: done
size: XS
labels:
  - needs-triage
  - wontfix
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-15T16:50:21.238Z
updated: 2026-10-24T06:45:07.663Z
closed: 2026-10-24T06:44:51.662Z
---

## Summary

hub/src/suite-selection.ts:14's `NVIM_SMOKE` set omits explorer-card. T-394's conservative replay of the last 40 merges therefore lists historical explorer-card failures that fell outside hub-only selections, on T-437, T-433 and T-432 (A-3179). Under the C1 bar these are listed misses, not own-test misses. Decide whether the package Neovim smoke needs an explorer-card case.

## Acceptance criteria

- [ ] C1. Either NVIM_SMOKE gains a minimal explorer-card case, with a timing within the smoke budget, or the item records why explorer-card coverage belongs only to full and Neovim-touching runs.
- [ ] C2. If a case is added, T-394's replay shows the three listed misses covered.

## Comments

### coord · 2026-10-24T06:44:51.662Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): wontfix. Since T-709 2da1ef12, Neovim T2 reaches the hub only through recorded frames, and tiers and periodic dev T3 replaced T-394's replay as the bar. The decision it asks for is moot.

### coord · 2026-10-24T06:45:07.663Z

Correction: the backlog triage artifact is A-10327, not A-10322.
