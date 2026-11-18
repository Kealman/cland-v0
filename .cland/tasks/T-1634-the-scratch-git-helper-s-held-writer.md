---
id: T-1634
kind: task
title: The scratch Git helper's held-writer cancellation test fails on a slow droplet disk
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1623
branch: t/T-1634-the-scratch-git-helper-s-held-writer
created: 2026-11-02T14:37:15.028Z
updated: 2026-11-18T16:22:20.460Z
closed: 2026-11-18T16:22:20.460Z
---

## Summary

`hub/test/git-maintenance.test.ts:38` ("scratch Git helper drains a held descendant writer before rejecting cancellation") failed in merge batch 60682c23 (run 93d2bcfe, log A-15873) with `writer 54403 is gone before the command rejects: true !== false`. The only member, T-1619, does not touch git maintenance: its diff is the droplet reaper, its test and docs. The droplet's disk was very slow (SQLite 1463 ms, fsync 67.7 ms; the usual is 11–35 ms and 3–8 ms). The test passed in periodic dev T3 at 4e8aa7ee, and 5/5 alone on macOS at 14:37Z.

Likely cause: the helper's rejection resolves before the descendant writer has been reaped. On a slow machine the writer stays visible to `pidAlive` (a live process or an unreaped zombie) for a moment after `rejected` settles.

## What to build

Make the drain contract deterministic. Either the helper awaits the writer's confirmed exit before it rejects, or the test waits on that exit signal, not on wall time. Don't retry and don't sleep.

## Acceptance criteria

- [x] C1. The test passes 20/20 under an injected slow-reap seam that delays the writer's exit after SIGTERM by more than the current window.
  - done: impl-1634 · 2026-11-18T13:06:16.258Z
  - verified: rev-36 [reviewer] · run rev-36-1634-final-1 · 2026-11-18T14:30:05.385Z · commit 1792b01afc905e71c32f877b7cc5eadde9c381cf
- [x] C2. The helper never rejects a cancellation while a held writer it started is still alive (test).
  - done: impl-1634 · 2026-11-18T13:45:52.556Z
  - verified: rev-36 [reviewer] · run rev-36-1634-final-1 · 2026-11-18T14:30:05.385Z · commit 1792b01afc905e71c32f877b7cc5eadde9c381cf

## Comments

### impl-1634 · 2026-11-18T11:21:11.345Z

Consumer inventory (rule 41): fixtureCommand calls are git-maintenance.test.ts cancellation/recovery/repository operations and git-maintenance-cli.test.ts setup Git calls; fixtureCommandOutput is used by git-maintenance.test.ts stale gc.log checks; FixtureCommandError nativeFailure/code/stderr is read by its cat-file absence classifier. One guide: docs/agents/tests/hub-test-git-maintenance.test.ts.md. Searches covered helper filename, exports and raw names across hub, nvim, docs, qa and shipped skills; no other callers. Preserve existing string/error fields and add writer receipts. Both consumer test files remain T3; no T1 proof is claimed.

### impl-1634 · 2026-11-18T11:27:58.494Z

Checkpoint: 900 ms injected slow-SIGTERM case passed 20/20 on local macOS arm64 Node v24.21.0 (A-21185); initial absent-receipt red is A-21184. Full git-maintenance.test.ts 11/11 and CLI caller 1/1 passed before the added 5100 ms case. Coordinator requires 5100 ms too and queued a new native slot after the macOS stage cover. That case is written but unexecuted; no C1/C2 done marks or review requested. Native slot released. Current full npm run test:lint exits 0 with 0 refusals (130 report-only findings; known install-baseline T-1484 and build-tier notices); full npm run typecheck exits 0 after correcting test narrowing. First origin/dev fetch/merge was already up to date. A-21187 records the next red-to-green step: preserve cleanup failure as secondary diagnostic but join writer exit before rejecting. No verify submitted; no browser/cloud calls.

### impl-1634 · 2026-11-18T13:10:13.244Z

Implemented and pushed source 975baf7e7af70fa5b988958fab68bdf6d4f7d1b7 after merging origin/dev 93026cbe9. C1/C2 done: both 900 and 5100 ms injected native exit cases passed 20/20 each, including a cleanup error and complete writer receipts in every 5100 ms repetition (A-21254); pre-fix 5100 ms red A-21253. Final serial caller batch 13/13 passed. Duration checks: T3 42/42 and T1 11/11 pass; test:tiers passes. Coordinator-approved C-216 exact-case 8.301 s allowance expires 2026-11-25, macOS 5.534 s sample, Linux pending. Native slots released. Full lint completion and fresh typecheck are the last source-review preflight; no verify submitted. A-21258 preserves check scopes and sample provenance.

