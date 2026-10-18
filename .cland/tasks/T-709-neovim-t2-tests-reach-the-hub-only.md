---
id: T-709
kind: task
title: Neovim T2 tests reach the hub only through recorded protocol frames, so hub edits stop selecting them
state: closed
status: done
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
updated: 2026-10-18T12:29:38.845Z
closed: 2026-10-18T12:29:38.845Z
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
  - verified: rev-30 [reviewer] · run rev-20261018-709-transport-delta · 2026-10-18T09:34:07.432Z · commit 5f552d2c5731a2a6ff5dcdf19020f01143d30847
  - verified: rev-30 [reviewer] · run rev-20261018-709-admission-sharding-delta · 2026-10-18T11:47:05.464Z · commit 1abdc29aafb2fc1861445419dc3ed0064c918e95
- [x] C2. The recorder test fails on a planted frame change in the hub and passes after the fixture rewrite, proved by a test.
  - verified: rev-30 [reviewer] · run rev-20261018-709-carrier-correction · 2026-10-18T06:17:16.015Z · commit 7d8025aef34e8b43b44ecf721b404a7ebbe3ad63
  - done: impl-709 · 2026-10-18T06:17:40.811Z
  - verified: rev-30 [reviewer] · run rev-20261018-709-integration-delta · 2026-10-18T06:50:11.285Z · commit 72570ce02e551afdad7af00cbbdb4cb9a6fa3316
  - verified: rev-30 [reviewer] · run rev-20261018-709-gated-lint-delta · 2026-10-18T07:26:15.365Z · commit 5629976a93d667c352ee1c3e85d486322aa933b3
  - verified: rev-30 [reviewer] · run rev-20261018-709-timestamp-correction · 2026-10-18T08:37:05.822Z · commit 5a9c087938682350ff3ba30b6b856f6c47b1c859
  - verified: rev-30 [reviewer] · run rev-20261018-709-transport-delta · 2026-10-18T09:34:07.432Z · commit 5f552d2c5731a2a6ff5dcdf19020f01143d30847
  - verified: rev-30 [reviewer] · run rev-20261018-709-admission-sharding-delta · 2026-10-18T11:47:05.464Z · commit 1abdc29aafb2fc1861445419dc3ed0064c918e95
- [x] C3. The selection replay over the last 40 landings shows `nvim test import` deciding no T2 Neovim selection, recorded on this item.
  - verified: rev-30 [reviewer] · run rev-20261018-709-carrier-correction · 2026-10-18T06:17:16.015Z · commit 7d8025aef34e8b43b44ecf721b404a7ebbe3ad63
  - done: impl-709 · 2026-10-18T06:17:41.523Z
  - verified: rev-30 [reviewer] · run rev-20261018-709-integration-delta · 2026-10-18T06:50:11.285Z · commit 72570ce02e551afdad7af00cbbdb4cb9a6fa3316
  - verified: rev-30 [reviewer] · run rev-20261018-709-gated-lint-delta · 2026-10-18T07:26:15.365Z · commit 5629976a93d667c352ee1c3e85d486322aa933b3
  - verified: rev-30 [reviewer] · run rev-20261018-709-timestamp-correction · 2026-10-18T08:37:05.822Z · commit 5a9c087938682350ff3ba30b6b856f6c47b1c859
  - verified: rev-30 [reviewer] · run rev-20261018-709-transport-delta · 2026-10-18T09:34:07.432Z · commit 5f552d2c5731a2a6ff5dcdf19020f01143d30847
  - verified: rev-30 [reviewer] · run rev-20261018-709-admission-sharding-delta · 2026-10-18T11:47:05.464Z · commit 1abdc29aafb2fc1861445419dc3ed0064c918e95
- [x] C4. An audit shows every Neovim T2 test's assertions unchanged in meaning, and each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - verified: rev-30 [reviewer] · run rev-20261018-709-final · 2026-10-18T11:31:27.645Z · commit 5f552d2c5731a2a6ff5dcdf19020f01143d30847
  - done: impl-709 · 2026-10-18T12:17:54.116Z
  - verified: rev-30 [reviewer] · run rev-20261018-709-integration-final · 2026-10-18T12:18:24.052Z · commit 1abdc29aafb2fc1861445419dc3ed0064c918e95

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

### impl-709 · 2026-10-18T09:33:20.691Z

Accepted full droplet b633487b/A-5120 at5a9c0879:2543/2551pass,8prerequisite skips,0fail/cancel; all12T2Neovimfiles/58cases pass, full-inbox0.636s. C4 claimant done restored from A-5120+A-5093/cumulative Mac proof. Coordinator cfbe0843 authorized one origin/dev merge for the T-770 socket-client conflict; merge5f552d2c5731a2a6ff5dcdf19020f01143d30847 incorporates dev23244cfa and is pushed clean. Mechanical resolution retains exact incoming HubTimeout/request-write completion semantics in shared transport, existing hub exports, and incoming suite exit75. Four exact comparisons pass. A-5137 contains resolution patch, full search inventories (45 affected API/string tests;353 broad added-line identifier tests), required verify-submission whole file4/4, fetched-origin lint and typecheck. Coordinator bfcba854 replaces batch waiver with fresh droplet after resolution-only delta review; no broad local loop or5/5 stress under load. New delta review requested next; prior green does not clear merged head.

