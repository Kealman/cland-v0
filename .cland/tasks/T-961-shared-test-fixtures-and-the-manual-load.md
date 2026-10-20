---
id: T-961
kind: task
title: "Shared test fixtures and the manual load harness follow rule 15: own HOME and Git config, credential filter after every overlay"
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
  - tech-debt
assignee: null
parent: E-952
blocked_by: []
topic: topic-731
branch: t/T-961-shared-test-fixtures-and-the-manual-load
created: 2026-10-20T09:56:10.745Z
updated: 2026-10-20T10:56:57.196Z
closed: 2026-10-20T10:56:57.196Z
---

## Summary

Rule 15 (adopted 2026-10-20) requires real-machine work to run sealed. The shared fixtures don't fully do this yet. hub/test/account-fixture-env.ts isolates the XDG and account roots and blanks DIGITALOCEAN_TOKEN, but it doesn't replace HOME or the Git config. `clandWithEnv` in hub/test/harness.ts overlays the environment without the shared `withoutExecutorCredentials` filter. The manual hub/test/inbox-load.ts harness serves a disposable project but inherits process.env, HOME, and the provider and account variables. Found by impl-951 and impl-768.

## What to build

The shared fixture environment builders give every child its own scratch HOME, XDG directories and Git config (GIT_CONFIG_GLOBAL and GIT_CONFIG_NOSYSTEM, or equivalent). They apply the shared credential filter after every overlay. inbox-load.ts uses the same builder. A T1 self-test, extending the poisoned-HOME self-test in setup-machine.test.ts, fails if any shared builder leaks a poisoned HOME, Git config or provider variable into the child environment.

## Acceptance criteria

- [x] C1. account-fixture-env.ts, harness.ts `clandWithEnv` and inbox-load.ts produce child environments with scratch HOME and Git config and no provider/account variables, after every overlay.
  - done: impl-961 · 2026-10-20T10:20:01.884Z
  - verified: rev-23 [reviewer] · run rev-20261020-961-final · 2026-10-20T10:33:18.537Z · commit c90b2841cecf0b2ee31ef18a6b187e91e3223b98
  - verified: rev-23 [reviewer] · run rev-20261020-961-merge-final · 2026-10-20T10:43:46.268Z · commit 0a38efce234995bc8ed6f0af444f9ad70449a222
  - verified: rev-23 [reviewer] · run rev-20261020-961-second-merge-final · 2026-10-20T10:52:38.191Z · commit 1cc103c2693598d9f1e13b4428e545489b9df1ac
- [x] C2. A T1 self-test with a poisoned parent environment (HOME, Git config, DIGITALOCEAN_TOKEN, a provider key) fails against the old builders and passes against the new ones.
  - done: impl-961 · 2026-10-20T10:09:34.854Z
  - verified: rev-23 [reviewer] · run rev-20261020-961-final · 2026-10-20T10:33:18.537Z · commit c90b2841cecf0b2ee31ef18a6b187e91e3223b98
  - verified: rev-23 [reviewer] · run rev-20261020-961-merge-final · 2026-10-20T10:43:46.268Z · commit 0a38efce234995bc8ed6f0af444f9ad70449a222
  - verified: rev-23 [reviewer] · run rev-20261020-961-second-merge-final · 2026-10-20T10:52:38.191Z · commit 1cc103c2693598d9f1e13b4428e545489b9df1ac

## Comments

### impl-961 · 2026-10-20T10:07:48.138Z

Implemented pure fixtureEnvironment plus sealed worker/CLI/spoke/projectHub/manual harness environments, T1 poisoned-parent and synthetic-provider validation, T2 CLI receipt proof, and native synthetic-auth adapter injection. Coordinator expanded scope to M to migrate explicit synthetic provider dependencies in remote fixture/restart callers, lifecycle, liveness, preparation and suite dry-run. Initial targeted env/native-auth files green on local macOS working tree; serial targeted provider validation in progress. Manual load/repetition probes not run because one-minute load >6. Broad T0 raw-spawn guard is a follow-up gap acknowledged by Coordinator; no public command/role/verification policy changed.

### impl-961 · 2026-10-20T10:11:50.329Z

Source review requested from reviewer role at pushed d5e81806a0800c172a69c9ce36df307b3b7e1283; assigned rev-23. A-7380 is the implementation/seam inventory and evidence limitations; provider targeted run A-7368 is 61/61 on the preceding working tree, final watchdog delta A-7371 is 1/1. At exact candidate head, npm run typecheck and T1/T2 env regression command completed green locally on macOS (6 assertions including nested tests). These targeted runs apply no runtime tier/budget/load gate; static lint remains report only (131 findings in 59 files). No manual load run or >=5 repetitions at current load >6. Mode-free hub verification waits for clear source review.

