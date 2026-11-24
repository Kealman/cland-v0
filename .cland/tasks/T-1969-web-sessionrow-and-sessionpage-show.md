---
id: T-1969
kind: task
title: Web SessionRow and SessionPage show stateReason only for live sessions, so a stopped or exited session hides its persisted state reason (such as a rename incomplete on host)
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: null
branch: t/T-1969-web-sessionrow-and-sessionpage-show
created: 2026-11-18T12:04:45.349Z
updated: 2026-11-24T10:05:36.725Z
---

## Summary

Found by impl-1672 while fixing T-1672 (2026-11-18). T-1672 persists a session's rename failure as `stateReason` ("rename incomplete on host: <cause>") for running, stopped and exited sessions, and the CLI shows it for every status. The web workbench's SessionRow and SessionPage render `stateReason` only while `row.live`, so a stopped or exited session shows only "stopped" or "died" and hides the reason.

## What to build

Show a session's persisted `stateReason` in SessionRow and SessionPage for non-live sessions as well, with the same text as the CLI, following web/AGENTS.md (tokens, contrast, no new dependency).

## Acceptance criteria

- [ ] C1. A stopped and an exited session with a stateReason show it in the row and on the session page, and a session without one is unchanged (web test).
