---
id: T-916
kind: task
title: "release.test.ts fails entirely inside a local integrated run: it reaches the live hub and its own cover-quiet refuses it (T-886)"
state: closed
status: done
size: S
criterion_seq: 3
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
updated: 2026-10-19T22:53:37.756Z
closed: 2026-10-19T22:53:37.756Z
---

## Summary

In stage cover #1's macOS run 781169bb at b62bf16c (local integrated, from the root; A-6767, from line ~72279), all 22 tests of `hub/test/release.test.ts` failed in about 0.1 ms each with "cover-quiet: integrated run 781169bb… holds the local test slot … (only the human may set CLAND_TEST_IGNORE_COVER=1)", raised by shared/socket-client.ts. Code inside the integrated run reached the LIVE project hub's slot check without the run's own lease and was refused by its own cover. T-886 (93be29ea) added `releaseCover(root)` calls and the import of `hub/test/release-support.ts` to the file. The Linux droplet run, with no live hub, passed it. Until this is fixed, every local macOS stage, epic or release run fails.

## What to build

Find which call in release.test.ts or release-support.ts (or the CLI they drive in a scratch machine) resolves the live project hub instead of the fixture's scratch hub, or asks for the slot without the inherited lease. Fix it so that:
- tests running inside an integrated local run never contact the live hub, by keeping the fixture's hub resolution inside its scratch root;
- or, where a slot check is legitimate, it passes the run's lease.
Keep the cover-quiet guard as strict as it is.

## Acceptance criteria

- [x] C1. The cause is named in the report, with the exact call path.
  - verified: rev-31 [reviewer] · run rev-20261019-916-source · 2026-10-19T22:47:03.420Z · commit f0b0e1b777f807122399da038cae77fc7d5029b9
  - done: impl-916 · 2026-10-19T22:50:25.844Z
  - verified: rev-31 [reviewer] · run rev-20261019-916-final · 2026-10-19T22:50:36.938Z · commit f0b0e1b777f807122399da038cae77fc7d5029b9
- [x] C2. A regression test (T2 if possible) shows that release-support's cover helper and the release CLI under the fixture never reach a hub outside the scratch root, even while a fake live hub holds an integrated cover.
  - done: impl-916 · 2026-10-19T22:50:26.437Z
  - verified: rev-31 [reviewer] · run rev-20261019-916-final · 2026-10-19T22:50:36.939Z · commit f0b0e1b777f807122399da038cae77fc7d5029b9
- [x] C3. `hub/test/release.test.ts` passes in a local run on macOS while another local integrated run holds the slot, simulated by a fixture, with the receipt in the report.
  - done: impl-916 · 2026-10-19T22:50:26.938Z
  - verified: rev-31 [reviewer] · run rev-20261019-916-final · 2026-10-19T22:50:36.939Z · commit f0b0e1b777f807122399da038cae77fc7d5029b9

## Comments

### impl-916 · 2026-10-19T22:44:29.054Z

Exact cause: release.test.ts scratchHub swaps process.env to scratchMachine.env before first projectHub→isolateVerification→ensureAccountFixture→initialize→assertTestAdmission. Scratch env lacks CLAND_SUITE_LEASE; admission still defaults cwd to the outer project, so hubDiscovery resolves its hub and suite.slot/check is refused by that integrated cover. The rejected cached initialization makes subsequent tests fail immediately. Added worker startup regression against fake cover-run; observed red cover-quiet at 2.299s, green at 3.827s after calling ensureAccountFixture before the env swap. Existing guard stays strict. Full cover-quiet file 15/15 in 14.254s; typecheck and lint exit 0. Full macOS release-file fixture receipt pending.

### impl-916 · 2026-10-19T22:45:41.622Z

Ready for source review at pushed f0b0e1b777f807122399da038cae77fc7d5029b9. Diagnosis and validation: A-6774 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6774-t-916-diagnosis-and-validation-report.md). C3 macOS darwin arm64 full release.test.ts passed 22/22 in 75.675 s under fake integrated cover, with strict unleased refusal asserted before and after: A-6772 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6772-t-916-macos-release-file-22-22-under-fake-integrated-cover.log). Harness A-6771. Reviewer role resolved to rev-31. qaPolicy scope none, no QA criteria. Waiting for source verdict before mode-free verification.

### rev-31 · 2026-10-19T22:47:03.420Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-916-source
commit: f0b0e1b777f807122399da038cae77fc7d5029b9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6777: Standards/Spec clear. Exact C1 path confirmed: scratchHub clears inherited CLAND_* before projectHub→isolateVerification→ensureAccountFixture→initialize→assertTestAdmission→outer discovery/suite.slot; missing lease causes cover-quiet and cached rejected initialization. Admission now precedes scratch env swap; production strictness unchanged. New native T3 fresh-worker regression executes actual first release scenario, cover helper and preview/publication CLI; T2 cache would miss the boundary. All 22 release assertions/declarations unchanged, no allowance/tier edits. A-6771 harness plus A-6772 confirms macOS darwin arm64 22/22 under fixture integrated cover, strict unleased refusal before/after. C1 verified. C2/C3 await fresh same-head configured mode-free gate plus retained native receipts. Please publish existing raw full cover-quiet stdout for final regression evidence, without rerunning. Both changed files are T3; no task-gate native execution or full task-head run requested.

Criteria: C1 verified.

### rev-31 · 2026-10-19T22:50:36.939Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-916-final
commit: f0b0e1b777f807122399da038cae77fc7d5029b9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6783 independently audits same-head configured mode-free 9edec36c/A-6782: 558/558 ordinary, zero non-pass/tier/load/budget diagnostics, exit0. Both changed T3 files are excluded, so native proof is explicitly separate: A-6778 retained full cover-quiet 15/15, new fresh-child scratchHub→releaseCover→release CLI case 4.409020s; A-6771/A-6772 macOS fake-cover harness and full release file 22/22 in 75.674749750s, strict unleased refusal before/after. C1 exact cached-admission/stripped-lease path verified in A-6777/A-6774; code fix unchanged and all release assertions retained, no allowance edits. Claimant C1–C3 done confirmed; all final verified. Linux native T3 remains periodic/integrated landing/stage evidence; no task-gate native execution claimed. Droplet Linux x64 c-8 lon1 119s/$0.0083.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-19T22:53:37.756Z

Merged ed948fa973b4c7296a14743c0764860375c6779c onto dev.
