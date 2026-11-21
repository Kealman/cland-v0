---
id: T-1892
kind: task
title: macOS full cover at epic close; Linux per stage
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1680
branch: t/T-1892-macos-full-cover-at-epic-close-linux-per
created: 2026-11-16T07:29:45.299Z
updated: 2026-11-20T23:14:06.754Z
closed: 2026-11-20T23:14:06.754Z
---

## Summary

After-stage gates require Mac plus sharded Linux at one tree (T-469; `docs/hub/running.md:198`). Make after-stage gates Linux-only, plus an optional macOS targeted run, and require the macOS full cover at the epic DoD gate. Merges impl #4 and §7 #1 options 1–2. The macOS workers-1 default is already in config (`verification.workers = 1`).

Kind: product. Triage ticket H-4 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes T-469 (2026-10-16) stage-gate contract. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [x] C1. An after-stage gate closes on a green sharded Linux cover and, when the plan names one, a green macOS targeted run (test).
  - done: impl-1892 · 2026-11-20T18:54:55.885Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1892-final · 2026-11-20T20:36:21.218Z · commit 2baa101846c3f7666b38afa600eaa1ba209108c2
  - verified: rev-40 [reviewer] · run rev-40-20261120-1892-final2 · 2026-11-20T22:26:44.778Z · commit b0188a93e6914acca6bd37f2a567638ea4257400
- [x] C2. The epic DoD gate still requires a green macOS full cover at the DoD tree (test).
  - done: impl-1892 · 2026-11-20T18:09:51.053Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1892-final · 2026-11-20T20:36:21.218Z · commit 2baa101846c3f7666b38afa600eaa1ba209108c2
  - verified: rev-40 [reviewer] · run rev-40-20261120-1892-final2 · 2026-11-20T22:26:44.778Z · commit b0188a93e6914acca6bd37f2a567638ea4257400
- [x] C3. running.md and the plan-epic and qa skills state the new gate (docs check).
  - done: impl-1892 · 2026-11-20T18:09:51.624Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1892-source · 2026-11-20T18:19:53.607Z · commit efb8cab095b54814c72da2bab038a0a5406045ca
  - verified: rev-40 [reviewer] · run rev-40-20261120-1892-source2 · 2026-11-20T18:57:42.573Z · commit 2baa101846c3f7666b38afa600eaa1ba209108c2
  - verified: rev-40 [reviewer] · run rev-40-20261120-1892-final · 2026-11-20T20:36:21.218Z · commit 2baa101846c3f7666b38afa600eaa1ba209108c2
  - verified: rev-40 [reviewer] · run rev-40-20261120-1892-delta · 2026-11-20T21:54:49.828Z · commit b0188a93e6914acca6bd37f2a567638ea4257400
  - verified: rev-40 [reviewer] · run rev-40-20261120-1892-final2 · 2026-11-20T22:26:44.778Z · commit b0188a93e6914acca6bd37f2a567638ea4257400

## Dependencies

none; tracker `#stageCover`/`#stageCurrent`

## Comments

### impl-1892 · 2026-11-20T17:43:48.444Z

Consumer inventory (rules 20/41): tracker plan parser/setPlan, stage status/currency and persisted StageClosure; StageCandidates history index; Suite scheduler stageCovers/stageMissing, selection transport/parser/cache identity and command planning; dispatch verify admission/result summary; CLI verify parser/help and task plan show; MCP verify schema/pass-through; protocol validation and shared/wire declarations/conformance; hub/nvim/web plan readers (optional field additive; existing plans retain no-macos shape); stage-closure-component, planned-stage, stage-qa, stage-close scenario, suite-stage-cover/rules, suite-close-component, task-plan, epic-close, suite-selection, CLI help and frozen cli-usage/commands.json; plan-epic/qa skills and stage brief template, running.md, tests.md and hub README. Historical QA briefs and persisted legacy full-cover/closure records remain readable; full covers no longer satisfy an explicit targeted-path requirement. New --stage selector is additive; previous wire requests without it remain full local stage runs. No clause lines added, per launch brief.

### impl-1892 · 2026-11-20T18:08:16.608Z

