---
id: T-916
kind: task
title: "release.test.ts fails entirely inside a local integrated run: it reaches the live hub and its own cover-quiet refuses it (T-886)"
state: open
status: in progress
size: S
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-886
found_by: cover
topic: topic-658
branch: t/T-916-release-test-ts-fails-entirely-inside-a
created: 2026-10-19T22:41:23.487Z
updated: 2026-10-19T22:41:43.493Z
---

## Summary

In stage cover #1's macOS run 781169bb at b62bf16c (local integrated, from the root; A-6767, from line ~72279), all 22 tests of `hub/test/release.test.ts` failed in about 0.1 ms each with "cover-quiet: integrated run 781169bb… holds the local test slot … (only the human may set CLAND_TEST_IGNORE_COVER=1)", raised by shared/socket-client.ts. Code inside the integrated run reached the LIVE project hub's slot check without the run's own lease and was refused by its own cover. T-886 (93be29ea) added `releaseCover(root)` calls and the import of `hub/test/release-support.ts` to the file. The Linux droplet run, with no live hub, passed it. Until this is fixed, every local macOS stage, epic or release run fails.

## What to build

Find which call in release.test.ts or release-support.ts (or the CLI they drive in a scratch machine) resolves the live project hub instead of the fixture's scratch hub, or asks for the slot without the inherited lease. Fix it so that:
- tests running inside an integrated local run never contact the live hub, by keeping the fixture's hub resolution inside its scratch root;
- or, where a slot check is legitimate, it passes the run's lease.
Keep the cover-quiet guard as strict as it is.

## Acceptance criteria

- [ ] C1. The cause is named in the report, with the exact call path.
- [ ] C2. A regression test (T2 if possible) shows that release-support's cover helper and the release CLI under the fixture never reach a hub outside the scratch root, even while a fake live hub holds an integrated cover.
- [ ] C3. `hub/test/release.test.ts` passes in a local run on macOS while another local integrated run holds the slot, simulated by a fixture, with the receipt in the report.