### rev-23 · 2026-10-20T10:15:33.458Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-961-source
commit: d5e81806a0800c172a69c9ce36df307b3b7e1283
scope: full
findings: [{"severity":"medium","text":"The inherited-key deny-list still copies ambient authentication handles/config overrides such as SSH_AUTH_SOCK and NPM_CONFIG_USERCONFIG (and the final overlay filter also retains them). Scratch HOME/Git config does not seal a Git/installer child from the human's SSH agent or npm credential file. Remove these inherited credential/config escape paths after extras too, with synthetic poisoned-parent/overlay coverage; keep any intentional test dependency explicit.","file":"hub/test/fixture-environment.ts","line":14},{"severity":"medium","text":"projectHub now strips provider credentials, but executor-prepare-component.test.ts:46–48 still passes sentinel-prepare only through env and does not supply syntheticProvider. DropletExecutor requires its env token even with droplet.api injected, so existing preparation component cases cannot reach their provider behavior. Migrate that fixture and reopen paths to the validated synthetic dependency without weakening assertions.","file":"hub/test/harness.ts","line":432},{"severity":"medium","text":"The new forced HOME and OPENCODE_* filtering were not reconciled with accounts.test.ts:240–267. The HOME-fallback case still expects root/.local/share while projectHub now supplies worker/home, and the inherited-OPENCODE_DB override case silently loses the planted conflicting DB before exercising product exclusion. Migrate these deliberate scratch environment contracts and retain their real conflicting-input/default/restart assertions.","file":"hub/test/fixture-environment.ts","line":31}]
finding_counts: {"high":0,"medium":3,"low":0}

Standards: one medium Rule-15 sealing finding; Spec: two medium caller-compatibility/coverage findings. A-7396 details retained SSH_AUTH_SOCK/NPM_CONFIG_USERCONFIG, unmigrated executor-prepare-component token fixture, and accounts HOME-fallback/conflicting-DB contracts. These are source counterexamples; no Reviewer runtime failure or real credential inspection is claimed. Builder purity, shared filtering after extras, typed synthetic provider validation, migrated native seams and matching docs otherwise reviewed. A-7380 properly limits prior targeted local evidence; no exact-head gate has run. C2 remains unverified; C1 failed. Preserve original product assertions and explicit conflicting inputs when migrating callers. Request a corrected source review before mode-free verification.

Criteria: C1 failed (Ambient credential/config escape paths remain and provider/account fixture callers were not fully migrated to the new sealed boundary.).

### rev-23 · 2026-10-20T10:23:39.381Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-961-source-corrected
commit: c90b2841cecf0b2ee31ef18a6b187e91e3223b98
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no remaining findings. Spec: no remaining findings. A-7396 issues resolved: ambient SSH/npm credential/config handles removed after parent/extras with pure and CLI receipt assertions; component preparation uses validated sentinel plus exact injected API including reopen/direct calls; project-contained scratchAccountPaths restores intentional HOME/conflicting-DB/default/restart inputs and retains original product assertions. Native Claude HOME contract also migrated. Docs updated; no post-review dev merge. A-7439 records full re-review and the explicit known-owned-path contract. A-7415 33/33 and A-7416 1/1 are local Mac targeted receipts, not task/Linux/load-gate coverage. C1/C2 await runtime/final settlement; prior C1 source failure resolved. Preserve A-7380 simulated-old-builder negative-control provenance and provide original output/exit if retained (no transcription rerun needed). Source clear permits normal mode-free verification at exact c90b2841; T-962 remains separate.

### impl-961 · 2026-10-20T10:32:09.410Z

Same-head mode-free verification run 47799e29-78ce-4500-85e7-6d1b6df208b4 at c90b2841cecf0b2ee31ef18a6b187e91e3223b98 completed auto exit 0: 1951 tests/pass, zero fail/cancel/skip/todo. Linux x64 6.8.0-142-generic droplet c-8 lon1, Node24.21.0/Neovim0.12.5; lifetime435s, cost$0.0302. T1/all-T2 fallback (hub+Neovim), host npm run check; lint/duration budgets report-only, no T3/T4 coverage. A-7459 has all four new T1/T2 identities with 5/5 passing load-gate receipts (lines40606/40618/40768/43260). Clean task head unchanged; reviewer received same result and owns final evidence verdict.

### rev-23 · 2026-10-20T10:33:18.537Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-961-final
commit: c90b2841cecf0b2ee31ef18a6b187e91e3223b98
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no remaining findings. Spec: no remaining findings. Exact unchanged source head matches mode-free 47799e29/A-7459: independently counted 1951 ordinary passes/316 file passes, no other outcomes; actual T1/all-T2 hub+Neovim. Three pure sealing/path/provider identities and actual T2 CLI receipt each pass ordinarily and 5/5 load repetitions; all twelve migrated preparation component cases pass. Host check116917eb not repeated remotely; lint/missing duration baseline/T3 ratchet report-only. C1 verified via source integration and actual builder/child proof. C2 verified via source old-behavior HOME counterexample, current repeated T1 proof and A-7442 limited simulated-old-builder summary (nonzero=true, named HOME assertion=true); raw child failure output/exact exit unavailable, no old Git-head run claimed. Local native A-7415/A-7416 remain separate, T3/T4 and manual load unexecuted by this gate; T-962 separate. A-7465 records complete limits. Prior findings resolved.

Criteria: C1 verified, C2 verified.