### rev-30 · 2026-10-18T09:34:07.432Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-709-transport-delta
commit: 5f552d2c5731a2a6ff5dcdf19020f01143d30847
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Resolution source clear, A-5139. Independently exact-compared incoming HubTimeout class/askHubFrame (only ClientHello annotation erased), unchanged hub compatibility exports, and byte-identical incoming suite CLI. Shared transport retains requestSent/timeoutMs/write completion and class identity without hub imports. A-5137 raw verify-submission4/4; static gates/search inventories retained under Coordinator bfcba854's narrow-local/fresh-droplet validation decision. C1–C3 current from cumulative proof; C4 awaits fresh exact-head droplet. Prior A-5120 green remains historical, no waived rerun assumed.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-709 · 2026-10-18T09:36:20.520Z

Transport delta source clear rev-20261018-709-transport-delta/A-5139 at5f552d2c5731a2a6ff5dcdf19020f01143d30847. Fresh fetch+gated lint passes (A-5142); tree unchanged/clean. Submitted one mode-free droplet verify via CLI to Reviewer,self,Coordinator. CLI exit75 sent-unconfirmed; after required60s wait, queue+task receipt confirm2119e998-6b74-4d7e-bda8-7bb896bc5a73 launching at exact reviewed head. No retry submitted. C4/current final evidence awaits that result; idle under load rule.

### rev-30 · 2026-10-18T10:52:55.288Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-709-transport-runtime
commit: 5f552d2c5731a2a6ff5dcdf19020f01143d30847
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5222: A-5221 exits124 after4498s; only hub free phase finalizes (51files/229timings), hub machine lacks completion and Neovim has zero timing receipts. This does not satisfy C4 exact-head touched-file passes. Machine startup/load events are not completion evidence; cause unclassified, no speculative source finding. Preserve receipt/head and obtain lead diagnosis/disposition before any retry. Earlier Mac and prior-head green evidence stay disclosed.

Criteria: C4 failed (Exact-head gate timed out with unfinished hub machine phase and no Neovim timings; required touched-file droplet passes are missing.).

### impl-709 · 2026-10-18T11:01:27.665Z

A-5221 fresh5f552d2c droplet exits124 after4498s; only hub free finalizes229/229, machine incomplete and no Neovim timings. A-5222 runtime not-clear/C4failed retained. Per Coordinator9e400b4f, completed bounded Mac differential controls against devb405a7e0 in under9min:16files×2refs=32serial whole-file runs,375passes,0fail/cancel/skip/timeout,hard180s caps never fired,max23.101s,peak1m5.191. Includes verify-submission,cli,suite-runner-contract plus13recorded CLI/transport/admission/lifecycle consumers; full list/rawlogs/comparisons in A-5223. HubTimeout and askHubFrame match current dev (only erased hello type annotation differs). No local head-only hang, no speculative source edit, no retry; head remains clean5f552d2c. Reported negative reproduction result and requested Coordinator disposition. This does not replace required exact-head green evidence.

### impl-709 · 2026-10-18T11:04:05.358Z

Coordinator23e48fc8 authorized exactly one same-head retry after A-5223 found no local head-only hang. Fresh fetch+gated lint passed(A-5224), source unchanged/clean5f552d2c. Submitted once mode-free via CLI to Reviewer,self,Coordinator; on exit75 waited60s then queue+task receipt confirm a621ea5f-ad95-4366-b579-23a10acb7127 launching at exact head. No extra submission. Review status restored for unchanged source awaiting corrected evidence; C4 remains unfulfilled by A-5221. If this run times out again Coordinator directs droplet half-shard bisection, not another blind retry. Idle awaiting result.

### impl-709 · 2026-10-18T11:28:58.637Z

Authorized unchanged-head retry a621ea5f/A-5235 green at5f552d2c: full2557tests/2549passes/8expectedplatform-or-real-OpenCode skips/0fail-cancel. All phases finalize; all12T2Neovimfiles/58cases pass with noT2skip; formerly cancelled full-inbox0.708s. Linux x64 6.8.0-142-generic,Node24.21.0,Neovim0.12.5,c-8lon1,lifetime1466s,cost$0.1018. C4 claimant done restored against accepted receipt and cumulative Mac5/5/unchanged-original256assertions evidence; Reviewer final audit pending. Prior75min incomplete A-5221/A-5222 retained as unexplained hang, negative local differentialA-5223 retained. Source/head unchanged. Coordinator ba9ca17f holds merge until armed hub restart, then acts on ready; T-774 follows only after merge.

