---
id: T-1206
kind: task
title: Docs lint flags 'until T-n', 'stand-in' and 'pending' wording that names a closed item
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:46:05.445Z
updated: 2026-10-24T06:46:05.445Z
---

## Summary

README sentences claiming landed work was pending or a stand-in recurred as QA findings across v0.2 stages (T-1160, T-1164, T-1180). Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. The lint reports each README or docs line that names a closed item with 'until', 'stand-in', 'pending' or 'later ticket' wording, over a fixture tracker (test).
- [ ] C2. The current READMEs pass, or each finding is fixed in this item (docs).
