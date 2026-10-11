---
id: T-234
kind: task
title: "cland verify queue view and metrics: holder, waiters, waits, ETA, in the CLI and the workbench"
state: open
status: backlog
labels:
  - v0.1.1
  - ready-for-agent
assignee: null
parent: T-230
blocked_by:
  - T-232
topic: null
branch: null
created: 2026-10-11T17:48:35.460Z
updated: 2026-10-11T17:48:36.316Z
---

## What to build

Queue metrics and a queue view for `cland verify`:
- `cland verify queue [--json]` shows the holder, the waiters in order, each one's wait so far, and an ETA from recent run durations.
- The workbench shows a queue line, with holder, waiters and the next ETA, in the sessions panel or the top bar.
- The hub records per-run wait and run times and exposes them in `hub status` and the journal.

## Acceptance criteria

- [ ] The CLI view lists holder, waiters, waits and ETA; the JSON form is stable.
- [ ] The workbench line updates live from hub events (headless test).
- [ ] Wait and run times are recorded per run and summarised (median and p90 over the last N runs).
- [ ] `npm run typecheck && npm test` pass.
