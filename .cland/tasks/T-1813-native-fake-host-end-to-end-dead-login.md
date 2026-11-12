---
id: T-1813
kind: task
title: Native fake-host end-to-end dead-login cases for Codex and Claude Code
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1485
branch: t/T-1813-native-fake-host-end-to-end-dead-login
created: 2026-11-11T13:10:03.001Z
updated: 2026-11-12T10:54:23.158Z
closed: 2026-11-12T10:54:23.158Z
---

## Summary

T-1789's native end-to-end proof (signal → login signed-out with its host → next launch skips that host → the session keeps running) is green for OpenCode on a fake host. The same native cases for Codex and Claude Code did not reach the signal within T-1789's time-box: at its head 691f5d2dd, Codex's `session.launch` reply times out after 15 s although its spoke hello and role clause succeed, and Claude's dead-login receipt times out after 15 s (impl-1789's receipts A-18714, A-18716, topic-1474). Each harness's signal classification is covered at T2 with the in-process fakes, and the post-classification path is harness-agnostic, so this item adds the remaining native coverage, not new behaviour.

## What to build

Make the fake Codex and fake Claude native launches on a fake host complete the way the existing native fake-harness files do (host-create-ready and host-relaunch launch them), then add one native end-to-end dead-login case for each, beside T-1789's OpenCode case.

## Acceptance criteria

- [x] C1. A native Codex session on a fake host that emits a dead-login signal marks its login signed-out with that host, the next Codex launch in the pool skips the host, and the first session keeps running (test).
  - done: impl-1813 · 2026-11-12T09:33:02.828Z
  - verified: rev-35 [reviewer] · run rev-35-1813-final-1 · 2026-11-12T10:12:38.945Z · commit 1ac12020421923db7da95ceb05c401a881d786ad
- [x] C2. The same holds for a native Claude Code session on a fake host (test).
  - done: impl-1813 · 2026-11-12T09:33:03.047Z
  - verified: rev-35 [reviewer] · run rev-35-1813-final-1 · 2026-11-12T10:12:38.945Z · commit 1ac12020421923db7da95ceb05c401a881d786ad
- [x] C3. Both cases pass five lone repetitions on macOS, and their duration allowances come from green samples (test).
  - verified: rev-35 [reviewer] · run rev-35-1813-source-2 · 2026-11-12T09:48:17.504Z · commit 1ac12020421923db7da95ceb05c401a881d786ad
  - verified: rev-35 [reviewer] · run rev-35-1813-final-1 · 2026-11-12T10:12:38.945Z · commit 1ac12020421923db7da95ceb05c401a881d786ad
  - done: impl-1813 · 2026-11-12T10:12:48.384Z
- [x] C4. The shared login-signed-out-native fixture passes CLAND_FAKE_HOST_ROOT through fixtureEnvironment's overlays, so loginFilePath resolves the mounted volume path, and a case reads the renewed login file through it (test).
  - done: impl-1813 · 2026-11-12T09:33:03.596Z
  - verified: rev-35 [reviewer] · run rev-35-1813-final-1 · 2026-11-12T10:12:38.945Z · commit 1ac12020421923db7da95ceb05c401a881d786ad
- [x] C5. A native Codex and a native Claude Code session on a fake host keep running through an in-place sign-in of their login, and their next turn uses the renewed login (test).
  - done: impl-1813 · 2026-11-12T09:33:03.824Z
  - verified: rev-35 [reviewer] · run rev-35-1813-final-1 · 2026-11-12T10:12:38.945Z · commit 1ac12020421923db7da95ceb05c401a881d786ad

## Comments

### coord · 2026-11-12T09:21:05.426Z

Moved into R-1530 (v0.4) by the answer to ask b03f608e (option 1, given by the stand-in under the human's standing yes of 2026-10-28 05:04Z). E-1535 closes with C8 on the native OpenCode walk plus the Codex/Claude Code component tests; this item lands before the v0.4 release run.

### impl-1813 · 2026-11-12T09:28:38.199Z

Test-only scope: no product/wire/schema/credential contract changes. host-create-fixture gains optional adapter factories, with absent option preserving every existing caller. Consumer sweep: host-create-ready, host-restart, host-watchdog, login-card-signin, login-add, host-destroy-native remain on the default branch; login-signed-out-native and login-resignin-native use new explicit fake-native wrapper. Shared fixtureSocketPath/hostDirectory and native host/executor/droplet consumers are unchanged. Codex red receipts: socket >104 bytes then outside-home fake SSH refusal; fixed test-only layout home/r. Claude red receipt: exact native signal not within 15000ms; native launchClaude was missing FAKE_LOGIN decoration. No product defect found. tempProject honors hc-; ct- is intentional fixture socket alias (07c18fb59/da225fb50 lineage), so no tempProject defect.

### impl-1813 · 2026-11-12T09:38:27.289Z

Review evidence correction at fixed 204ece0af: A-18958 preserves available original producer provenance and missing evidence. All20 lone repetitions plus final files preceded commit, on dirty candidate atop aa14a4b23; no runtime source hash/PID/signal stream captured. TMPDIR inventory was macOS /var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T, not /private/tmp; external hc/ct/cland-h deltas unknown, no zero-leak claim. A-18959 normalizes shared transitive graph consumers by pinned tiers.json:8 proven plus16 unknown conservatively reached, T1=3/T2=6/T3=14/T4=1, with per-file executed/planned/deferred status. Explicit docs/name consumers: docs/hub/logins.md, host-restart/host-destroy-native/login-signin/login-relaunch/login-resignin-native/login-signed-out-native guides, tests index; source callers and helper enumerated in artifact. Manifest Claude dead-login allowance must reconcile final green7.158059708s to18s; hold head pending complete source verdict.

### rev-35 · 2026-11-12T09:42:57.686Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1813-source-1
commit: 204ece0af46d900f3edd150e0af4d99fc1dac40d
scope: full
findings: [{"severity":"medium","text":"Claude dead-login17s allowance/reason omits final whole-file green7.158059708s. Declared ceil(1.5×1.6×sample) yields18s including that retained sample, above five-lone max7.034002375. No approved exclusion; leadf6077fe1 confirms missed final reconciliation. Reconcile all retained greens and update allowance/reason, no timing rerun.","file":"hub/test/durations.json","line":15410}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18960 complete source1 NOT CLEAR,1medium Standards/0additional Spec source defects. Native Codex/Claude dead-login and renewal assertions implement C1/C2/C4/C5; short owned Codexrun, identity-preserving Claude decoration, explicit root mapper, same native session/PID/conversation/volume and fresh post-renewal turn proof inspected. Defaults preserved; shared lifecycle/sealing remains earlier owner, no product change. A18957 local20×returncode0 samples/3+6full positive outputs inspected; A18958 qualifies all as precommit dirty candidate/chronology not runtime Git attestation, lost repetition streams/signal/PID, inferred wholefilezero, rawcapture/T1808 original positiveprepubscan. Inventory covers macOS tempfiledir only; /private/tmp delta and failed Claude attempt's positive drain unknown, no fabricatedzero/closure. A18959 8proven+16unknown24tiered rows/local/planned/deferred; default importers checked, notcoverage. No criteria verified. Clean corrected204ece0af/baseaa14. Holdreleased for consolidated allowance correction/fresh source review; no devmerge,productfix,timing/provenance-only rerun requested. Final exacthead Linux plus qualified Mac evidence/approved native disposition pending; fullT3/T4QA separate. No Reviewer runtime work.

Criteria: C3 failed (Duration allowance does not reconcile the later retained green sample with its stated formula.).

### rev-35 · 2026-11-12T09:48:17.504Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1813-source-2
commit: 1ac12020421923db7da95ceb05c401a881d786ad
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18969 source2 CLEAR0findings. Onlyduration2add2delete; Claude18s/reason nowreconciles7.158059708retainedworst,otherbaselines/allowances/mode unchanged;clean1ac120204/tree66de06979aa3b15ff5dc17eaed77bf166cf9dbf9,noexecutable/devmerge. A18966 exacthead3/3+6/6 actualpositivecases,recordedargv/cwd/PID/close/code0/signalnull,5runtimeSHA256 independentlymatch. /private/tmp hc11/ct1015setsunchanged;cland-h+12T1806retained,notglobalcensus/oldfailureclosure. A18957fiveMaclonepercase remainsprecommitqualifiedbyA18958chronology; Coordinator04d52d9d explicitlyacceptswithfinalheadfilesandcorrectsa58Linux-repetitionoverreach. C3verifiedincludingcorrectedallowance;noLinux5/customrunrequired. C1/C2/C4/C5/finalruntimeawaitnormalmodefreeverifyexacthead. Priorcapture/rawredactorT1808scanlimits/unknownfailedClaudedrainpreserved;A18959consumer24tieredpathsnotcoverage. Holdreleased;noReviewerexperiments,extranative/provenancererun/devmerge. RemainingT3batch/T4stage/QAseparate.

Criteria: C3 verified.

### impl-1813 · 2026-11-12T10:10:10.838Z

Reviewed-head verification6466e5a2 exit0 at1ac12020421923db7da95ceb05c401a881d786ad, Linux x64 droplet c-8 lon1 Node24.21.0.6192passed/0failed/0skipped. T0/T1/all fallbackT2/Web and changedT3 two files9cases once; no Linux repetitions. Headless Shell1248 Chrome for Testing156.0.8078.4 isolated browser. A-18978 log; A-18979 exact native generated-case finishes and24-consumer reconciliation. All9 graphT1/T2 consumers executed; two changedT3 executed; remaining12T3 deferred merge-batch/integrated,1T4 stage/epic. C3 qualified precommit Mac5-lone samplesA18957 plus exact final-head MacfilesA18966 accepted by Coordinator04d52d9d. Final Mac /private/tmp hc/ct names unchanged (preexisting11/1015); cland-h+12 left forT1806. Duration/budget/ratchet report mode; no prior failure cleanup/provenance limit upgraded. Awaiting Reviewer same-head final settlement; Coordinator enqueues after hub ready.

### rev-35 · 2026-11-12T10:12:38.945Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1813-final-1
commit: 1ac12020421923db7da95ceb05c401a881d786ad
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18982 FINAL CLEAR allC1–C5,0findings. Same-head6466e5a2/A18978 streaming audit6192base test/685base file passes, separate125load test/file passes,0negative/skip. Allnative9cases/2full files pass once; four new exactcase seconds9.781967753/9.876031488/6.273671314/5.651768638; C1/C2signout+hostskip+liveownership,C4mappedrenewedfile,C5samePID/conversation/volume freshturnassertions retained. A18979all24priorconsumers preserved:9T1/T2+2T3ordinary positive;12T3/1T4deferred,notgraphcoverage. C3 Coordinator04d52d9d acceptedqualifiedprecommitMac5-loneA18957/58+exactfinalMacA18966,notLinux5. Corrected18sallowance sourceA18969 stands. Git66de06979aa3b15ff5dc17eaed77bf166cf9dbf9; normalizedde6eac8154c85aceb9c09b20905f0670e33e3f9e independentlymatchesprovenance;cleanhead. HostT0gate separate; Linuxx64Node24.21/nvim0.12.5,c8lon1,2workers1132s/$0.0786,HeadlessShell1248 ChromeTesting156.0.8078.4 exactbinaryretained;selectedT3twofiles9identities37.410s addedwall1base. Reportlint122/59+budgets/ratchet stayreport. Mac+12T1806prefixroots,T1808rawcapture,precommit/missingstreams/hash/oldfailedClaudeunknownclosurelimits preserved;no globalempty orretroactiveclosureclaim. NoReviewerexperiments. RemainingT3batch/T4stage/integratedQAseparate,qaPolicynone. Holdreleased;claim untilnormalmerge.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-12T10:54:23.158Z

Merged c7978ae308fce04d502da66fbb8e3709b7c97217 onto dev.
