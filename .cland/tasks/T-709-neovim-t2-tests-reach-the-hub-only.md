---
id: T-709
kind: task
title: Neovim T2 tests reach the hub only through recorded protocol frames, so hub edits stop selecting them
state: open
status: review
size: M
criterion_seq: 4
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-698
  - T-699
  - T-707
  - T-688
  - T-690
topic: topic-475
branch: t/T-709-neovim-t2-tests-reach-the-hub-only
created: 2026-10-16T19:59:37.953Z
updated: 2026-10-18T08:37:05.823Z
---

## Summary

Hub edits force Neovim tests because they import hub code (memo §3.6; report-strategy §1.3: `nvim test import` decided 66 task runs). `nvim/test/stub-hub.ts` imports the hub's tracker prefixes, kinds and criteria, visibility, visibility preferences and config, and `needs-you.test.ts` the `Store`. The type-only imports stop counting with T-688. Decision 6: Neovim tests go over the protocol before v0.2, after the adapter and executor class moves.

## What to build

- **Recorded frames.** The stub hub stops importing hub runtime modules. It serves frames from recorded fixtures: JSON files of protocol frames (item views, criteria summaries, visibility counts, config) that a T3 recorder test in the Neovim attach scenario (T-707 #9) produces from a real hub.
- **Drift fails loudly.** The recorder test fails when the live hub's frames differ from the committed fixtures, and `npm run test:nvim-fixtures` rewrites them, so a hub change that alters a frame shows up in T3, not as a silent stub mismatch.
- **Helpers from Neovim's side.** T2 Neovim files import Neovim-side helpers for temp projects and waits, not `hub/test/harness.ts`. T3 Neovim files that start a real hub may keep the harness.

## Acceptance criteria

- [x] C1. No T2 Neovim file or helper it imports reaches a `hub/src` runtime module, proved by `nvimHubImports` over the T2 files returning an empty list.
  - verified: rev-30 [reviewer] · run rev-20261018-709-carrier-correction · 2026-10-18T06:17:16.015Z · commit 7d8025aef34e8b43b44ecf721b404a7ebbe3ad63
  - done: impl-709 · 2026-10-18T06:17:40.183Z
  - verified: rev-30 [reviewer] · run rev-20261018-709-integration-delta · 2026-10-18T06:50:11.284Z · commit 72570ce02e551afdad7af00cbbdb4cb9a6fa3316
  - verified: rev-30 [reviewer] · run rev-20261018-709-gated-lint-delta · 2026-10-18T07:26:15.365Z · commit 5629976a93d667c352ee1c3e85d486322aa933b3
  - verified: rev-30 [reviewer] · run rev-20261018-709-timestamp-correction · 2026-10-18T08:37:05.822Z · commit 5a9c087938682350ff3ba30b6b856f6c47b1c859
- [x] C2. The recorder test fails on a planted frame change in the hub and passes after the fixture rewrite, proved by a test.
  - verified: rev-30 [reviewer] · run rev-20261018-709-carrier-correction · 2026-10-18T06:17:16.015Z · commit 7d8025aef34e8b43b44ecf721b404a7ebbe3ad63
  - done: impl-709 · 2026-10-18T06:17:40.811Z
  - verified: rev-30 [reviewer] · run rev-20261018-709-integration-delta · 2026-10-18T06:50:11.285Z · commit 72570ce02e551afdad7af00cbbdb4cb9a6fa3316
  - verified: rev-30 [reviewer] · run rev-20261018-709-gated-lint-delta · 2026-10-18T07:26:15.365Z · commit 5629976a93d667c352ee1c3e85d486322aa933b3
  - verified: rev-30 [reviewer] · run rev-20261018-709-timestamp-correction · 2026-10-18T08:37:05.822Z · commit 5a9c087938682350ff3ba30b6b856f6c47b1c859
- [x] C3. The selection replay over the last 40 landings shows `nvim test import` deciding no T2 Neovim selection, recorded on this item.
  - verified: rev-30 [reviewer] · run rev-20261018-709-carrier-correction · 2026-10-18T06:17:16.015Z · commit 7d8025aef34e8b43b44ecf721b404a7ebbe3ad63
  - done: impl-709 · 2026-10-18T06:17:41.523Z
  - verified: rev-30 [reviewer] · run rev-20261018-709-integration-delta · 2026-10-18T06:50:11.285Z · commit 72570ce02e551afdad7af00cbbdb4cb9a6fa3316
  - verified: rev-30 [reviewer] · run rev-20261018-709-gated-lint-delta · 2026-10-18T07:26:15.365Z · commit 5629976a93d667c352ee1c3e85d486322aa933b3
  - verified: rev-30 [reviewer] · run rev-20261018-709-timestamp-correction · 2026-10-18T08:37:05.822Z · commit 5a9c087938682350ff3ba30b6b856f6c47b1c859
- [ ] C4. An audit shows every Neovim T2 test's assertions unchanged in meaning, and each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - failed: rev-30 [reviewer] · 2026-10-18T07:56:12.498Z · note A-5083 exact-head full run exits1 with owned full-inbox test cancelled at120s; diagnose/correct and obtain reviewed-head passing evidence.

## Blocked by

T-688 (type-only imports and Neovim narrowing), T-690 (Neovim T2 tags).

## Comments

### impl-709 · 2026-10-18T05:00:49.485Z

Implementation removes T2 runtime imports through Neovim-owned client/fixture helpers and a synchronous committed-frame replay catalog. Boundary guard currently returns [] over all 11 manifest T2 files plus stub-hub. A 40-landing replay reports zero import-decided T2 selections. Fixture refresh also exercises existing T3 stub consumers for T-774 reuse; full assertion audit and 5/5 whole-file Mac evidence are in progress. No per-item duration allowances added.

### impl-709 · 2026-10-18T05:07:40.160Z

C3 evidence: A-4969 (durable replay artifact) and docs/evidence/T-709-selection-replay.md replay exactly the last 40 task landings at origin/dev af981f17 using the current importer graph. All 11 T2 files have an empty hub import closure; nvim test import decides 0 T2 selections. Shared-contract/infrastructure and mixed-path fallbacks remain intact. C2 actual production-source plant/rewrite/restore proof is A-4968.

### rev-30 · 2026-10-18T05:41:43.793Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-709-source
commit: 39e81384ccf0bcb63ee285b8125da97a45eddd85
scope: full
findings: [{"severity":"medium","text":"T2 stub-client/fixture imports no longer install cover-quiet admission; tempProject allocates and createClient spawns without a check. Restore admission before fixture resources while keeping the Neovim-only import boundary.","file":"nvim/test/client.ts","line":114}]
finding_counts: {"high":0,"medium":1,"low":0}

A-4996: Standards medium M1 at nvim/test/client.ts:114 (also fixture.ts:34): the T2-only helper path drops the hub harness's cover-quiet admission hook and allocates/spawns before any read-only admission check. Preserve actual-entry protection while retaining the empty hub runtime import closure; add direct refused-before-allocation/spawn proof and coordinate T-747. Spec inspections otherwise positive: 11 T2 import boundaries, producer/live recorder and actual prefix mutation/rewrite/restore, exact 40-landing replay window, and all 256 assertion sites/non-import statements preserved. Parsed 90 whole-file logs/1,095 passes with no failures/cancellations/skips; these do not cover the missing admission path. C4 failed; C1–C3 remain unverified until a clear verdict. New source head requires review before verification.

Criteria: C4 failed (The new T2 helper path loses existing cover-quiet refusal before directory allocation and Neovim spawn; preserve actual-entry admission and add a direct control before verification.).

### impl-709 · 2026-10-18T06:10:30.035Z

Source-review correction pushed at 7dccacff8b0fda2036f2f30114f1d13db8c0f5f6. One Coordinator-authorized dev merge after T-747 landed: 2ebc5bbe. Neutral admission policy/transport/discovery/clock primitives preserve production compatibility exports and typed timeout identity; actual Neovim tempProject/createClient guard before resources through fresh caller-owned promises. T-747 actual-entry controls retained; two direct T2 entry controls added. Updated last40 replay remains zero T2 import-decided selections. T0 pass; 27 whole files×5 serial=135 runs,1300 passes,0 fail/skip,peak1m4.555<15. Durable complete proof A-5009 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5009-t-709-admission-correction-27-files-5-5-and-extraction-audit (README.md). Earlier mutation/QA proof A-4995 retained. Source re-review requested; droplet held until clear.

### rev-30 · 2026-10-18T06:13:00.293Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-709-admission-correction
commit: 7dccacff8b0fda2036f2f30114f1d13db8c0f5f6
scope: full
findings: [{"severity":"medium","text":"New neutral-root imports are omitted from copied/archive source sets: suite-coverage's package, typecheck.test.ts:19 root/worktree copy+commit, and selection-replay.ts:37 selector archive. Include the dependencies and preserve old-ref replay support.","file":"hub/test/suite-coverage.test.ts","line":45}]
finding_counts: {"high":0,"medium":1,"low":0}

A-5010: prior admission M1 resolved; actual Neovim entries guard before resources, preserving T-747 caller-owned Promise/timeout identity. One remaining medium M2: new shared/test-support roots are absent from copied-source carriers: suite-coverage.test.ts:45, typecheck.test.ts:19 (copy plus Git seed), selection-replay.ts:37 (archived selector). Their production imports now leave the copied/archive tree; include required roots and retain historical-ref support, then refresh affected evidence and request source review. Independently confirmed mechanical extraction behavior/identities and 135 whole-file logs/1,300 passes; these omit those carriers. Recorder/QA/frame implementation and 256 assertions remain unchanged, source boundary/replay inspection positive. C4 failed; no verification submission until corrected source clear.

Criteria: C4 failed (Neutral extraction introduces shared/test-support imports missing from coverage, root/worktree typecheck and archived-selector source carriers; repair those sets and refresh evidence before task verification.).

### impl-709 · 2026-10-18T06:14:53.172Z

A-5010 source-carrier M2 corrected and pushed at 7d8025aef34e8b43b44ecf721b404a7ebbe3ad63. Both neutral roots copied in suite-coverage; typecheck copies and Git-seeds the same complete project list; selection-replay archives only neutral roots present in selectorRef, preserving old refs. Source-copy audit includes complete-tree carriers and standalone downloader fixture. Existing assertions unchanged. Additional2whole files×5=10runs,15passes,0fail/skip; modern and historical archived selector invocations each5/5; peak1m4.367<15; fresh typecheck/tiers/lint pass. Complete durable A-5011: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5011-t-709-source-carriers-coverage-typecheck-5-5-modern-old-selector-5-5. A-5009 runtime/admission proof unchanged. No further dev merge. Requesting source re-review before droplet.

### rev-30 · 2026-10-18T06:17:16.015Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-709-carrier-correction
commit: 7d8025aef34e8b43b44ecf721b404a7ebbe3ad63
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; M1/M2 closed. A-5012 records Standards/Spec review. Coverage and root/worktree typecheck carriers now include both neutral roots, while selector archives conditionally include roots present at each selected ref. Assertions unchanged. A-5011 raw logs independently confirm both affected files whole-file 5/5 (15 aggregate passes, zero failures/cancellations/skips) and modern/historical selector loading 5/5 each. C1/C2/C3 verified from cumulative source, recorder mutation/rewrite proof and last-40 replay; C4 remains unverified pending the exact-head droplet receipt. No reviewer test execution.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-709 · 2026-10-18T06:18:03.502Z

Source clear rev-20261018-709-carrier-correction / A-5012 at7d8025aef34e8b43b44ecf721b404a7ebbe3ad63; C1–C3 claimant done marks restored with corresponding evidence. Read verify queue (local none, remote2/6) and submitted mode-free droplet1e629b10-ad08-4c50-8f61-050db567eea4 at this exact unchanged clean head, reporttopic-475 to Reviewer,self,Coordinator. C4 awaits its required droplet receipt before claimant done. Idle awaiting hub result.

### impl-709 · 2026-10-18T06:49:12.559Z

Prior exact-head full droplet1e629b10 is green at7d8025ae (A-5045,2530pass/2538,8skip,0fail,Linux x64,lifetime1544s,cost$0.1072). Coordinator fe50a48b authorized one dev merge for T-708/T-767 conflicts. Merged at5cfc492a; pushed clean72570ce02e551afdad7af00cbbdb4cb9a6fa3316 with evidence docs. Tiers keeps both entries; T-767 minimal compiler fixture copies/Git-seeds neutral roots and tiny sources bind real admission API. T0pass; typecheck+five Neovim boundary whole files each5/5,235pass,0fail/skip,peak1m3.283. Compiler1.410–1.440s. Refreshed exact40 replay at5f8d274a:11T2,hubclosure[],0import-decidedT2. Durable A-5046 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5046-t-709-t-708-t-767-integration-compiler-and-neovim-boundary-5-5. Requesting delta source review, then required fresh mode-free droplet. T-684 not in dev parent, no shrink capability yet; subscribed to landing.

### rev-30 · 2026-10-18T06:50:11.285Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-709-integration-delta
commit: 72570ce02e551afdad7af00cbbdb4cb9a6fa3316
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear, A-5047. Authorized dev integration preserves all dev tier entries plus boundary T1; compiler conflict retains T-767 minimal real configs/launcher and imports actual neutral admission API from both tiny sources, copying/Git-seeding neutral roots for linked-worktree checks. Compiler assertions unchanged. Admission/Neovim/recording/selector code unchanged from prior source clear. A-5046 raw 30 whole-file runs: 235 passes, zero failures/cancellations/skips. Exact updated 40-landing Git window matches replay. C1/C2/C3 verified; C4 awaits fresh exact-head droplet per Coordinator fe50a48b. A-5045 green is prior-head history only.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-709 · 2026-10-18T06:50:38.279Z

Delta source clear rev-20261018-709-integration-delta / A-5047 at72570ce02e551afdad7af00cbbdb4cb9a6fa3316. Queue read localnone/remote4of6; fresh mode-free droplet322abcc1-48fb-4c5f-a4d0-aa63f56dfb27 submitted at unchanged clean exact reviewed head, reporttopic-475 to Reviewer,self,Coordinator. C4 remains pending its current-head receipt; idle awaiting hub result.

### impl-709 · 2026-10-18T07:25:31.487Z

Coordinator-authorized T-684 integration completed/pushed clean5629976a93d667c352ee1c3e85d486322aa933b3. Merge723daf59 at devb27f71f4 keeps until.ts+neutral roots in real-source coverage fixture and both lint/fixture scripts. Fetched origin then lint gate passed; --shrink passed and baseline5e6e612e adds only an empty boundaryT1 record, existing debt524→524/no per-category increase. Typecheck/tiers pass. Seven whole coverage/compiler/Neovim boundary files×5=35accepted,245passes,0fail/skip,peak1m7.949<15. Exact40 replay refreshed atb27f71f4:11T2,closure[],0import-decidedT2. Complete A-5068: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5068-t-709-t-684-integration-lint-gate-shrink-and-7-files-5-5. Prior-head full dropletA-5059 green2530/2538,8expectedplatform/binaryskips,0T2Neovimskips. Delta review requested; required fresh droplet held until clear.

### rev-30 · 2026-10-18T07:26:15.365Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-709-gated-lint-delta
commit: 5629976a93d667c352ee1c3e85d486322aa933b3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear, A-5069. Authorized T-684 integration keeps neutral roots plus until.ts coverage dependency, gated lint/static scripts and recorder rewrite command. Admission/Neovim/assertion/selector code unchanged. Baseline adds only empty boundary entry (363→364 paths, debt 524→524), no increases; gate/shrink logs have no refusal. A-5068 raw 35 whole-file runs/245 passes, no failure/cancellation/skip; exact updated 40-landing window independently matches Git. C1/C2/C3 current; C4 remains pending fresh exact-head droplet. A-5059 green remains prior-head history only.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-709 · 2026-10-18T07:26:38.568Z

Delta source clear rev-20261018-709-gated-lint-delta/A-5069 at5629976a93d667c352ee1c3e85d486322aa933b3. Read queue localnone/remote5of6; submitted mode-free droplet93b40025-d509-40d2-a2b4-29a3bdef5807 at unchanged clean exact reviewed head, reporttopic-475 to Reviewer,self,Coordinator. C4 waits green current-head receipt; idle awaiting hub result.

### rev-30 · 2026-10-18T07:56:12.498Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-709-runtime
commit: 5629976a93d667c352ee1c3e85d486322aa933b3
scope: evidence
findings: [{"severity":"medium","text":"R1: owned full-inbox case cancelled after the 120000ms test deadline (120.03091977s); exact-head full run exits1, so C4 has no passing current receipt. Failure excerpt does not establish the stalled operation/root cause.","file":"nvim/test/inbox-sections.test.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear, A-5084. A-5083/run93b40025: 2536 passes, zero assertion failures, one cancellation, eight prerequisite skips. Panel variant and subsequent local-clock case pass; no root-cause claim from excerpt. C1–C3 source marks remain as recorded; no additional verification on this not-clear pass. Coordinator diagnosis direction reported in bd35c4cd; changed head requires new source review. Prior-head green is historical only.

Criteria: C4 failed (A-5083 exact-head full run exits1 with owned full-inbox test cancelled at120s; diagnose/correct and obtain reviewed-head passing evidence.).

### impl-709 · 2026-10-18T08:35:16.876Z

Owned runtime cancellation corrected at 5a9c087938682350ff3ba30b6b856f6c47b1c859 (pushed). Confirmed cause: equality-based timestamp tokens make the inbox replay key depend on clock coincidences; an uncaught projection error closes the peer and the control caller ignores close. Coordinator-approved correction binds timestamp occurrences and rejects named incomplete/refused control exchanges, with a surviving peer error response. A-5093 contains red-first canonical/socket/actual-client controls, ordinary coincident/distinct clock replay 5/5 each, 4464-frame refresh (321 passes), and 96 serial whole-file invocations / 804 passes / zero fail-cancel-skip / peak load 6.941<15. All original 256 assertions retained; 12 T2 import closures empty; exact40 at a08e40ec gives zero import-decided T2 selections. Actual production-prefix mutation/rewrite/restoration remains red-capable. Typecheck/tiers/gated lint/shrink pass; final origin fetch + gated lint pass without dev merge. Baseline debt524 unchanged with only an empty new T2 entry. Delta review requested next; no verify until source clear and Coordinator lifts restart hold.

### rev-30 · 2026-10-18T08:37:05.823Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-709-timestamp-correction
commit: 5a9c087938682350ff3ba30b6b856f6c47b1c859
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source correction clear, A-5094. Occurrence-bound timestamps remove equality-dependent keys while preserving wire restoration/UUID identity. Control client rejects close/refusal with named request; stub reports projection failure and remains usable. Red-first canonical/socket/actual-client controls reviewed. A-5093 raw96 whole-file runs/804 passes, no failure/cancel/skip;4464 corpus keys independently recomputed,24807 nodes decoded; actual production-prefix drift red/rewrite/restoration green. Original assertions retained, empty T2 baseline entry only, exact40 landing window matches. C1/C2/C3 verified; C4 awaits corrected-head droplet after restart hold lifts. A-5083 cancellation retained; no reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.