### rev-30 · 2026-10-18T11:31:27.645Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-709-final
commit: 5f552d2c5731a2a6ff5dcdf19020f01143d30847
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, A-5236. A-5235 / a621ea5f exits 0 at unchanged reviewed head: 2549 passes, zero failures/cancellations, eight prerequisite skips; all full phases finalize. Independently confirmed all 12 T2 Neovim files / 58 ordinary cases positively pass with no scoped skips/trips, all 40 Neovim files execute, all 19 changed test carriers execute, and 16 scoped load groups pass 80/80 repetitions. Zero tier-mismatch rows and no hard budget failures. Cumulative Mac and source evidence remains applicable as detailed in A-5236; C1–C3 remain current under A-5139. A-5221 timeout / A-5222 not-clear retained without causal reclassification; Coordinator 23e48fc8 authorized this sole unchanged-head retry, and T-799 owns future hang identification. Coordinator ba9ca17f's merge hold until hub restart remains separate and unchanged. No reviewer execution or per-item QA.

Criteria: C4 verified.

### impl-709 · 2026-10-18T11:45:51.562Z

Coordinator e9572c7c authorized one dev merge after gate conflict. Pushed clean1abdc29aafb2fc1861445419dc3ed0064c918e95, incorporating dev54657bf8. Four keep-both resolutions: shared/test-support plus T-788 infrastructure paths; archived selector rootpackage+conditionalneutralroots; coverage rootpackage+neutralroots+until; static version lint+test:nvim-fixtures. npm install passes with no tracked changes. A-5241 retains source patch/provenance and serial requested checks: suite-selection94,coverage2,admission-cost5,recorder6 =>107passes/0fail-cancel-skip,peak1m7.391; modern/historical archived selectors load; separate exact40 at54657 gives12T2,emptyclosure,0import-decidedT2. Fresh fetch+lint, typecheck and tiers pass. No fixture/allowance/quarantine/assertion changes. Prior finalA-5236+greenA-5235 cover old5f only; new delta review then exact-head droplet required. Hub refused non-review status edit; no workaround; next permitted review transition follows ready source.

### rev-30 · 2026-10-18T11:47:05.464Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-709-admission-sharding-delta
commit: 1abdc29aafb2fc1861445419dc3ed0064c918e95
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear, A-5242. Authorized keep-both resolutions retain neutral-root and incoming explicit infrastructure selection, root package plus conditional neutral-root archives, complete coverage dependencies/assertions, version static lint and fixture refresh. Incoming sharding implementation byte-identical to dev; task-owned shared/test-support/Neovim sources unchanged. A-5241 raw logs confirm 107 passes across four serial files with no failures/cancellations/skips; current/historical selector archives load. Exact-40 replay independently matches pinned first-parent landing order, 12 T2 files/empty hub closure/zero import-decided T2 selections. C1–C3 verified from refreshed/cumulative proof; C4 remains pending fresh merged-head droplet. Prior A-5235 green and A-5221 timeout remain historical. Submission hold lifted by Coordinator 0c906928; no reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-709 · 2026-10-18T11:48:17.284Z

Resolution source clear rev-20261018-709-admission-sharding-delta/A-5242 at1abdc29aafb2fc1861445419dc3ed0064c918e95. Fresh fetch+gated lint passes(A-5243), tree unchanged/clean. Read suite queue and submitted one mode-free droplet via CLI: d94b92f3-8560-473e-b8b5-75d91a275b39, accepted exit0/projectposition1, to Reviewer,self,Coordinator in topic475. No timeout/retry. Current C4 awaits new-head full receipt; earlier full greenA-5235/finalA-5236 remain historical. Idle awaiting hub result.

### impl-709 · 2026-10-18T12:17:54.494Z

Current-head full gate d94b92f3/A-5263 is green at1abdc29aafb2fc1861445419dc3ed0064c918e95:2583passes/2591tests,8expectedplatform-or-OpenCode-prerequisite skips,0fail/cancel; all phases finalize. All12T2Neovimfiles/58cases pass/noT2skip,40Neovimfiles execute; full-inbox0.679s. Reported load repetitions285/285 complete (Reviewer scopes owned subset). Linux x64 6.8.0-142-generic,Node24.21.0,Neovim0.12.5,c-8lon1,lifetime1706s,cost$0.1185. C4 claimant done refreshed with A-5241 integration proof+cumulative Mac/assertion audits; prior failed/incomplete receipts remain historical. Head/source unchanged/clean. Final same-head Reviewer evidence verdict pending; keep claim for Coordinator merge.

### rev-30 · 2026-10-18T12:18:24.052Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-709-integration-final
commit: 1abdc29aafb2fc1861445419dc3ed0064c918e95
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final integration evidence clear, A-5267. Exact-head A-5263 exits0/full: 2583 passed,0 failed/cancelled,8 prerequisite skips; every phase finalizes. Independent parsing confirms all 12 T2 Neovim files/58 cases positively pass without scoped skips, all 40 Neovim files execute, five affected hub carriers pass, and 16 scoped load groups pass 80/80. Zero tier trips and no hard budgets. C4 verified with current receipt and unchanged cumulative Mac/assertion evidence; C1–C3 remain current under A-5242. Earlier A-5221 timeout/A-5222 not-clear remain disclosed without reclassification. No reviewer execution or per-item QA.

Criteria: C4 verified.

### coord · 2026-10-18T12:29:38.845Z

Merged 2da1ef1227e1678625e8d6df92842a8722f97f46 onto dev.
