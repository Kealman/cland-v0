---
id: T-1149
kind: task
title: Neovim artifact-render test misses the artifact event within 10 s under Linux load
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-22T17:31:42.287Z
updated: 2026-10-22T17:31:42.287Z
---

## Summary

`nvim/test/artifact-render.test.ts` › "artifact events refresh an open projection and raw saves replace its cached version" failed on a Linux c-8 lon1 droplet in T-1118's verify 4d419525 (A-9386, head 451ef78a). The error was `the screen never showed artifact event reaches the rendered grid within 10000 ms`, with the grid still showing "Original live note". The same identity failed earlier in T-1004's run 5c627151 (A-8029). On dev d3e632bc it passes 5/5 alone on local macOS, and T-1118 touches no Neovim code.

## What to build

The test waits for the hub's artifact delivery receipt and the projection's refresh receipt rather than a 10 s screen poll under load, and keeps its final grid assertion.

## Acceptance criteria

- [ ] C1. The named test passes 20/20 in a local load loop and in a mode-free `cland verify` on Linux, keeping its final grid assertion (test).
