---
id: T-1618
kind: task
title: Droplet and key deletion is confirmed by a GET on release and in the watchdog
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: null
branch: null
created: 2026-11-02T03:34:16.979Z
updated: 2026-11-02T03:34:44.874Z
---

## Summary

The DigitalOcean client stops counting a DELETE 404 as proof of deletion. A droplet or key counts as gone only once a GET by id answers 404. Lease release and the detached watchdog keep the lease open until then. The fake DigitalOcean API learns to answer a DELETE 404 while its GET still answers 200.

Hot files: `hub/src/executor/droplet/api.ts` [E-1533 reuses], `hub/src/executor/droplet/cleanup.ts`, `hub/src/executor/droplet/watchdog.ts`, `hub/src/executor/droplet/deadline.ts`, `hub/test/fakes/digitalocean/fake-api.ts` [E-1533 extends]

## Acceptance criteria

- [ ] C1. The client's droplet and key deletions never report a DELETE 404 as success, and a deletion counts only once a GET by id answers 404 (test).
- [ ] C2. The client can GET one SSH key by id, and the fake DigitalOcean API answers it (test).
- [ ] C3. The fake API can make a droplet's or key's DELETE answer 404 while its GET keeps answering 200 for a set number of reads (test).
- [ ] C4. On lease release, a droplet or key whose GET still answers 200 leaves the lease `releasing` with its attention recorded, and its spend reservation is not settled (test).
- [ ] C5. The watchdog confirms the key by a GET by id, and writes its receipt only after every GET answered 404 (test).
- [ ] C6. Once the GET answers 404, the next release attempt confirms the deletion, settles the spend and marks the lease released (test).
- [ ] C7. `executor-droplet.test.ts`, `executor-droplet-component.test.ts` and `executor-safety.test.ts` pass with no test edited.

## Notes

Shared files: see Hot files
