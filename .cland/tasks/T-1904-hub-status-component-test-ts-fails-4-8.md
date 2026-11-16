---
id: T-1904
kind: task
title: "hub-status-component.test.ts fails 4/8 in a crew session's shell: in-process CLI cases inherit the session's CLAND_* identity and hit the scratch hub's credential check"
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1556
branch: t/T-1904-hub-status-component-test-ts-fails-4-8
created: 2026-11-16T07:40:00.448Z
updated: 2026-11-16T15:42:47.870Z
---

## Summary

Run standalone from a crew session's shell (impl-1876, 2026-11-16, macOS, Node 24.21.0), `hub/test/hub-status-component.test.ts` fails 4 of 8. Three crew-context cases throw `session "impl-1876" credential is missing or invalid`, and the history case then reads `undefined.length`. The cases invoke the CLI in-process without the shared fixture environment, so they inherit the session's `CLAND_SESSION_*` variables. This is the class T-1285 fixed for `doctor.test.ts`; this file was missed. It passes in suite runs, which seal the environment, and gives a false red in targeted runs from a session.

## What to build

Run every in-process CLI call in this file through the shared fixture environment (`fixtureEnvironment` with `scratchGitEnvironment`), so a crew session's identity never reaches the scratch hub. Search the other component tests that call the CLI in-process for the same pattern, and fix or list them.

## Acceptance criteria

- [x] C1. `hub-status-component.test.ts` passes 8/8 when run standalone with a crew session's `CLAND_SESSION_*` variables set, and still passes in the suite runner (test).
  - done: impl-1904 · 2026-11-16T14:46:26.762Z
  - verified: rev-36 [reviewer] · run rev-36-1904-final-1 · 2026-11-16T15:42:47.223Z · commit 1077b33e7cc64b5c464a61617e21e6878f6ee8bd
- [x] C2. The other in-process CLI component tests are swept for inherited session identity, and each one is fixed or named as unaffected (test).
  - done: impl-1904 · 2026-11-16T15:09:38.800Z
  - verified: rev-36 [reviewer] · run rev-36-1904-final-1 · 2026-11-16T15:42:47.223Z · commit 1077b33e7cc64b5c464a61617e21e6878f6ee8bd

## Comments

### impl-1904 · 2026-11-16T14:43:28.940Z

C2 sweep (rg src/cli/, runHub/runSetup/runDoctor/runTask/runCrew/runUpdate/runSuiteCommand, askHub/askHubFrame and CLAND_SESSION across hub/test): fixed hub-status-component plus hub-priority (red 0/1 undefined.nice) and web-edge (red 6/8, both status calls rejected impl-1904 credential). Unaffected component-task.ts: explicit {} or scratch sessionShell env; setup-remote-component: explicit fixtureEnvironment; startup-ready/deadline-component: start-only, liveness uses probeHub's explicit {}, no actor frame; aide/config-reload/executor-prepare/release-preflight components: subprocess harness seals caller env and explicit fixture actors. Doctor fixture passes explicit sealed toolchain env (T-1285); hub-lock-readers scopes fixtureEnvironment. Other in-process setup/task/suite cases pass explicit environments or fail argument parsing before discovery; init/update fixtures do not emit session actor frames (withInitGitIdentity seals native init calls). Pure describe/usage/parser imports do not call the hub. Direct frame consumers auth-mode, daemon, doctor-hosts/users, web auth/signin/upload/cookie/tunnel and user-invites pass explicit envs. Existing skills-tracker-support strips CLAND_* itself, so unaffected by inherited session identity; shared-builder migration reported separately.

### impl-1904 · 2026-11-16T14:48:53.058Z

Correction to C2 sweep claim at ec4aee038: Reviewer identified account-cli.test.ts runAccount with ambient process.env/default askHubFrame identity, behind a fake peer that does not reject inherited actors. This src/cli import hit had no retained per-path disposition; no approved exclusion exists. C2 is incomplete pending source verdict/fix. The broad 'other entry points explicit/unaffected' claim must not be read as coverage of runAccount. Holding source and experiments during the pinned review.

### rev-35 · 2026-11-16T14:51:26.237Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1904-source-1
commit: ec4aee038c98ee8cc4905e96d307c9b7d408c2c6
scope: full
findings: [{"severity":"medium","text":"C2 sweep missed runAccount's default process.env transport. Test overrides only CLAND_HUB_FILE; runAccount→askHubFrame→sessionOf sends inherited crew actor/credential to permissive fake peer, so green held-poll counts can hide the leak. No earlier owner/exclusion (claimant confirmed). Seal this in-process CLI fixture with shared inputs/restoration, retain original refresh/deadline assertions, add synthetic outer actor absence at actual peer boundary and complete per-path consumer dispositions.","file":"hub/test/account-cli.test.ts","line":39}]
finding_counts: {"high":0,"medium":1,"low":0}

Full Standards/Spec review A-20180 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20180-t-1904-full-source-review-and-missed-account-cli-identity.md: three edited T2 seams otherwise preserve assertions/shared sealing/restoration, no production change. A-20179 retains71 current lexical import rows/59paths with normalized tiers and conservative statuses, not historical/transitive execution proof. A-20174/A-20177 precommit red/green/check excerpts and missing raw/hash/signal/search/publication-control limitations retained. C1done/unverified pending suite runner;C2failed. Hold released for consolidated correction/fresh exact-head source request before mode-free verification; no tests/native work by Reviewer, no full/all request or dev merge.

Criteria: C2 failed (Missed account-cli ambient/default-env boundary sends inherited crew identity to a permissive fake peer; sweep incomplete.).

### impl-1904 · 2026-11-16T15:01:49.596Z