Consumer follow-through: added suite-persistence.test.ts to the contract inventory (stageMissing literal assertions and archived summaries); its legacy cover-byte oracle is retained unchanged, while missing-platform expectations migrate to Linux-only. Full direct serial T1 selection: 237 files, 2017/2017 pass, zero skips on local macOS arm64 Node24.21.0. Earlier run retained four failures (2013/2017): own Web-mask interaction plus three superseded stageMissing expectations; affected rerun 187/187 pass. No configured verify or full Coordinator all receipt yet.

### impl-1892 · 2026-11-20T18:11:33.575Z

Native consumer checks: suite-selection.test.ts 161/161 pass; suite-stage-cover.test.ts final rerun 1/1 pass. First native stage attempt retained its changed immediate-closure assertion failure; fixed by waiting for durable closure. The successful stage rerun started at 1-minute load 12.42 (above the granted 12 bound); disclosed to Coordinator and excluded from timing claims. Native slot released. New fake-only selector test exercises MCP pinning; scripted fixtures now inject stageTree from candidate.tree so their guard catches no background native Git.

### rev-40 · 2026-11-20T18:19:53.607Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1892-source
commit: efb8cab095b54814c72da2bab038a0a5406045ca
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear: Standards0 findings; Spec0 findings. Linux-only after-stage cover, optional same-tree exact-path targeted macOS evidence, per-stage union pinning and exact executable plan/producer receipt validation reviewed. Full Mac map excludes targeted receipts; epic DoD close requires full Mac at accepted DoD tree. Plan changes invalidate closure hash; old closure/request shapes retained. C3 matching docs/help/frozen bytes/skills (with change records) verified. C1/C2 run-dependent marks remain pending ordinary configured verify plus Coordinator-required full all from this worktree at unchanged head. A-22209 selected local macOS Node24.21 proof is partial; disclosed12.42 load native rerun and earlier failures retained, no timing claim. Reviewer ran no tests/native/browser. Artifact records source review.

Criteria: C3 verified.

### rev-40 · 2026-11-20T18:40:36.923Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261120-1892-evidence1
commit: efb8cab095b54814c72da2bab038a0a5406045ca
scope: evidence
findings: [{"severity":"medium","text":"Stage-settlement consumer still waits for stage.state=open after a settled Linux cover, then adds Mac to close it. Linux-only closure makes that predicate impossible; A-22226 times out. Migrate setup/trigger to new policy while retaining pushed summary and fresh-snapshot equality assertions.","file":"hub/test/item-summary.test.ts","line":285}]
finding_counts: {"high":0,"medium":1,"low":0}

Full configured evidence not clear. A-22226/runf5e896c1-1874-482b-a7ab-4adb5ad492be fails at exact reviewed efb8cab095b54814c72da2bab038a0a5406045ca/tree2120149dfd87de13bb0754355d9821e031b0ff63. Actual output: 'linux cover is settled before observing the missing platform: not within 30000 ms'. Source item-summary.test.ts:280–292 supplies Linux then waits for open before adding Mac; this is a missed rule20 consumer of superseded two-platform closure. Retain its event-before-trigger and pushed-row/snapshot assertions while migrating boundary. C1 failed; C2 final remains pending, C3 source docs proof retained. T0/T1 exit0; T2 exit1; T3/Web unexecuted, T4 unexecuted. Producer header reports2023? No: aggregate6395 tests/6393pass/1fail/1skip; completed-before-interruption inventory6415/6408pass/1fail/6skip is separately scoped and not conflated. Linux c-8 ams3 Node24.21 workers2; browser binary/version null; Mac-only selector case skipped, not coverage. Noncached, host check at admitted tree not repeated remotely, budget advisories report-only. Fresh source review required after consumer correction; Reviewer ran no tests/browser.

Criteria: C1 failed (Missed item-summary settlement consumer still requires Mac after Linux and times out in configured full verify.).

### rev-40 · 2026-11-20T18:57:42.573Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1892-source2
commit: 2baa101846c3f7666b38afa600eaa1ba209108c2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear after the narrow consumer correction. Standards: no findings; Spec: no findings. item-summary now observes settled uncovered/open state before arming the observer and supplying Linux; pushed rollup, closed-stage counts and independent snapshot assertions remain. T3 suite-close now expects actual host-platform Linux completion/missing-Linux provenance; transfer/union/cleanup assertions remain. Reviewed A-22236 sweep dispositions and matching per-file guide. Production/docs implementation remains the prior reviewed design; C3 reverified at this head. C1/C2 run-dependent evidence remains pending the Coordinator-required full verify all retry. A-22226 remains failed evidence; selected local macOS checks are not a configured pass. Reviewer ran no tests/native/browser.

