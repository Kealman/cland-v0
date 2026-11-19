---
id: T-1976
kind: task
title: Hot hub SQLite paths prepare statements per call (prepare at 6–8% of main-thread self time)
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-18T12:37:50.486Z
updated: 2026-11-19T00:37:36.990Z
---

## Summary

From the profile behind T-1973 (2026-11-18, hub pid 52877, 12:31–12:32Z). SQLite `prepare` took 6–8% of main-thread self time, next to `all` at 11–13% and `get` at 8–9%. That suggests hot paths prepare their statements on every call instead of reusing them.

## What to build

Cache the prepared statements on the hot read paths the profile names (suite summaries, inbox, tracker reads), keyed per database connection and closed with it.

## Acceptance criteria

- [ ] C1. Repeated calls of each named hot path prepare each statement once per connection, counted through a seam (test).
- [ ] C2. Statements are finalized when their connection closes, including during hub stop, and no closed statement is reused (test).
