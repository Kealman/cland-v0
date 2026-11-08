---
id: T-1748
kind: task
title: The detached host watchdog
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1747
topic: topic-1437
branch: t/T-1748-the-detached-host-watchdog
created: 2026-11-07T16:01:58.814Z
updated: 2026-11-08T03:59:53.806Z
closed: 2026-11-08T03:59:53.806Z
---

## Summary

At create, each host gets a detached watchdog process, with its pid identity recorded on the lease. At the deadline in the lease file, the watchdog deletes the host and its SSH key through the host's provider, each deletion confirmed by a read. It does so even when the hub is gone, then writes a receipt and settles the host's spend. A renewal moves its deadline, and a hub destroy stops it. Re-arming after a hub restart is T-1752's.

## What to build

A provider-neutral watchdog over `HostProviderRegistry` and `release`. It runs with the hub's environment and never puts a token in argv. Its pid-identity handling follows `executor/droplet/watchdog.ts` (arm, verify identity, stop with escalation).

## Acceptance criteria

- [x] C1. A host create arms a detached watchdog whose pid identity is recorded on the host's lease (test).
  - done: impl-1748 · 2026-11-08T02:36:07.839Z
  - verified: rev-35 [reviewer] · run rev-35-1748-final-1 · 2026-11-08T03:21:44.176Z · commit 5578a77d59db290202f488d571fdb4cbe13251ae
- [x] C2. With the hub stopped and a lease of 30 s, the watchdog deletes the fake machine and its key after the deadline, the provider confirms both absences, and a receipt is written (test).
  - done: impl-1748 · 2026-11-08T02:59:36.762Z
  - verified: rev-35 [reviewer] · run rev-35-1748-final-1 · 2026-11-08T03:21:44.176Z · commit 5578a77d59db290202f488d571fdb4cbe13251ae
- [x] C3. A watchdog that deletes its host settles the host's spend under `hosts` (test).
  - done: impl-1748 · 2026-11-08T02:36:08.402Z
  - verified: rev-35 [reviewer] · run rev-35-1748-final-1 · 2026-11-08T03:21:44.176Z · commit 5578a77d59db290202f488d571fdb4cbe13251ae
- [x] C4. After a renewal, the watchdog does not fire at the old deadline (test).
  - done: impl-1748 · 2026-11-08T02:36:08.631Z
  - verified: rev-35 [reviewer] · run rev-35-1748-final-1 · 2026-11-08T03:21:44.176Z · commit 5578a77d59db290202f488d571fdb4cbe13251ae
- [x] C5. `cland host destroy` stops the host's watchdog after the confirmed deletion (test).
  - done: impl-1748 · 2026-11-08T02:36:08.963Z
  - verified: rev-35 [reviewer] · run rev-35-1748-final-1 · 2026-11-08T03:21:44.176Z · commit 5578a77d59db290202f488d571fdb4cbe13251ae

## Blocked by

- T-1747

## Notes

