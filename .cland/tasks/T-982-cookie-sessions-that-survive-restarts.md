---
id: T-982
kind: task
title: Cookie sessions that survive restarts, listed and revoked
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-980
topic: null
branch: null
created: 2026-10-20T16:50:00.187Z
updated: 2026-10-20T20:57:50.557Z
---

## Summary

The hub keeps each web cookie session hashed in `hub.db`, so a hub restart signs no browser out. `cland web --sessions` lists the sessions, and `cland web --revoke <id>` ends one and closes its sockets.

## What to build

Each cookie session is stored as a hash, with its creation time and its last use. A restart keeps it, and it expires after 30 days. `cland web --sessions` prints each session's id, creation, last use and open sockets. `cland web --revoke <id>` ends that session at once: its sockets close and its cookie is refused from then on.

## Acceptance criteria

- [ ] C1. A cookie issued before a hub restart still opens `/ws` after it (test with two hub starts on one project).
- [ ] C2. `hub.db` holds only a hash of each cookie, with its creation and last use (test reads the row).
- [ ] C3. `cland web --sessions` lists each cookie session with its id, creation, last use and open socket count (CLI test).
- [ ] C4. `cland web --revoke <id>` closes that session's open sockets within the call, and its cookie is refused afterwards (test).
- [ ] C5. A cookie session older than 30 days is refused (fake-clock test).
- [ ] C6. `hub/README.md` documents `--sessions`, `--revoke` and the 30-day lifetime.
