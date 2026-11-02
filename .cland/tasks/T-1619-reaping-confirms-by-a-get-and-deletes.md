---
id: T-1619
kind: task
title: Reaping confirms by a GET and deletes again what it could not confirm
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1618
topic: null
branch: null
created: 2026-11-02T03:34:17.281Z
updated: 2026-11-02T03:34:45.447Z
---

## Summary

`cland executor reap` and the hub's provider sweep confirm each droplet and key deletion with a GET by id, instead of the tag listing or nothing at all. An unconfirmed deletion is reported and not counted, and the next reap deletes it again.

Hot files: `hub/src/executor/droplet/droplet.ts` (`reap`, `sweep`), `hub/src/cli/executor.ts` (summary text only)

## Acceptance criteria

- [ ] C1. Reap and the provider sweep confirm each droplet deletion with a GET by id, not with the tag listing (test).
- [ ] C2. They confirm each key deletion with a GET by id (test).
- [ ] C3. A droplet or key whose GET still answers 200 is reported as unconfirmed, is not counted as reaped, and its lease stays open (test).
- [ ] C4. Against the fake API, after a DELETE 404 with a live GET, the next reap deletes the droplet and confirms it once the GET answers 404 (test).

## Notes

Shared files: see Hot files