- Hot files: `hub/src/host/host-watchdog.ts` (new; reuses the executor's arm, identity and stop helpers), `hub/src/host/provision-host.ts` (arm at create, stop at destroy).
- Tests: new `hub/test/host-watchdog.test.ts` (T3, real detached process, fake provider); T1 cases with injected process probes, as `executor-watchdog.test.ts` does.
- Serves epic C5 and C7.

## Comments

### impl-1748 · 2026-11-08T02:18:34.512Z

Rule-20 consumer sweep: host-leases get/effective/renew/mirror and production file reader, records and registry shutdown; provision-host create/destroy and hub daemon/dispatch callers. Direct tests: host-lease T2, host-create-entry T2, host-destroy T2, host-provision-recovery T2, host-create-ready T3, host-provision-gate T3, host-destroy-native T3; fixture consumers host-create-ready and host-destroy-native. Existing lease rows and old mirror shape remain accepted, optional watchdog absent on old rows. Executor helper consumers stay runtime unchanged. QA E-1533/E-1534 stage briefs and implement T-1747 guidance read alongside new item documentation; no reply or provider wire shape changes.

### rev-35 · 2026-11-08T02:27:34.055Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1748-source-1
commit: 56f49931a6ff67d568f40de502665c4c6fdea8c0
scope: full
findings: [{"severity":"high","text":"Existing absence receipts are trusted after JSON.parse; publication conflict validates only timestamp/array shape. A valid timestamp with missing/incomplete/foreign reads bypasses provider deletion and settles hosts spend without bound positive machine/key absence. Use one captured-identity receipt validator at startup and publication conflict; invalid evidence must fence. Author221386d3 confirms no other owner.","file":"hub/src/host/host-watchdog.ts","line":58},{"severity":"medium","text":"Retirement treats executor stopWatchdog return as positive closure, but recovered unknown native birth can return while PID remains alive. It then removes input and lease/watchdog authority, reporting destroyed despite unproved writer closure. Require owned close, observed absence or readable different birth; retain ownership on unknown. Author221386d3 confirms.","file":"hub/src/host/host-watchdog.ts","line":34},{"severity":"medium","text":"New watchdog cleanup loop is fail-fast: one stop/join rejection skips later watchdogs/census, while shared cleanup still removes directories and no guard retains the root. Attempt all captured joins and guard removal on positive closure, including early failure. Author46c4ead5 confirms no other owner.","file":"hub/test/host-create-fixture.ts","line":42},{"severity":"medium","text":"Outer watchdogs do not cover independently bounded setup/arm, receipt, ledger and stop/cleanup phases. Default first outer60s is below its73s allowance; second similarly combines full fixture/create and receipt/cleanup. Derive named envelopes without changing the30s lease behavior. harness.eventually uses literal bounds, not load-factor scaling; author46c4ead5 confirms.","file":"hub/test/host-watchdog.test.ts","line":18},{"severity":"medium","text":"Incomplete rollback controls only assert captured pidIdentity, not a positively live watchdog/backstop before teardown. Coordinator2bdb267f explicitly required that boundary; a prematurely dead watchdog can pass these controls. Add live-backstop assertion paired with confirmed rollback retirement. Author46c4ead5 confirms.","file":"hub/test/host-create-ready.test.ts","line":103}]
finding_counts: {"high":1,"medium":4,"low":0}

A-17704 complete pinned source pass:1high+4medium. Spec axis: bound/validated absence receipts missing (startup bypasses all checks); recovered unknown PID probe is treated as completed stop. Standards axis: fail-fast fixture drainage lacks attempt-all/root-retention guard; test outer envelopes undercount named phases; incomplete rollback lacks Coordinator-required live-backstop assertion. Authors221386d3/46c4ead5 confirm no external owners. Corrected my earlier scaling premise: harness.eventually uses literal bounds, unlike until; actual envelope/allowance mismatch remains. C4 runtime-unverified; no criteria verified. A-17701 narrative/partial/pre-final receipt limits retained; original producer publication requested without rerun. Fresh combined corrected source review before configured verification; no Reviewer tests/probes/edits/delegation, no extra fullsuite or devmerge requested. Affected after-stage QA separate.

Criteria: C1 failed (Incomplete rollback captures an identity but lacks the explicitly required positive live-backstop control.), C2 failed (Retained absence evidence is unvalidated and fixture failure can remove roots with watchdog closure unproved.), C3 failed (A parsed receipt with absent/incomplete or mismatched confirming reads can settle hosts spend without provider absence proof.), C5 failed (Recovered unknown birth may be treated as completed retirement while the recorded PID remains alive.).

### impl-1748 · 2026-11-08T02:28:14.190Z

Correction consumer sweep before shared contracts: bound absence receipt is private/new in this item: recordHostAbsence hub create/destroy and runHostWatchdog startup/publication paths, new loop/native tests, docs/hub/host-watchdog and test guide. Old unbound receipts will fence, not silently migrate. Additive executor watchdogStopped export reuses the same native process owner/probes; existing watchdogAlive/arm/stop signatures and behavior remain unchanged. Consumers searched by helper names/imports: executor droplet/run/prepare/cleanup/dependencies, hub demos/suites, fake digitalocean API, executor-watchdog T1, demo-release T3 and host native tests; QA T-271 mentions old helper. Existing executor stop paths unchanged; direct runtime helper consumer executor-watchdog will run, plus new host tests.

### rev-35 · 2026-11-08T02:38:10.826Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1748-source-2
commit: 88db047a24c4f2dd60f233db9bf0c7875deb2b88
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17707 corrected full source clear; all five A-17704 findings resolved. Shared receipt parser binds acquisition identity and both confirming reads at startup/conflict; positive watchdogStopped proof fences unknown live births before input/lease retirement and is reused by executor wait. Fixture attempt-all joins/census plus guarded removal retain unproved roots; named outer phases preserve real30s lease/literal35s receipt; incomplete rollback asserts live backstop. Existing executor owned-child/legacy/signal behavior and direct consumers reviewed. A-17706 full typecheck, test:lint and96/96 components/23/23 native commands have matching head/tree2c668ee4 and code0/signalnull records; artifact hashes checked. Their logs are bounded500-char-per-chunk diagnostics, not complete raw streams; counts/completions and prior precommit/red limits remain explicit. static.completion is npm run test:lint, not a captured full npm run check. All C1–C5 remain runtime-unverified pending mode-free configured verification at this fixed head. No Reviewer tests/probes/edits/delegation or provenance-only repeat. Affected after-stage QA separate.

### rev-35 · 2026-11-08T02:57:41.774Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1748-evidence-1
commit: 88db047a24c4f2dd60f233db9bf0c7875deb2b88
scope: evidence
findings: [{"severity":"medium","text":"Missing file-level host-watchdog.test.ts allowance causes the enforced duration gate: 61.276673082s >60s, despite two passing30s cases and valid73/75s per-case allowances. Configured T3/overall exit1; Web unexecuted. Add measured/reasoned file allowance under approved C-216 owner, preserving behavior/assertions.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17709 inspected A-17708 configured2da31d7d. Actual enforced file-duration refusal at log29868, not report-only notices; all assertions pass but T3/overall exit1 and Web unexecuted. Independent execution projection a8a9141880c5d1fb75ca6e9f7f58ed4c1beda349 matches reviewed88db. T0/T1/fallback-allT2 pass; selectedT3 fifteen identities once pass, new native30.075034811/31.201638271s sum61.276673082s. New identity/parser/loop/drain23base+115distinct load repetitions all pass; four failure arrays empty. Counts retained5198pass/interruption5438pass/parsed5117basepass kept separate. Linuxx64 .147 Node24.21/Nvim0.12.5, uncached/skips[], browsernull/Webunrun. Prior production corrections remain inspected; no new runtime defect. C2failed, remainingcriteria unverified. Author10170481 confirms pure replay and Coordinator-authorized C-216 metadata correction. Fresh delta review then new mode-free verify, no unchanged-source/provenance-only rerun or devmerge requested; affected after-stageQA separate.

Criteria: C2 failed (Required watchdog native file is refused by the enforced61.277s>60s file-duration gate; overall verification is red.).

### rev-35 · 2026-11-08T03:00:30.556Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1748-source-3
commit: 5578a77d59db290202f488d571fdb4cbe13251ae
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17711 manifest-only delta source clear. Exactly one file:true host-watchdog.test.ts allowance92s/openC-216, added11/08 expires11/13 (5days); unique key, independently checked ceil(1.5×worst measured61.276673082s)=92. Reason correctly distinguishes actual Linux A-17708 and macOS A-17706 totals. Runtime/tests/assertions/baselines/per-case allowances unchanged from source-clear88db. A-17710 replay preserves original sole file-budget red and same-sample failures[] green; owner advisory is automatic ancestry absence, not invalid explicitC-216 entry. Prior configured A-17708 stays failed, Web unexecuted; no carry/green-suite claim. C1–C5 remain runtime-unverified pending fresh mode-free verify at5578. No additional local/native/provenance-only rerun or devmerge requested; affected after-stage QA separate.

### rev-35 · 2026-11-08T03:21:44.176Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1748-final-1
commit: 5578a77d59db290202f488d571fdb4cbe13251ae
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17717 final same-head clear, C1–C5 verified. Independently inspected configured c90f814f/A-17716:5513 aggregate passes, zero fail/cancel/skip/todo;5374 parsed base passes, five empty failure arrays. Exact source projection6b69a73d6c268a2219ebf033348eaadb080ef859 matches provenance. T0/allT1/fallback-allT2/three changedT3 files fifteen identities once/Web exit0. Detached owner-close30.099531907s and actual hub-stop31.14939468s prove machine/key absence receipts; hosts ledger, published renewal/failed mirror, CLI destroy and live/retired rollback boundaries pass. All23 new T1/T2 controls base+115distinct load repetitions pass; existing executor-watchdog26base passes. File aggregate61.248926587s passes92s allowance, prior worst/cap arithmetic remains valid. Linuxx64 .147 Node24.21/Nvim0.12.5, uncached/skips[], isolated HeadlessShell1248 CfT156.0.8078.4. Advisory budgets/lints/ratchet remain report-only; remainingT3/T4 not claimed. Local A-17706 bounded diagnostic limits and historical red A-17708 retained; no resource lifetime/cost invented from unavailable producer fields. No outstanding findings or additional rerun/edit requested. After-stage affected QA remains separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-08T03:59:53.806Z

Merged debeaca4d8c0e3219bff1c3da35d007cb82b1a35 onto dev.
