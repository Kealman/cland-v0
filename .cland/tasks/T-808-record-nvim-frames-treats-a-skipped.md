---
id: T-808
kind: task
title: record-nvim-frames treats a skipped Neovim file as a success and can replace the catalog with zero recordings
state: open
status: review
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
regression_of: T-709
topic: topic-716
branch: t/T-808-record-nvim-frames-treats-a-skipped
created: 2026-10-18T14:48:39.460Z
updated: 2026-10-20T09:45:22.488Z
---

## Summary

Found by impl-774 while reading the recorder. `hub/test/record-nvim-frames.ts` `run()` checks only the exit code, and a Neovim test file that skips (no binary available) exits 0. A full `test:nvim-fixtures` refresh on a machine without Neovim can therefore rewrite the main catalog with zero recordings, then skip its own final live check as well.

## Acceptance criteria

- [ ] C1. A capture whose files were skipped, or that recorded zero frames for a file that had frames before, refuses before any fixture is replaced, naming the file. A T1/T2 test with a fake unavailable-binary control proves it.
- [ ] C2. The final live check refuses rather than skips when Neovim is unavailable.

## Comments

### impl-808 · 2026-10-20T09:43:00.142Z

A-7125 row confirmed. C2 is moot as written: final recorded-protocol test in nvim/test/scenarios/workbench.test.ts has no skip option and uses projectHub (no Neovim binary). C1 implementation will validate all captures before replacing fixtures, including skips and expected per-file/catalog frame counts.
