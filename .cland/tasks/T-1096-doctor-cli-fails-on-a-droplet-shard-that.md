---
id: T-1096
kind: task
title: doctor-cli fails on a droplet shard that never builds the web bundle
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: t/T-1096-doctor-cli-fails-on-a-droplet-shard-that
created: 2026-10-22T07:20:08.870Z
updated: 2026-10-22T07:20:18.729Z
---

## Summary

The E-416 stage cover 5be1db36 (A-9000, shard-1 log A-9001, dev 90c54f5a, Linux droplet) failed four tests in `hub/test/doctor-cli.test.ts` "doctor CLI renders healthy text and JSON with exit 0": actual `warn web bundle: web/dist build stamp missing or invalid — npm run build in the cland installation`, expected no warnings (`23 ok, 1 warn` vs `24 ok, 0 warn`). The droplet checkout removes `web/dist/`, and `hub/test/run-suite.ts` builds the bundle before workers only when the shard runs Web tests or `hub/test/web-auth.test.ts` (`bundleScan`). After the 6e797f08 baseline refresh re-partitioned the shards, doctor-cli ran on a shard with neither, so the bundle was never built. At db122ec9 (918951c2) the same shard also ran web-auth and passed.

## Acceptance criteria

- [ ] C1. A hub-only shard whose selection contains `hub/test/doctor-cli.test.ts` but neither Web tests nor `web-auth.test.ts` builds the web bundle before its workers start; a suite-runner test proves it the way "a hub-only shard builds the bundle before its secret-scan worker starts" does (test).
- [ ] C2. Every other hub test that reads the built bundle or its stamp is either in the same build condition or independent of the checkout's `web/dist`, and the list is in the item topic from a search of hub/test (test).