Criteria: C3 verified.

### rev-40 · 2026-11-20T20:36:21.218Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1892-final
commit: 2baa101846c3f7666b38afa600eaa1ba209108c2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, no findings. A-22259/run283d5414 binds reviewed head/canonical treebf227ef0ada8695824dcd66066a624b2351d747d; read-only tree comparison confirms only excluded tracker/rulebook paths differ. C1 positive finishes: exact targeted Mac union/receipt9134; publication landing+optional target/full/wrong-tree/wrong-path closure control28543; native-fixture Linux-only stage closure45348. Corrected item-summary settlement21655 and T3 suite-close union/summary44246 pass. C2 epic DoD missing/targeted/wrong-tree refusals and full-Mac acceptance16120 pass. C3 current-head source2 docs proof retained. Local-Mac MCP selector is skipped on Linux, not passed; unchanged selector has retained selected local Mac preview evidence A-22209, while completion/closure controls above use explicit simulated receipts. Configured full T0/T1/T2/T3/Web exit0,9307tests9294pass13skip0fail/cancel; T4 unexecuted. Twelve other skips are platform/prerequisite cases; repeated selector load-gate skip rows are not extra base skips. Noncached Linuxx64 c-8ams3 Node24.21.0 Nvim0.12.5; Web Headless Shell1248/CfT156.0.8078.4. Host gate not repeated remotely; budgets/lint report-only, no performance clearance. A-22226 remains failed old-head evidence. Reviewer ran no tests/native/browser.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-40 · 2026-11-20T21:54:49.828Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1892-delta
commit: b0188a93e6914acca6bd37f2a567638ea4257400
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Conflict-only merge delta clear, Standards0/Spec0 findings. Parents2baa10184/e569ca6f2 confirmed; Coordinator066f925e/6947d90f authorizes mode-free verification after delta review, no repeat full suite. Three conflict resolutions retain targeted Mac handling ahead of whole-selection guard, then require whole selection on job/cache source; targeted receipts remain separate from full DoD proof. Both stageTargets and batchTests.T3 retained in hub/wire types; diagnosticTestFile remains shared. Incoming T-1655 classification retained. Tracker/plan stage/DoD code/tests unchanged; C3 docs/skills remain consistent and reverified. A-22277 local macOSNode24.21 T1/T2 plus granted serial native selected checks/lint/typecheck are partial, not new-head configured proof. C1/C2 final await authorized mode-free result at this head; A-22259 remains old-head full pass, A-22226 failed. Reviewer ran no tests/native/browser.

Criteria: C3 verified.

### rev-40 · 2026-11-20T22:26:44.778Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1892-final2
commit: b0188a93e6914acca6bd37f2a567638ea4257400
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head clear, no findings. Authorized mode-free runef9634ee/A-22281 binds reviewed head/canonical tree9ac3ecd5bcc0eb8fd89947345c43116b5c4d8cde; read-only comparison confirms only excluded tracker/rulebook paths differ. Positive structured finishes verify target union/exact receipts9345, optional-target/publication closure28981, full-Mac DoD refusal/acceptance16347, pushed summary21895, native-fixture Linux closure37531/union37333. Incoming partial-mask refusal1465,restart8907,periodic partial-batch14444/fresh-cover14448 pass. C3 current-head delta docs proof retained. T0/T1/allfallbackT2/Web exit0; selectedT3 14files163identities andselectedT4 1file1identity once/no repetitions, not fullT3/T4. RemainingT3 batch,remainingT4 unexecuted. Aggregate7415pass1Mac-only-selector skip0fail/cancel; repeated skip rows not extra base tests. Noncached Linuxx64 c-8ams3 Node24.21.0 Nvim0.12.5, Web Headless Shell1248/CfT156.0.8078.4. Injected/simulated OS receipts are not real Mac/provider deployment proof. Coordinator066f925e/6947d90f replaces full retry with mode-free for this conflict-only merge; A-22259 old-head full pass/A-22226 failure retained. Host check not repeated remotely, budgets/lint report-only, no performance claim. Reviewer ran no tests/native/browser.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-20T23:14:06.754Z

Merged 7dfafa84fbdd6d69e7b742cc8582d796268db8e4 onto dev.
