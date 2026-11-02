---
id: T-1620
kind: task
title: Snapshot deletion is confirmed by a GET
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1618
topic: topic-1343
branch: t/T-1620-snapshot-deletion-is-confirmed-by-a-get
created: 2026-11-02T03:34:17.445Z
updated: 2026-11-02T15:50:36.287Z
---

## Summary

Deleting a replaced executor snapshot after `prepare`, and in snapshot recovery, counts only once `GET /snapshots/{id}` answers 404. An unconfirmed deletion keeps its record, so the next recovery deletes it again.

Hot files: `hub/src/executor/droplet/api.ts`, `hub/src/executor/droplet/prepare.ts`, `hub/src/executor/droplet/snapshot-recovery.ts`, `hub/test/fakes/digitalocean/fake-api.ts`

## Acceptance criteria

- [ ] C1. The client can GET one snapshot by id, and the fake API answers it, with the same DELETE-404-while-GET-200 fault (test).
- [ ] C2. A snapshot deletion in `prepare` and in snapshot recovery counts only once the GET answers 404 (test).
- [ ] C3. An unconfirmed snapshot deletion keeps its recovery record, and the next recovery deletes and confirms it (test).
- [ ] C4. `executor-prepare.test.ts` and `executor-prepare-component.test.ts` pass with no test edited.

## Notes

Shared files: see Hot files
