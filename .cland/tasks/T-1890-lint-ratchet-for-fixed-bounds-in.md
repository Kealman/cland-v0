---
id: T-1890
kind: task
title: Lint ratchet for fixed bounds in condition waits
state: open
status: backlog
size: S
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1889
topic: null
branch: null
created: 2026-11-16T07:29:44.909Z
updated: 2026-11-16T07:29:47.678Z
---

## Summary

test-lint already freezes `setTimeout`/`sleep` counts in `lint-baseline.json`, but not literal `timeoutMs` in `until`/`eventually`/`remoteEventually` (671 literals in 93 files). Count them, freeze, report new ones. §7 #2.

Kind: product (test lint). Triage ticket H-2 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [ ] C1. Numeric `timeoutMs` and `loadFactor: 1` in condition waits count as `wall-clock-wait` unless the call names a behaviour-bound reason (test).
- [ ] C2. Current counts are frozen in `lint-baseline.json`, and a new literal in a changed file is reported in report mode (test).

## Dependencies

H-1
