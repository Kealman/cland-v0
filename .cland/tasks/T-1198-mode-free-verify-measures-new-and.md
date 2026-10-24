---
id: T-1198
kind: task
title: Mode-free verify measures new and changed T3/T4 identities on Linux and prints an allowance stanza
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1195
blocked_by: []
topic: topic-934
branch: t/T-1198-mode-free-verify-measures-new-and
created: 2026-10-24T06:46:04.400Z
updated: 2026-10-24T07:37:16.480Z
---

## Summary

In v0.2 a new T3 identity over its budget first showed up in a stage cover (T-1179, 7.23 s on cover c110635c), costing a cover pair. A task's own mode-free verify skips T3/T4. Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. A mode-free verify runs each new or changed T3/T4 identity once on Linux and, for any identity at 80 % or more of its tier budget, prints a ready-to-commit allowance stanza at about 1.5 times the worst passing sample (test).
- [ ] C2. docs/agents/tests.md documents the check and how it relates to T-931's headroom rule (docs).
