---
id: T-768
kind: task
title: "Hub CPU under a session burst: cut repeated SQLite statement preparation and per-session presence/visibility queries"
state: open
status: backlog
size: M
labels:
  - hub
  - performance
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-18T03:10:12.614Z
updated: 2026-10-18T03:10:12.614Z
---

## Summary

T-758's profile (impl-758, 2026-10-18 03:10Z, C1 artifact in topic-470) ran 9 socket sessions sending 22,052 status, send, who and history requests in 6.0 s against a fresh temporary hub. Most of the hub's CPU went to synchronous native SQLite prepare, all, get and run. These came through store.history (1.2 s inclusive, about 20 %) and repeated per-session presence, sessionHolds and roleOf visibility reads. On 2026-10-17 at 22:03Z the live hub (87 MB hub.db, 115 MB journal) stayed at 40–98 % CPU with nine sessions and missed 3 s admissions.

## What to build

Profile the live-size case: a copy of a large hub.db in a temp project under the same burst. Then cache prepared statements per connection and compute presence and visibility once per tick or request batch, not per row or per session. Keep every visibility rule.

## Acceptance criteria

- [ ] C1. A before/after inspector profile of a hub using a copied large hub.db under a nine-session burst shows hub CPU per request falling by half or more, recorded with both artifacts, and the visibility and permission tests pass unchanged.
