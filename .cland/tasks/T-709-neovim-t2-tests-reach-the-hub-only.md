---
id: T-709
kind: task
title: Neovim T2 tests reach the hub only through recorded protocol frames, so hub edits stop selecting them
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-698
  - T-699
  - T-707
  - T-688
  - T-690
topic: null
branch: null
created: 2026-10-16T19:59:37.953Z
updated: 2026-10-18T04:40:38.884Z
---

## Summary

Hub edits force Neovim tests because they import hub code (memo §3.6; report-strategy §1.3: `nvim test import` decided 66 task runs). `nvim/test/stub-hub.ts` imports the hub's tracker prefixes, kinds and criteria, visibility, visibility preferences and config, and `needs-you.test.ts` the `Store`. The type-only imports stop counting with T-688. Decision 6: Neovim tests go over the protocol before v0.2, after the adapter and executor class moves.

## What to build

- **Recorded frames.** The stub hub stops importing hub runtime modules. It serves frames from recorded fixtures: JSON files of protocol frames (item views, criteria summaries, visibility counts, config) that a T3 recorder test in the Neovim attach scenario (T-707 #9) produces from a real hub.
- **Drift fails loudly.** The recorder test fails when the live hub's frames differ from the committed fixtures, and `npm run test:nvim-fixtures` rewrites them, so a hub change that alters a frame shows up in T3, not as a silent stub mismatch.
- **Helpers from Neovim's side.** T2 Neovim files import Neovim-side helpers for temp projects and waits, not `hub/test/harness.ts`. T3 Neovim files that start a real hub may keep the harness.

## Acceptance criteria

- [ ] C1. No T2 Neovim file or helper it imports reaches a `hub/src` runtime module, proved by `nvimHubImports` over the T2 files returning an empty list.
- [ ] C2. The recorder test fails on a planted frame change in the hub and passes after the fixture rewrite, proved by a test.
- [ ] C3. The selection replay over the last 40 landings shows `nvim test import` deciding no T2 Neovim selection, recorded on this item.
- [ ] C4. An audit shows every Neovim T2 test's assertions unchanged in meaning, and each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-688 (type-only imports and Neovim narrowing), T-690 (Neovim T2 tags).
