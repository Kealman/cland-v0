---
id: T-1618
kind: task
title: Droplet and key deletion is confirmed by a GET on release and in the watchdog
state: open
status: review
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: topic-1330
branch: t/T-1618-droplet-and-key-deletion-is-confirmed-by
created: 2026-11-02T03:34:16.979Z
updated: 2026-11-02T05:56:20.232Z
---

## Summary

The DigitalOcean client stops counting a DELETE 404 as proof of deletion. A droplet or key counts as gone only once a GET by id answers 404. Lease release and the detached watchdog keep the lease open until then. The fake DigitalOcean API learns to answer a DELETE 404 while its GET still answers 200.

Hot files: `hub/src/executor/droplet/api.ts` [E-1533 reuses], `hub/src/executor/droplet/cleanup.ts`, `hub/src/executor/droplet/watchdog.ts`, `hub/src/executor/droplet/deadline.ts`, `hub/test/fakes/digitalocean/fake-api.ts` [E-1533 extends]

## Acceptance criteria

- [x] C1. The client's droplet and key deletions never report a DELETE 404 as success, and a deletion counts only once a GET by id answers 404 (test).
  - done: impl-1618 · 2026-11-02T05:53:36.274Z
- [x] C2. The client can GET one SSH key by id, and the fake DigitalOcean API answers it (test).
  - done: impl-1618 · 2026-11-02T05:53:36.747Z
- [x] C3. The fake API can make a droplet's or key's DELETE answer 404 while its GET keeps answering 200 for a set number of reads (test).
  - done: impl-1618 · 2026-11-02T05:53:37.413Z
- [x] C4. On lease release, a droplet or key whose GET still answers 200 leaves the lease `releasing` with its attention recorded, and its spend reservation is not settled (test).
  - done: impl-1618 · 2026-11-02T05:53:38.042Z
- [x] C5. The watchdog confirms the key by a GET by id, and writes its receipt only after every GET answered 404 (test).
  - done: impl-1618 · 2026-11-02T05:53:38.703Z
- [x] C6. Once the GET answers 404, the next release attempt confirms the deletion, settles the spend and marks the lease released (test).
  - done: impl-1618 · 2026-11-02T05:53:39.248Z
- [x] C7. `executor-droplet.test.ts`, `executor-droplet-component.test.ts` and `executor-safety.test.ts` pass with no test edited.
  - done: impl-1618 · 2026-11-02T05:53:39.515Z

## Notes

Shared files: see Hot files

## Comments

### impl-1618 · 2026-11-02T05:44:08.518Z

Rule 20 inventory: api.ts deletions consumed by cleanup.ts (release + watchdog), droplet.ts reap, prepare.ts, snapshot-recovery.ts, demo-release-component.test.ts, suite-unit-fixture.ts and executor-prepare-retry.test.ts proxy. Provider shape flows through dependencies.ts, deadline.ts, remote-fixture.ts and fakeDigitalOcean; searched hub/src, hub/test, qa, docs and shipped skills for method names and ProviderCall. Snapshot deletion remains for T-1620. Fake will add GET-by-id for key/snapshot, split DELETE404/GET200 read-count faults and method-specific GET delay reusable by T-1619/T-1620/E-1533. No wire/persisted schema removal.

### impl-1618 · 2026-11-02T05:45:56.175Z

Additional contract inventory: ReleaseAttention.reason is additive deletion-unconfirmed; explicit consumers are executor inspect summary and hub/demos.ts notices, both migrated; existing demo-release-component test retains deletion-timeout assertion unchanged. Generic wire/projected attention readers preserve prior fields. New DigitalOceanApi.key/snapshot methods added to deadlineArgument; snapshot deletion behavior unchanged for T-1620. Red receipts: initial client test failed Missing expected rejection; release droplet/key cases failed saved.attention. All four current T2 cases now pass on macOS Node24.21.0 with scripted fake, no browser.

### impl-1618 · 2026-11-02T05:49:23.068Z

C7 preservation receipts on current uncommitted tree, macOS/Node24.21.0, local native/fake transport, no browser: executor-droplet.test.ts 14/14; executor-droplet-component.test.ts 1/1; executor-safety.test.ts 17/17. All three files unchanged. New watchdog T3 1/1 and confirmation T2 4/4. Full tiers have not run yet. Migrating demo-release-component consumers: accepted pending deletions now expose attention immediately; direct delayed delete expects DeletionUnconfirmed, with timeout and identity final assertions retained.