### rev-36 · 2026-11-18T13:22:49.717Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1634-source-1
commit: 975baf7e7af70fa5b988958fab68bdf6d4f7d1b7
scope: full
findings: [{"severity":"medium","text":"Spec P1 / C2: pgrepMembers failure before stop/close, or unexpected signal-0 failure during observation, escapes drain and finish immediately rejects without a positive exit receipt for every held writer. Retain/join the admitted command and writers across observation failures; report diagnostics only after their positive exit.","file":"hub/test/git-maintenance-fixture.ts","line":43},{"severity":"medium","text":"Standards S1: descendant settlement uses a PID-only pgrep snapshot and discards the native reader's birth map; WriterExit lacks captured lifetime/group binding. ownProcess protects a separate cleanup path, not this receipt. Bind and validate each descendant observation against its admitted native lifetime (rules 26/39).","file":"hub/test/git-maintenance-fixture.ts","line":56},{"severity":"medium","text":"Standards S2: both generated slow-exit cases lack a pre-acquisition whole-caller fence/join and separate setup owner; resource hooks and the narrow writer-gate finally do not join late continuations before root/mock teardown on abort. Use the shared normal/signal owner, root adoption and named setup bound while preserving native assertions (rules 9/12).","file":"hub/test/git-maintenance.test.ts","line":40},{"severity":"medium","text":"Standards S3: new synchronous processIdentities calls here and at git-maintenance.test.ts:69 reach Darwin execFileSync('/usr/bin/perl') without a fixture-owned environment. The separately sealed command/pgrep launches do not seal those children. Use the shared identity reader/environment seam with final filtering (rule 15).","file":"hub/test/git-maintenance-fixture.ts","line":56}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source review at 975baf7e7af70fa5b988958fab68bdf6d4f7d1b7, tree 35786bcfaf591328bfa0eebbc9c86bff9954214d, fixed base 93026cbe99f95b11e63fe436f7e3342768fe77f2. NOT CLEAR: Standards 3 medium / Spec 1 medium; no highs/lows. Full findings, consumer census, decisions and qualified evidence audit: A-21264 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21264-t-1634-full-source-review-cancellation-join-identity-and-fixture-findings.md). Author confirmations establish no omitted owner, identity/environment seam or observation-failure exception. C2 failed; verify none. C1 remains unverified: A-21254 establishes 20 nominal passing pairs only at its earlier working-tree epoch; later precommit 13-case batch has a distinct zero-diagnostic long-case receipt. Preserve both epochs, missing provenance and prior red. Exact 8.301 s C-216 allowance is Coordinator-authorized; no allowance finding. Required lint/typecheck receipts at committed head are positive; no configured verification, Linux/native remote, Web/T4 or full-suite pass claimed. Reviewer performed read-only inspection only. Release source/experiment pin for consolidated correction; preserve native assertions and approved allowance, use fresh committed-head source review before verification, and schedule native checks through Coordinator. No provenance-only rerun or extra stress/full suite requested.

Criteria: C2 failed (Listing/observation errors can reject cancellation before every admitted writer has a positive exit receipt; descendant settlement also lacks captured lifetime binding.).

### impl-1634 · 2026-11-18T13:45:23.325Z

Review correction consumer map: fixture helper callers remain git-maintenance.test.ts and git-maintenance-cli.test.ts, both T3. New pure git-maintenance-writer.ts is imported only by the fixture adapter and new git-maintenance-writer.test.ts (T1); no native imports in that policy test. New Options.observe is used only by the T3 cancellation reader wrapper. WriterExit now carries captured native birth/group; direct close is bound to launch handle, descendant receipt waits independent ESRCH because the shared zombie callback lacks lifetime metadata. Existing raw code/stderr/nativeFailure/string-return consumers unchanged. New T1 tier entry and per-file guide/index added; exact filename/key searches found no other pinned/frozen/QA/shipped-skill consumer. CLI help/frozen usage bytes unchanged. C1 corrected pairs at 027e40895 passed 20/20 each in A-21279; final caller-cleanup-hardening head 1792b01af full native file 16/16 and CLI 1/1. No dev merge since source review. Native slot released; full static preflight and fresh review pending.

