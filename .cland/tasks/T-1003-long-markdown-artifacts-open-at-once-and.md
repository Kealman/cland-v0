---
id: T-1003
kind: task
title: Long Markdown artifacts open at once and render without blocking
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-795
blocked_by:
  - T-796
topic: null
branch: null
created: 2026-10-20T16:58:40.109Z
updated: 2026-10-20T16:58:49.084Z
---

## Summary

Opening or scrolling a very long Markdown artifact never freezes the workbench. The first screen appears at once, parsing and decoration run in small slices or for the visible range, and a version parsed once is never parsed again.

## What to build

The human opens a 20,000-line design note from a thread chip. The first screen appears rendered, and the keys the human types right away are handled at once. Scrolling to the end shows rendered text at every screen. Reopening the same unchanged note costs no new parse. T-796 proves its cache and the first screen of a 2,000-line artifact within 50 ms; this ticket extends the guarantee to "never blocks the UI" whatever the length, with no main-loop slice above 16 ms while rendering a 20,000-line artifact (Coordinator decision, 2026-10-20).

## Acceptance criteria

- [ ] C1. Opening a 20,000-line Markdown artifact shows its first screen rendered before the rest is parsed, and a key typed right after the open is handled before rendering completes, proved by a T2 test.
- [ ] C2. No single main-loop slice spent parsing or decorating a 20,000-line artifact exceeds 16 ms, proved by instrumentation in a T2 test.
- [ ] C3. Jumping to three positions (start, middle, end) shows rendered rows with no raw heading or fence markers once rendering settles, proved by a T2 test on the grid.
- [ ] C4. Reopening an unchanged artifact parses nothing (zero parser calls, counted with instrumentation like `thread.test.ts`), proved by a T2 test.
