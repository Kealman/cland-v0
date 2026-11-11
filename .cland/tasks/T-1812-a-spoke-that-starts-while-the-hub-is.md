---
id: T-1812
kind: task
title: "A spoke that starts while the hub is down never connects: no hub.json at startup means no endpoint for its lifetime"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-11T06:00:56.866Z
updated: 2026-11-11T06:00:56.866Z
---

## Summary

`hub/src/spoke/spoke.ts` resolves discovery once at startup: `findDiscovery(cwd)` returns the nearest existing `.cland/hub.json`, and only then builds the `endpoint` closure that re-reads the file before every reconnect. If the spoke starts in the window where the hub has stopped and removed `hub.json` (a restart, or a session started while the hub is down), `discoveryFile` is null, no endpoint exists, and the spoke stays `hub: null` for the MCP transport's lifetime, even after the hub listens again. T-1811's diagnosis showed it: a relaunched Codex spoke initialized 22 ms after the fixture hub stopped and never connected, while the new hub listened 6 ms later (topic-1473, T-1811's C1 comment). Already-connected sessions are unaffected; they keep their endpoint and reconnect.

## What to build

When no discovery file exists at startup and no `CLAND_HUB_URL`/`CLAND_HUB_SECRET` is set, keep looking: resolve the project's discovery path (the nearest `.cland` directory walking up, or `CLAND_HUB_FILE`) and re-check for `hub.json` on the existing reconnect schedule, connecting once it appears. A cwd with no `.cland` anywhere above it keeps today's "not configured" answer. The session's tools answer the existing not-connected error until it connects.

## Acceptance criteria

- [ ] C1. A spoke started in a project whose `.cland/hub.json` is absent connects, within the reconnect schedule, after a hub starts and writes `hub.json` (test).
- [ ] C2. A spoke started where no `.cland` directory exists above its cwd still answers the not-configured error and never polls (test).
- [ ] C3. A spoke with `CLAND_HUB_FILE` naming an absent file connects once that file appears (test).
