---
id: T-1205
kind: task
title: qa-demo-record.ts refuses a PASS with missing fact keys or step errors and scans for secrets before publishing
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:46:05.322Z
updated: 2026-10-24T20:48:42.945Z
---

## Summary

In the v0.2 demos a recorder logged a premature PASS (E-420 gate 00), and a walk saved raw one-time sign-in links to logs (E-420 walk 2). Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. A run with a missing expected fact key or a recorded step error cannot record PASS (test).
- [ ] C2. A saved capture containing a sign-in token or provider key is redacted or refused before publishing (test).
