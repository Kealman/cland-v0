---
id: T-1421
kind: task
title: Copied live-tracker test fixtures slow down as the tracker grows
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1193
branch: t/T-1421-copied-live-tracker-test-fixtures-slow
created: 2026-10-28T10:09:57.493Z
updated: 2026-10-29T16:08:24.502Z
---

## Summary

The copied live-tracker fixtures read the whole project tracker, now about 1,420 items, and their tests slow down as the tracker grows. On droplet runs, web/test/items.test.ts "the Items tree reads the copied live tracker snapshot" took 58.3 s (A-13194), and T-1419 needed allowances of 88 s for that test and 105 s for its file. The same pattern appears in nvim/test/closed-pages.test.ts (30.6 s) and hub/test/item-summary-lua.test.ts (34.3 s) in periodic dev T3 A-13191.

## Acceptance criteria

- [ ] C1. The copied-tracker fixtures read a bounded snapshot (a fixed item count or a pinned copy) whose size does not grow with the live tracker, and each test keeps the behaviour it checks.
- [ ] C2. The T-1419 allowances for web/test/items.test.ts are removed or reduced to the new measured timing at 1.5x.

## Notes

Follow-up of T-1419 (shared defect, 2026-10-28). Allowances owned by E-1311 expire 2026-11-04.

## Comments

### impl-1421 · 2026-10-29T16:08:24.502Z

C1 red observed on dev baseline: `AssertionError: default differential uses at most 64 pinned tracker items` at original full-copy boundary (1443 inputs). Baselines macOS arm64: Lua 21.633s/22.387s file; nvim closed-pages 19.678s/20.323s file; startup copied-live 7.293s/13.174s file (including unchanged thousand-row case 5.300s). Plan: fixed 24-item JSON corpus (21 shape-selected originals with ancestor closure + 3 explicit missing-shape rows), shared copier; retain identical all-live Lua oracle as separate T4 file. No hub/src or wire contract changes. Full-copy startup probe remains explicit/manual.
