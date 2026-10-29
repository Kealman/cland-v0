---
id: T-1441
kind: task
title: "Version bump: the root package.json and lockfile at 0.3.0"
state: open
status: in progress
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1314
blocked_by: []
topic: topic-1183
branch: t/T-1441-version-bump-the-root-package-json-and
created: 2026-10-29T15:55:47.281Z
updated: 2026-10-29T15:59:02.021Z
---

## Summary

`cland release --item R-1278` refuses a version that differs from the project's, so the root `package.json` and both lockfile version fields move to 0.3.0 in an ordinary reviewed item before the dry run, as T-1185 did for 0.2.0.

## What to build

Set the root `package.json` version and the two version fields of `package-lock.json` to 0.3.0. Change nothing else, and add no dependency.

## Acceptance criteria

- [x] C1. On the branch, the root `package.json` and both `package-lock.json` version fields read 0.3.0, and `npm run typecheck` passes.
  - done: impl-1441 · 2026-10-29T15:57:10.550Z
- [x] C2. The diff touches only those version fields.
  - done: impl-1441 · 2026-10-29T15:57:11.215Z
  - verified: rev-26 [reviewer] · run rev-20261029-1441-source-1 · 2026-10-29T15:57:49.860Z · commit e33eaffa6c1a01f6394cdd63874c9c1d6c25905e

## Comments

### impl-1441 · 2026-10-29T15:57:11.460Z

Implemented at e33eaffa6c1a01f6394cdd63874c9c1d6c25905e and pushed to origin. Local macOS npm run typecheck passed; diff/check confirms only the three requested root version fields. No new tests warranted for the metadata-only scope; no test-marked criteria. Source review next, then mode-free verification.

### rev-26 · 2026-10-29T15:57:49.860Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1441-source-1
commit: e33eaffa6c1a01f6394cdd63874c9c1d6c25905e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source1 clear,Standards/Spec nofindings. A-13735 pinshead/tree/parent andcomplete2-file3-scalar diff: rootpackageversion/locktopversion/lockpackagesemptyversion0.2.2→0.3.0 only. No dependency/scripts/integrity/workspace/docs/sourcechange. C2sourceverified; C1versionportionestablished,typecheckportionreportedlocalonly/pendingoriginalexecutionrecords. Proceedunchangedheadconfiguredmodefree/finalevidence; norelease/publishorReviewerfullrunrequested. QA none/after-stage,no Reviewerworkloads.

Criteria: C2 verified.

### impl-1441 · 2026-10-29T15:58:49.944Z

Verification 9f55e0a1 at e33eaffa6 blocked at T0 host check: hub/README.md:1367 closed item E-1313 with pending wording (A-13736). Root typecheck and Web build completed locally on macOS; no droplet created, T1/T2/Web runtime tiers did not run. Shared defect reported to Coordinator; holding source/retry changes pending posted fix.

### rev-26 · 2026-10-29T15:59:02.021Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1441-evidence-1
commit: e33eaffa6c1a01f6394cdd63874c9c1d6c25905e
scope: evidence
findings: [{"severity":"medium","text":"Host check failed inherited closed-item wording guard: closed E-1313 with pending wording. Outside version-only diff; Coordinator shared disposition required, no local scope expansion/blind retry. No droplet/runtime execution.","file":"hub/README.md","line":1367}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13737 original A-13736 audit: configured9f55e0a1exit1,T0host20.451s, no dropletcreated/no runtimecounts/platform/health; T1T2WebT3T4unrun. Exactheadrootnpmtypecheck allworkspaces/staticWebchecks andWebbuildcompletedpositively beforewordinglintfailure, notanoverallgreen. Source1A-13735/C2sourceverifiedremain; C1version/typecheckpositivepartial,nofinalruntimeverificationmarkorproductfailureinferred. Lead/sharedCoordinatorreporthold; anydirectedchangedheadneedsdeltareview/successorrun/finalreview. No Reviewerworkloads/release/publish/fullrunrequest.
