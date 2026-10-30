---
id: T-1461
kind: task
title: A macOS load-gate repetition failure of a test green in recent covers gets one automatic rerun
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-30T05:44:58.258Z
updated: 2026-10-30T05:44:58.258Z
---

## Summary

In v0.3.0, macOS local covers went red 20 times in 34 runs, against 5 in 28 on Linux, costing about 10.9 h (retro A-14149). When a test that passed in recent covers fails only in a macOS load-gate repetition, the cover reruns that identity once automatically; the finding is still filed under the flaky-rerun rule. Retro v0.3.0 change 1.

## Acceptance criteria

- [ ] C1. A cover whose only failure is one load-gate repetition of a previously green identity reruns it once and records both receipts.