Consolidated correction at pushed clean 50d7d027431be2e5e3986f961d448cc300585701. C2 authoritative current inventory/dispositions: A-20196 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20196-t-1904-corrected-72-path-sweep-and-peer-isolation-regressions.md (72 paths; manifest blob pinned; full fresh lexical hit bytes; per-path fixed/unaffected reasons and executed/deferred/unknown-suite-selection labels). Supersedes earlier broad sweep claim. account-cli and import helper now seal process.env via shared builder; actual socket-peer assertions catch synthetic outer actor/token, each red→green1/1. Original account refresh timing/results retained. Production nested-env forwarding is separately T-1914; copied skills filter remains T-1913. Three per-test guides/index updated. Final source typechecks+whole-source static/test lint exit0 (122 existing report-only findings/59files, zero refusals; wording0). C1 suite-runner limb still pending same-head verify after fresh source review/window; no T3/native/browser/cloud/QA result claimed.

### rev-35 · 2026-11-16T15:03:56.895Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1904-source-2
commit: 50d7d027431be2e5e3986f961d448cc300585701
scope: full
findings: [{"severity":"medium","text":"New import-peer regression has no pre-acquisition fence/whole-work join. onCleanup only registers after await listen and drains already-listening resources, not pending setup/FS/runImport/gh continuation or late listener. Root/env teardown can race admitted work. Claimant confirms no earlier owner. Register shared admitted-work/resource ownership before acquisition, adopt late resources, fence later steps and join before disposal/env restoration; add owned held-work failure control retaining actual actor assertions.","file":"hub/test/import-github.test.ts","line":25}]
finding_counts: {"high":0,"medium":1,"low":0}

Full correction pass A-20197 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20197-t-1904-corrected-peer-regression-ownership-review.md complete. Account and import actual-peer identity assertions/shared sealing resolve previous omission; production nested-env repair properly belongs to T-1914. New fixture lifetime is sole medium. A-20196 retains72current paths; sole suite-preflight object tier independentlyT3, derived correction pending; runtime/provenance limits A-20177 retained. No configured suite/browser proof;C1done/unverified,C2failed. Hold released for consolidated lifetime correction/owned failure control then fresh committed-head request; no Reviewer runtime or extra dev merge.

Criteria: C2 failed (Original account isolation corrected, but new import regression lacks failure-path whole-work/acquisition ownership.).

### impl-1904 · 2026-11-16T15:09:41.678Z

Lifetime correction committed/pushed1077b33e7. Shared pathFixture/fixtureWork owns before acquisition and joins/fences the entire peer setup/runImport/gh continuation; late listen closed, env restored after sequence settlement, incomplete work/peer closure retains root. Held-write and synthetic-failure controls plus actual-peer test pass3/3 (name-selected local T2, macOS arm64 Node24.21). Final whole-source typechecks/lints exit0; wording0; report-only lint122 findings/59files, zero refusals. A-20199 supplies evidence plus derived accounting correction: A-20196 suite-preflight tier is T3, not object rendering; unexecuted disposition remains. Fresh source review requested; exact-head configured verification pending source clearance/window.

### rev-36 · 2026-11-16T15:14:02.162Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1904-source-3
commit: 1077b33e7cc64b5c464a61617e21e6878f6ee8bd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards 0 findings / Spec 0 findings. A-20207 reviews the complete corrected branch and pre-acquisition whole-work owner, late-listen adoption, server-close/root-retention guard, unconditional held-work cleanup, and retained actual-peer identity assertions. A-20196 + A-20199 preserve 72-path lexical consumer dispositions and tier correction; source accounting does not imply execution. Candidate targeted/typecheck/lint receipts retain publication/provenance limits. C1/C2 remain unverified until configured same-head case/file receipts; source clear permits configured verification at this exact head in the authorized window.

### impl-1904 · 2026-11-16T15:41:31.852Z

Same-head configured run f8f72ba8-5e70-4878-a159-c312eb911c12 green at1077b33e7/tree478b0c7f069b189fe52aded388bdddcf67e85e36: hub6434/6434, no failures/cancellations/skips. Streamed A-20222 suite timing records independently confirm24/24 item cases: status8, priority1, account1, import6, web-edge8; exact names/outcomes exported in A-20223 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20223-t-1904-same-head-configured-24-case-receipts.md. Completed T0/T1/T2/Web (docs-path coverage fallback allT2); T3 deferred merge batch, noT3/T4/QA receipt. Linux x64 droplet c-8sfo2 Node24.21; Chrome Headless Shell156.0.8078.4 positive binary provenance in log; lifetime1335s/cost$0.0927. Budgets/lint report-only. Source head unchanged and clean; Reviewer owning source-3 holds final settlement.

### rev-36 · 2026-11-16T15:42:47.223Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1904-final-1
commit: 1077b33e7cc64b5c464a61617e21e6878f6ee8bd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1/C2 verified. A-20225 verdict and independent A-20224 reconcile configured f8f72ba8/A-20222 at source-cleared 1077b33e7: 6434 ordinary tests/705 files pass, separate 225 load test/file passes, no nonpass/skip. All eight status names and every changed file have positive current finishes; original import cases pass and three new import cases each base1+load5. All72 retained consumers classified:50 configured pass,16T3 deferred,6 helper/source references. Entire991manifest has705 positive file finishes,269T3/17T4 deferred, no missing lower/Web file. HostT0/LinuxT1/T2/Web exit0; actual HeadlessShell1248/CfT156.0.8078.4 captured. Candidate standalone/provenance limits, report-only budgets/lint and T-1913/T-1914 boundaries retained; no fullT3/T4/native-provider/QA claim.

Criteria: C1 verified, C2 verified.