### rev-36 · 2026-11-18T13:57:24.166Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1634-source-2
commit: 1792b01afc905e71c32f877b7cc5eadde9c381cf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21282 full corrected-source clearance at 1792b01afc905e71c32f877b7cc5eadde9c381cf, tree87bae1f1368d40c91518e970df8a74baa8714209, fixed base93026cbe99f95b11e63fe436f7e3342768fe77f2. Clean/pushed matching origin; no dev merge since source1. Standards0/Spec0. All four A-21264 findings resolved: listing/capture/observation failures retain original result and guarded root through positive writer exits; descendant receipts carry stable pre-cleanup native birth/group and settle only independent ESRCH; pre-acquisition whole-caller plus separate setup ownership retains original continuations and release/cleanup/exact-command joins before storage/manual mock restoration; all new shared async identity reads receive final sealed fixture environment. Pure policyT1 and nativeT3 split, caller compatibility, guide/index/tier registration and unchanged allowance inspected. C1/C2 remain runtime-unverified; no source-only criterion marked. Independently parsed A-21279:20/20 each nominal delay at committed027e40895/tree db9beff9751f7992dc569804483d66314afe4521,80 birth/group writer rows, two receipts per case, all command exits0;39 direct closes code0 and one round12 long-case SIGTERM retained with cancellation/nativeFailurefalse. Long diagnostic1/short0 every round. Those receipts stay at027, not later cleanup-only commits. A-21281 supersedes uncertain A-21280 sample wording; final native16/16,CLI1/1,T1policy3+T2owner5,tiers/typecheck/lint0 summaries stay qualified at final head;130 report-only lint findings/0refusals. Earlier reds/failed compiler/unknown native invocation facts preserved. 8.301s C-216 allowance unchanged/authorized; prior duration checks not recounted as final. Local macOSarm64 Node24.21 only, no configured/Linux/Web/T4/full-suite/browser/cloud/generated-load proof. Reviewer read-only, no runtime or source change. Source/experiment pin released; lead may request Coordinator mode-free window at exact head. Fresh source review after any head change; no extra stress/native/provenance repetition requested.

### rev-36 · 2026-11-18T14:30:05.385Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1634-final-1
commit: 1792b01afc905e71c32f877b7cc5eadde9c381cf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21293 final evidence clearance of same-head configured1d6a018f-320b-4fee-98a5-6540f0226e2c/A-21291, source basis rev-36-1634-source-2/A-21282. Standards0/Spec0. Clean matching1792b01af/source tree87bae1f1368d40c91518e970df8a74baa8714209; recorded verification tree535333c6d3543a21b4d733fd0db2ffa29f6b1241,cached:null. Owner finished passed/exit0. T0/T1/T2/selectedT3/Web exit0;229 T1,430 T2(incl44Neovim),55 Web and one T3 base file envelopes allpass;6657top+145nested=6802basepasses,225loadpasses separate,no nonpass/unmatched start. Exact16native identities pass with timing; required six cancellation controls finish36358/364/370/376/382/388,metadata36361/367/373/379/385/391 retains12Linuxbirth/group writer rows, directclose+descendantreaped each. Observation fault preserves directSIGTERM/code null and cancellation/nativeFailurefalse; otherfive directcode0; bounded cleanup/listing/observation/capture diagnostics remain secondary. Three T1 receipt controls eachbase/timing+five distinctloadpasses/proof;five T2 shared-owner controls pass. C1 verified using qualified20/20 each at027e40895/A-21279 plus A-21282's inspected cleanup-only later delta and final-head local/configured integration positives; Linux T3 is one base execution, no repetitions, never relabeled20/20. C2 same-head live/pending-cancellation and exact native receipt assertions pass. Other269T3/all17T4 unexecuted; CLI T3caller unexecuted configured, separate final-head macOS1/1 retained. Linuxx64 droplet c-8ams3 Node24.21.0/nvim0.12.5; isolated chromium_headless_shell-1248 GoogleChromeForTesting156.0.8078.4, provenance39080. Lifetime1550s/$0.1076 not suite wall; localT0107.15s separate. 5100case5.479950511s; authorized8.301s allowance unchanged;ratchet/Web/budget/lint130findings0refusals report-only, no performance-pass inference. Earlier reds/failed checks/uncertain discarded sample/unknown native facts stay qualified. No Reviewer runtime/source/provenance rerun. QA none; evidence hold released,hub handlesready/landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T16:22:20.460Z

Merged b48adda4010564e56e5ca6fb7b0da0e696106a48 onto dev.
