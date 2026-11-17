---
id: T-1944
kind: task
title: Two back-to-back Neovim fixture refreshes still differ in incidental task.view captures (T-654 benchmark row, R-1), so a refresh leaves a versioned diff
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
created: 2026-11-17T12:09:38.187Z
updated: 2026-11-17T12:09:38.187Z
---

## Summary

After T-1804 removed the archive-loading dependency from explorer recording keys, two back-to-back `npm run test:nvim-fixtures` runs (2026-11-17, impl-1804, topic-1602, A-20864) still differ. Run 1's main catalog has 6061 records and run 2's has 6058. The difference is exactly three task.view captures, present only in run 1: the T-654 benchmark row and R-1 from two scenarios, one of whose outputs is already known. Every other slice and the live baseline are byte-identical. Compared with the migrated catalog, the first refresh also dropped 36 incidental captures. Which card frames get captured varies with selection and coalescing timing, independent of the key.

## What to build

The recorder captures a deterministic set of frames per scenario, either by awaiting a defined card-selection state or by recording only frames a scenario asserts on, so a refresh run twice in a row leaves no versioned diff.

## Acceptance criteria

- [ ] C1. `npm run test:nvim-fixtures` run twice in a row leaves no versioned diff across the catalog, every slice and the live baseline (test).
- [ ] C2. The cause of the varying captures is named with a deterministic reproducer that fails first (test).
