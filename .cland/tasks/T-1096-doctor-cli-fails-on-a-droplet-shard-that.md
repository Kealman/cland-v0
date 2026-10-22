---
id: T-1096
kind: task
title: doctor-cli fails on a droplet shard that never builds the web bundle
state: open
status: in progress
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: topic-839
branch: t/T-1096-doctor-cli-fails-on-a-droplet-shard-that
created: 2026-10-22T07:20:08.870Z
updated: 2026-10-22T07:39:26.752Z
---

## Summary

The E-416 stage cover 5be1db36 (A-9000, shard-1 log A-9001, dev 90c54f5a, Linux droplet) failed four tests in `hub/test/doctor-cli.test.ts` "doctor CLI renders healthy text and JSON with exit 0": actual `warn web bundle: web/dist build stamp missing or invalid — npm run build in the cland installation`, expected no warnings (`23 ok, 1 warn` vs `24 ok, 0 warn`). The droplet checkout removes `web/dist/`, and `hub/test/run-suite.ts` builds the bundle before workers only when the shard runs Web tests or `hub/test/web-auth.test.ts` (`bundleScan`). After the 6e797f08 baseline refresh re-partitioned the shards, doctor-cli ran on a shard with neither, so the bundle was never built. At db122ec9 (918951c2) the same shard also ran web-auth and passed.

## Acceptance criteria

- [ ] C1. A hub-only shard whose selection contains `hub/test/doctor-cli.test.ts` but neither Web tests nor `web-auth.test.ts` builds the web bundle before its workers start; a suite-runner test proves it the way "a hub-only shard builds the bundle before its secret-scan worker starts" does (test).
  - failed: rev-23 [reviewer] · 2026-10-22T07:39:26.752Z · note Final configured evidence blocked: A-9016 exits 1 on viewport PageDown assertion plus 8.494s > 5s gate; runner regression itself not disproven.
- [x] C2. Every other hub test that reads the built bundle or its stamp is either in the same build condition or independent of the checkout's `web/dist`, and the list is in the item topic from a search of hub/test (test).
  - done: impl-1096 · 2026-10-22T07:25:18.893Z
  - verified: rev-23 [reviewer] · run rev-20261022-1096-source · 2026-10-22T07:29:31.249Z · commit 7c1469bc81d0a724dc87d64eeebb919e4116ec37

## Comments

### impl-1096 · 2026-10-22T07:23:49.396Z

Added the requested synthetic doctor-only shard regression before fixing runSuite; red on 90c54f5a plus test: ENOENT web/dist/index.html, existing secret scan green (A-9004). Both cases pass with the named installedBundleReaders prerequisite (A-9005), local Darwin arm64 targeted T3, no suite/gate. C2 reader audit is in topic-839. Updated hub README, tests guide and implement skill; role clauses untouched at reserve. Fetched and merged origin/dev before first source review (74175ef9). Full targeted runner file and typecheck pending.

### rev-23 · 2026-10-22T07:29:31.249Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1096-source
commit: 7c1469bc81d0a724dc87d64eeebb919e4116ec37
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 / Spec 0 findings. A-9013 records the independent bundle-reader audit and isolated T3 regression review; C2 verified. Original local targeted A-9004 red, A-9005 green, A-9007 45/45 are supporting evidence, not a configured gate. C1 final settlement remains pending ordinary mode-free same-head verification. QA none.

Criteria: C2 verified.

### impl-1096 · 2026-10-22T07:39:01.688Z

Source clear at 7c1469bc (rev-20261022-1096-source); C2 independently verified. Mode-free verify 7be3f149 (A-9016), Linux x64 droplet c-8 lon1, exit 1: T1 and all-T2 fallback passed; Web failed `web/test/palette.test.ts` 1024×600 with `Error: PageDown reveals open-other: not within 6000 ms`, plus its parent failure. 2412 total / 2410 pass / 2 fail. No T3 run; local targeted runner evidence remains A-9007. Typecheck host gate reused, not repeated; tier/budget diagnostics report-only. Shared-defect candidate reported to lead T-1096; holding diagnosis and head changes for Coordinator. Final readiness pending.

### rev-23 · 2026-10-22T07:39:26.752Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1096-evidence-1
commit: 7c1469bc81d0a724dc87d64eeebb919e4116ec37
scope: evidence
findings: [{"severity":"medium","text":"Same-head A-9016 fails 1024×600: 'PageDown reveals open-other: not within 6000 ms'; parent also fails and trips enforced 8.494s > 5s duration gate. Untouched task source: shared-defect candidate requiring lead/Coordinator disposition; allowance alone cannot fix the assertion.","file":"web/test/palette.test.ts","line":212}]
finding_counts: {"high":0,"medium":1,"low":0}

A-9019 records original-log audit. Evidence not clear: T1/T2 pass, actual Web fails, 2410 passes/2 test failures (subcase plus parent), overall exit1. No remote T3/T4/load evidence. Source A-9013 and C2 audit retained; no new implementation defect established. Route shared candidate to Coordinator before retry or unrelated edits.

Criteria: C1 failed (Final configured evidence blocked: A-9016 exits 1 on viewport PageDown assertion plus 8.494s > 5s gate; runner regression itself not disproven.).
