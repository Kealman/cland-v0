---
id: T-1043
kind: task
title: Moved-artifact cleanup decodes the whole artifact index once per folder
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-1003
branch: t/T-1043-moved-artifact-cleanup-decodes-the-whole
created: 2026-10-21T10:08:37.378Z
updated: 2026-10-24T21:44:13.265Z
closed: 2026-10-24T21:44:13.265Z
---

## Summary

impl-1039's CPU profile of a hub on a copy of the live project (8,163 artifacts) on 2026-10-21 put 2.544 s into artifact JSON decoding and 1.612 s into the artifact index lookup. The time comes from the moved-artifact cleanup, which re-reads and decodes the complete artifact index for every folder it visits. It is mostly post-serving work, so it does not delay the first reply, but it burns CPU after every hub start. Reported in topic-788 (T-1039).

## What to build

The cleanup takes one snapshot of the artifact index per pass, or queries moved artifacts through an indexed lookup, instead of decoding the whole index for each folder. Durable deletion receipts and the cleanup's existing behaviour stay unchanged.

## Acceptance criteria

- [x] C1. On a generated store of 8,000 artifacts in 200 folders, one cleanup pass decodes the artifact index at most once (a test counts decodes).
  - done: impl-1043 · 2026-10-24T20:55:34.801Z
  - verified: rev-26 [reviewer] · run rev-20261024-1043-final-1 · 2026-10-24T21:10:14.912Z · commit 052879c8ea477bc48a2ab1f8bab614d35fe5b4dc
- [x] C2. The existing moved-artifact cleanup tests pass unchanged, including durable deletion receipts.
  - done: impl-1043 · 2026-10-24T20:55:34.897Z
  - verified: rev-26 [reviewer] · run rev-20261024-1043-final-1 · 2026-10-24T21:10:14.912Z · commit 052879c8ea477bc48a2ab1f8bab614d35fe5b4dc

## Comments

### impl-1043 · 2026-10-24T20:51:52.235Z

Implementation seam: ArtifactLifecycle.cleanup over a disposable SQLite Store, counting JSON decodes for the generated 8,000-artifact/200-folder index. Existing artifact-lifecycle.test.ts retains deletion receipt coverage unchanged. No shared wire/schema/refusal/credential/admission contract changes are planned: this is pass-local lookup reuse.

### impl-1043 · 2026-10-24T20:54:00.939Z

Consumer inventory before additive internal Store helpers: artifactIndex is private and used only by Store.artifacts and Store.movedArtifacts; movedArtifacts consumers are ArtifactLifecycle.#deleting, #delete, #finishDeletion and #cleanup (repo-wide search includes docs, shipped skills, QA, fixtures and all test tiers; no other consumers). Existing artifacts_destination expression index supports a live pending-child query. Public artifact/list shapes and existing method results remain unchanged, so client previous-wire regression is unaffected. Cleanup will enumerate one full snapshot, retaining point reads across I/O; deletion housekeeping can query only the owning folder.

### rev-26 · 2026-10-24T20:57:14.002Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1043-source-1
commit: 052879c8ea477bc48a2ab1f8bab614d35fe5b4dc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11423 full Standards/Spec source clear. Onepass snapshot enumeration plus currentrecord/manualdelete/owner guards retain postIO behavior. New destination-index existence/scoped-child reads match existing index; no publicwire/schema/permission change. Pinned consumer search matches inventory; noarg movedArtifacts contract retained. T1realSQLite/fakelstat8000artifacts/200folders counts taggedactualJSONdecodes, earlyfails8001/positiveexact8000, no wallgate; lifecycle36tests unchangedincl durabledeletion/inoderecovery. Manifest/guide/hubREADME updated. C1/C2runtime unverified; A11412 localmacOSsummary not configuredproof. Preserve original returned outputs/exits/timings/source limits without transcription rerun. One unchanged-head mode-freeverify then final evidence naming generated guard/lifecyclecases. No itemQA/landingclaim.

### rev-26 · 2026-10-24T21:10:14.912Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1043-final-1
commit: 052879c8ea477bc48a2ab1f8bab614d35fe5b4dc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11451 audits A-11446 exact-head mode-free f206b14e: 3064 ordinary test/433 file passes, separately five load-gate repetitions. C1 named 8000-artifact/200-folder guard passes base plus 5/5, final exactly8000 full-index row decodes and redirect/owner assertions. Base0.868434138 s exceeds report-only0.5 s budget; not an enforced timing pass, no allowance. C2 lifecycle unchanged from fixed base and all36 outcomes pass (32 top-level+4 nested), including interrupted moved deletion, durable folder retention rollback/reopen and original/recreated file/folder paths. T0 host check tree b0ad4dcb reused/not remote repeated; all T1/fallback hub+Neovim T2/Web green, T3/T4/integration/QA excluded. Report-only warnings and raw local limits retained. A-11423 source clear carried; C1/C2 verified. Coordinator owns enqueue/merge after lead's fresh conflict check.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T21:44:13.265Z

Merged c641a621f268808dcb1ad6d80a50ffc4a28c080e onto dev.
