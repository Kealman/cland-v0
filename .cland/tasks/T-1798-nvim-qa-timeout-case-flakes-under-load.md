---
id: T-1798
kind: task
title: "nvim qa --timeout case flakes under load: the Neovim wrapper's pid wait is not load-tolerant"
state: open
status: planned
size: XS
labels: []
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: null
branch: null
created: 2026-11-09T20:40:55.555Z
updated: 2026-11-17T23:14:12.662Z
---

## Summary

`nvim/test/qa.test.ts`, "a case that never returns is ended by --timeout: BLOCKED, exit 2, and no Neovim left spinning" (T3), failed once on macOS under suite load with `the Neovim wrapper never wrote its pid` after 12.5 s (qa.test.ts:41). The test's wait for the wrapper's pid file isn't load-tolerant. Alone it passes 5/5 at the same commit.

## Evidence

- E-1535 stage-1 macOS cover 4e602340 at dev 700f88ce (A-18177). Peak 1-minute load was 13.18 in T3, and swap was 5.4 GB of 6 GB used. The same tree's Linux cover 70a2f91e (A-18172) is green. Five solo runs on macOS at 700f88ce: 5/5 pass.
- This is the third distinct timing-class failure in macOS covers at this tree, after T-1796 and T-1797.

## Acceptance criteria

- [ ] C1. The wait for the Neovim wrapper's pid uses the shared `testWaitMs()`/`eventually()` load-scaled bound (test).
- [ ] C2. The case passes 20/20 with 2 workers and a CPU burner on macOS (test).
