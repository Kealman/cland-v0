---
id: T-1187
kind: task
title: Hub reload acknowledges [web] changes that the running web edge ignores
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
created: 2026-10-23T21:39:31.010Z
updated: 2026-10-23T21:39:31.010Z
---

## Summary

`cland hub reload` accepts changes to `[web]` settings (bind, port, origin, dist) and publishes the newly parsed config. But the web edge is created once from the startup config: `hub/src/hub/daemon.ts` around line 419 builds it, and `STARTUP_FIELDS` in `hub/src/hub/configuration.ts` doesn't include `web`. So a reloaded `[web]` change is acknowledged while the running edge keeps its old values. impl-1186 found this by reading the source on 2026-10-23 at 21:39Z; no test or probe was run. T-1186 documents that `[web]` changes need a hub stop and start.

## What to build

Treat `web` as a startup field, so that a reload that changes it is refused with a message naming the restart. Alternatively, rebind the edge on reload. Pick whichever matches how the other startup fields behave.

## Acceptance criteria

- [ ] C1. Changing `[web] origin`, `bind` or `port` and running `cland hub reload` is either refused with a message naming a restart, or applied to the running edge. No reload acknowledges a `[web]` change that the edge ignores (test).
