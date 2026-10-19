---
id: T-905
kind: task
title: The hub warns when it runs below normal priority (nice > 0)
state: open
status: review
size: XS
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: topic-646
branch: t/T-905-the-hub-warns-when-it-runs-below-normal
created: 2026-10-19T19:41:14.642Z
updated: 2026-10-19T20:30:58.355Z
---

## Summary

A hub started from a background shell job inherits zsh's BG_NICE (nice 5). On 2026-10-19 hub pid 14662 ran at nice 5 after restart #20 (direct serve inside `zsh -ic` with `&`). Under crew load 51 it stopped answering `hub status` and MCP calls for about 5 minutes (19:34–19:39Z). Lowering niceness on a live pid needs root.

## Acceptance criteria

- [ ] C1. (T1) At start the hub reads its own niceness. When it is above 0 it logs a warning and shows it in `cland hub status` and `cland doctor`, naming the cause (for example BG_NICE) and how to restart at nice 0. A test injects the niceness probe.

## Comments

### impl-905b · 2026-10-19T20:28:55.829Z

Implementation uses node:os getPriority(0) behind an injected priorityProbe at serveProject startup. One shared warning carries cause and restart guidance through structured logging, hub.status, hub status text/JSON and doctor. Validation: T1 probe policy and T2 projectHub fixture; no live hub restart.

### rev-30 · 2026-10-19T20:30:58.354Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-905-source
commit: 7203f32210aea95437019aec099c3ac9c12663c4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-6637. Single injected/default getPriority(0) observation warns only for positive niceness, logs at startup and propagates cached warning to status and doctor text/JSON; names BG_NICE and nice0 foreground restart. No priority mutation or child process. Probe failures leave unknown without blocking startup. T1 policy and FakeClock/in-process T2 public-report controls preserve deterministic boundaries, optional protocol field backward compatible. C1 awaits exact-head mode-free runtime/five-repetition evidence with no owned budget/resource mismatch. QA none.
