---
id: T-768
kind: task
title: "Hub CPU under a session burst: cut repeated SQLite statement preparation and per-session presence/visibility queries"
state: open
status: review
size: M
criterion_seq: 1
labels:
  - hub
  - performance
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-717
branch: t/T-768-hub-cpu-under-a-session-burst-cut
created: 2026-10-18T03:10:12.614Z
updated: 2026-10-20T09:47:52.046Z
---

## Summary

T-758's profile (impl-758, 2026-10-18 03:10Z, C1 artifact in topic-470) ran 9 socket sessions sending 22,052 status, send, who and history requests in 6.0 s against a fresh temporary hub. Most of the hub's CPU went to synchronous native SQLite prepare, all, get and run. These came through store.history (1.2 s inclusive, about 20 %) and repeated per-session presence, sessionHolds and roleOf visibility reads. On 2026-10-17 at 22:03Z the live hub (87 MB hub.db, 115 MB journal) stayed at 40–98 % CPU with nine sessions and missed 3 s admissions.

## What to build

Profile the live-size case: a copy of a large hub.db in a temp project under the same burst. Then cache prepared statements per connection and compute presence and visibility once per tick or request batch, not per row or per session. Keep every visibility rule.

## Acceptance criteria

- [x] C1. A bounded, connection-local statement cache serves the store's prepared statements with SQL, bindings and visibility unchanged; inbox-load.ts (or an equivalent T4 harness) reports executed SQL operations and prepare calls per burst before and after, plus an indicative CPU figure with the machine load noted. The ≥50 % CPU target and presence/visibility batching move to a follow-up in Ideas.
  - done: impl-768 · 2026-10-20T09:47:42.200Z

## Comments

### impl-768 · 2026-10-20T09:47:43.072Z

Implemented a bounded 256-entry connection-local Store statement cache, mechanically routing all 172 Store prepare calls with unchanged SQL argument expressions (AST checked). Prepared calls fell 23,874 -> 16,528 (30.8%) for 400 paced requests; executions 23,474 -> 23,542, inbox rebuilds 17 both. Indicative CPU 1351.639 -> 1798.536 ms at 1-minute load 11.907 -> 9.854; after sample also overlapped targeted visibility checks, so no CPU improvement claim. Evidence A-7277 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7277-t-768-cache-implementation-and-before-after-evidence.md), raw A-7271/A-7272, committed docs/evidence/T-768-statement-cache.md. Store 20/20, inbox 8/8, name reservation 67/67, visibility 7/7, permissions 13/13, npm run check green. Query tracers and warmed-statement fault injectors now observe execution. Source review next, then mode-free verification at reviewed head.
