---
id: T-905
kind: task
title: The hub warns when it runs below normal priority (nice > 0)
state: open
status: backlog
size: XS
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-19T19:41:14.642Z
updated: 2026-10-19T19:41:14.642Z
---

## Summary

A hub started from a background shell job inherits zsh's BG_NICE (nice 5). On 2026-10-19 hub pid 14662 ran at nice 5 after restart #20 (direct serve inside `zsh -ic` with `&`). Under crew load 51 it stopped answering `hub status` and MCP calls for about 5 minutes (19:34–19:39Z). Lowering niceness on a live pid needs root.

## Acceptance criteria

- [ ] C1. (T1) At start the hub reads its own niceness. When it is above 0 it logs a warning and shows it in `cland hub status` and `cland doctor`, naming the cause (for example BG_NICE) and how to restart at nice 0. A test injects the niceness probe.
