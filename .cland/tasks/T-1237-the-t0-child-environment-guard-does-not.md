---
id: T-1237
kind: task
title: The T0 child-environment guard does not cover nvim/test
state: open
status: planned
size: S
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
topic: null
branch: null
created: 2026-10-24T11:55:41.896Z
updated: 2026-10-25T09:53:54.354Z
---

## Summary

The T0 child-environment guard that statically enforces rule 15 (sealed child environments) covers hub/test only. Neovim tests under nvim/test spawn native children (clients, launchers, QA subprocesses) that escaped it until T-1012 sealed them by hand. impl-1012 proposed it during T-1012.

## Acceptance criteria

- [ ] C1. The T0 child-environment guard scans nvim/test as well as hub/test and refuses an unsealed child launch there (test).
- [ ] C2. The guard passes on dev after T-1012 lands, with no new exemptions (test).
