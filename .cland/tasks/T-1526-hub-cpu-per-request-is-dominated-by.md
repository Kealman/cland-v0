---
id: T-1526
kind: task
title: Hub CPU per request is dominated by Store.#bindProgress SQLite work (found by T-953's profile)
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-327
blocked_by: []
topic: null
branch: null
created: 2026-10-31T16:41:12.357Z
updated: 2026-10-31T16:41:12.357Z
---

## Summary

T-953's quiet-slot profile (2026-10-31 16:35–16:40Z, an immutable copy of the live hub.db, 288 requests per variant) shows hub CPU per request dominated by the SQLite run in `Store.#bindProgress`, followed by inbox and topic reads. Find out why each request binds progress rows, and cut that work. Do it under a work-count budget, not wall time.

## Evidence

On T-953 (comment 2026-10-31 16:41Z): baseline 22.89 ms CPU per request, 289,318 SQL executions and 186,336 prepares over 288 requests. That is about 1,000 SQL executions per request. T-953's measurement tool on its unmerged branch can be reused.

## Acceptance criteria

- [ ] C1. The item records which callers reach `Store.#bindProgress` per status/who/history/send request, and the expected count for each.
- [ ] C2. A sealed regression asserts a per-request SQL execution budget for a representative burst, failing before the change.
- [ ] C3. A before/after measurement in one quiet slot shows the CPU per request and the SQL executions per request, recorded as an artifact.