### rev-23 · 2026-10-20T10:36:30.775Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-961-merge-source
commit: 0a38efce234995bc8ed6f0af444f9ad70449a222
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no findings. Reviewed Coordinator-authorized dev13e652a7 merge against c90b2841 and incoming dev. Resolved runCland sets authoritative T-807 fixture ownership after caller extras, then applies the complete sealed builder before explicit synthetic-provider dependency; doctor scope and shared credential filtering retained. Manifest union preserves new fixture-environment T1 plus incoming cleanup/doctor/lifecycle tiers. Incoming implementations remain retained. A-7472 is63/63 local Mac targeted harness/fixture-orphan/doctor/poison evidence, not a Linux/task gate. Prior green A-7459/final A-7465 at c90b2841 is historical only; C1/C2 require new same-head normal verification/final settlement. A-7477 records both axes, merge scope and prior negative-control/native/tier limits. Source clear at0a38efce.

### impl-961 · 2026-10-20T10:43:06.717Z

After Coordinator-authorized conflict merge and clear delta source verdict, same-head mode-free run 2f8f0d4c-858a-4d2a-9ac7-dac18dee9b37/A-7502 at 0a38efce234995bc8ed6f0af444f9ad70449a222 exited 0: 2012/2012 ordinary tests, zero fail/cancel/skip/todo. Linux x64 droplet c-8 lon1, Node24.21.0/Neovim0.12.5; lifetime347s, cost$0.0241. Host check plus T1/all-T2 fallback (hub+Neovim), static lint/duration budgets report-only; T3/T4 deferred. Clean head unchanged; reviewer received same-head result for final evidence/C1-C2 verdict.

### rev-23 · 2026-10-20T10:43:46.268Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-961-merge-final
commit: 0a38efce234995bc8ed6f0af444f9ad70449a222
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no findings. New exact unchanged integrated head matches green mode-free 2f8f0d4c/A-7502: independently counted 2012 ordinary test passes/321 file passes, no other outcomes. Actual T1/all fallback T2 hub+Neovim; host check7e593513 not repeated remotely. Three pure sealing/path/provider identities and actual CLI poison receipt each pass5/5; all12 preparation component and9 incoming fixture-orphan cases pass. A-7477 ownership/sealing integration is covered. C1/C2 refreshed; prior A-7465 reasoning retains A-7442 simulated-old-builder summary-only limitation, unavailable raw failure/exact exit, separate local native evidence and deferred T3/T4/manual load. Report-only lint/baseline/ratchet/incomplete-base/duration diagnostics remain explicit. Prior c90b2841 receipt historical only. A-7503 records limits; no Reviewer tests.

Criteria: C1 verified, C2 verified.

### rev-23 · 2026-10-20T10:45:44.071Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-961-second-merge-source
commit: 1cc103c2693598d9f1e13b4428e545489b9df1ac
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no findings. Second Coordinator-authorized merge with dev38573213 reviewed. Manual inbox-load conflict preserves incoming openDatabase instrumentation, measuring/loadavg/request metrics and cleanup while passing the existing sealed env alongside openDatabase. Against incoming dev only sealed builder/import/scratch setup/env replacement differ; measurement code unchanged. Shared builder/worker/CLI code unchanged from prior task source, tier union retained. A-7506 15/15 local Mac workload-consumer/poison/actual-CLI targeted results is not manual load/performance or task/Linux evidence; A-7507 provenance and A-7509 review retain that limit. Prior A-7502 belongs to0a38efce only; C1/C2 await new same-head normal verify/final refresh. No Reviewer execution.

### impl-961 · 2026-10-20T10:52:15.492Z

Second conflict merge verification: normal mode-free run6cb66ead-aac1-4523-b61b-b0e8059855cb/A-7524 at reviewed clean1cc103c2693598d9f1e13b4428e545489b9df1ac exited0, 2014/2014 ordinary tests, zero fail/cancel/skip/todo. Linux x64 droplet c-8 lon1, Node24.21.0/Neovim0.12.5; lifetime342s, cost$0.0237. Host check and T1/all-T2 fallback (hub+Neovim), budgets/static lint report-only; T3/T4 and manual performance evidence remain outside this run. Head kept unchanged pending Reviewer final C1/C2 verdict.

### rev-23 · 2026-10-20T10:52:38.191Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-961-second-merge-final
commit: 1cc103c2693598d9f1e13b4428e545489b9df1ac
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no remaining findings. A-7526 audits exact-head A-7524/run 6cb66ead: 2014/2014 ordinary tests pass; three pure environment cases plus actual CLI poisoned-environment case each pass 5/5 load repetitions. Twelve preparation and nine incoming orphan component cases pass. C1/C2 established with source delta A-7509. A-7442 retains only simulated-negative-control boolean/name summary, not child stdout/exact exit or an old-head execution; source comparison plus current pure/CLI proof completes C2 without stronger provenance claims. Linux T1/all-T2 includes Neovim, T3/T4 deferred; host check b7b6c21a not repeated. Lint/budgets/ratchet report-only, seven missing baselines/incomplete timing not passes. No manual workload performance claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T10:56:57.196Z

Merged eeb7e08e3c84d71fafe7aaaed2ff675fa5a46bd7 onto dev.
