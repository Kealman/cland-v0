---
id: T-2070
kind: task
title: The web workbench refetches events.list (limit 200) on every event frame, so an open workbench polls the hub 200–400 times a minute
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: null
branch: null
created: 2026-11-24T08:59:12.050Z
updated: 2026-11-24T09:00:31.732Z
---

## Summary

Split from T-2037 (its C3) by the 0.4.1 re-triage A-22763, which the human approved on ask 0d31338f. `web/src/connection.ts` (about lines 653–654) sends a full `events.list` with limit 200 on every `event` frame, so the request rate has no bound. On 2026-11-20, an open workbench made 200–400 calls a minute while the hub ran at 70–94% CPU, and hub.log holds over 408,000 such audit lines.

## What to build

Stop refetching the whole list on every event frame. Apply the pushed event as a delta, or coalesce refetches to at most one per bounded interval. Document the resulting idle and busy request rate. Route any key bindings through `web/src/keymap.ts`, and add no dependency.

## Acceptance criteria

- [ ] C1. Under a burst of event frames, the workbench issues at most one `events.list` per bounded interval and shows every event (test).
- [ ] C2. The idle `events.list` request rate is bounded and documented in the web docs (test plus doc).
