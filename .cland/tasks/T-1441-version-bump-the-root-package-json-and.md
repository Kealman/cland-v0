---
id: T-1441
kind: task
title: "Version bump: the root package.json and lockfile at 0.3.0"
state: closed
status: done
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
updated: 2026-10-29T16:38:09.716Z
closed: 2026-10-29T16:38:09.716Z
---

## Summary

`cland release --item R-1278` refuses a version that differs from the project's, so the root `package.json` and both lockfile version fields move to 0.3.0 in an ordinary reviewed item before the dry run, as T-1185 did for 0.2.0.

## What to build

Set the root `package.json` version and the two version fields of `package-lock.json` to 0.3.0. Change nothing else, and add no dependency.

## Acceptance criteria

- [x] C1. On the branch, the root `package.json` and both `package-lock.json` version fields read 0.3.0, and `npm run typecheck` passes.
  - done: impl-1441 · 2026-10-29T15:57:10.550Z
  - verified: rev-26 [reviewer] · run rev-20261029-1441-evidence-2 · 2026-10-29T16:23:49.618Z · commit 1641a67d9757a5d6b37ca36de6aadd3c2af35a2b
- [x] C2. The diff touches only those version fields.
  - done: impl-1441 · 2026-10-29T15:57:11.215Z
  - verified: rev-26 [reviewer] · run rev-20261029-1441-source-1 · 2026-10-29T15:57:49.860Z · commit e33eaffa6c1a01f6394cdd63874c9c1d6c25905e
  - verified: rev-26 [reviewer] · run rev-20261029-1441-source-2 · 2026-10-29T16:05:44.401Z · commit 1641a67d9757a5d6b37ca36de6aadd3c2af35a2b
  - verified: rev-26 [reviewer] · run rev-20261029-1441-evidence-2 · 2026-10-29T16:23:49.618Z · commit 1641a67d9757a5d6b37ca36de6aadd3c2af35a2b

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

### rev-26 · 2026-10-29T16:05:44.401Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1441-source-2
commit: 1641a67d9757a5d6b37ca36de6aadd3c2af35a2b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source2 clear,Standards/Spec nofindings. A-13752pinsparents/tree; all34importedpaths exactlydev(33tracker+sharedREADMEwordingfix), no conflict/product/guardchange. Versionfiles byte-identical source1; taskcontributionrelativemergeddevexactly3requestedversionfields0.3.0,no dependencies. C2source-refreshed; C1currentheadtypecheck/runtimepending. PriorfailedA-13736/A-13737 andpositiveoldheadtypecheck/build remain separate. Proceedunchangedheadconfiguredmodefree/finalreview; no Reviewerworkloads/fullrun/releasepublishrequest.

Criteria: C2 verified.

### rev-26 · 2026-10-29T16:23:49.618Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1441-evidence-2
commit: 1641a67d9757a5d6b37ca36de6aadd3c2af35a2b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13788 original A-13787 independently audited at unchanged source2 head. Standards: complete task contribution exactly three requested 0.3.0 version replacements, no dependency/other changes. Spec C1/C2 verified: root full typecheck/build/static host execution positive T0 55.710s; remote host-gate reuse7c601447 explicit. Configured T1/T2/Web pass; dedup4150ordinary+50load passes, zero nonpass/unfinished; no task-new tests. T3/T4 unrun, remaining coverage excluded; report-only budgets/lint not enforced passes. Historical failed A-13736/A-13737 retained separately. No Reviewer workloads, QA none/after-stage.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-29T16:38:09.716Z

Merged 943b35967e7f9c95232a4c92258c0ff7e786c5a8 onto dev.
dependencies out of date: package-lock.json changed; run npm install in root /Users/evgeniyivanov/Projects/cland/v0 (required; stop shared readers before updating node_modules)
