---
id: T-1058
kind: task
title: The card's facts in the item summary
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by:
  - T-1052
topic: topic-817
branch: t/T-1058-the-card-s-facts-in-the-item-summary
created: 2026-10-21T14:04:18.959Z
updated: 2026-10-21T21:51:22.792Z
closed: 2026-10-21T21:51:22.792Z
---

## Summary

Put a card's facts into the item summary so no client needs a `task.view` per card or a `task.plan show` per epic row.

## Parent

E-413 (§3.3 "The card's facts in the snapshot and the deltas"; tracer step 1).

## What to build

The item summary in the snapshot and the deltas also carries: the latest verdict's one-line reason, round and scope; the Decision block; for an epic with a plan, each stage's state; and the sections and size of the agents' text, for its fold line. The full body and the comments still come only when the human opens the agents' text. `nvim/lua/cland/explorer_card.lua` defines what the card shows.

## Acceptance criteria

- [x] C1. A frame client reads a task's latest verdict reason, round and scope and its Decision block from the snapshot, with no `task.view` (test).
  - verified: rev-31 [reviewer] · run rev-20261021-1058-modefree · 2026-10-21T19:34:58.702Z · commit dc8467580a50772e34d205964d555f2e80b33607
  - done: impl-1058 · 2026-10-21T20:54:25.941Z
  - verified: rev-31 [reviewer] · run rev-20261021-1058-modefree-2 · 2026-10-21T21:04:33.845Z · commit c615fc21b73bb9c245b83e00c576b3c4b085e820
  - verified: rev-31 [reviewer] · run rev-20261021-1058-final · 2026-10-21T21:46:21.497Z · commit c615fc21b73bb9c245b83e00c576b3c4b085e820
- [x] C2. A frame client reads each stage's state for an epic with a plan from the snapshot, with no `task.plan show`, and a stage change arrives as a delta (test).
  - verified: rev-31 [reviewer] · run rev-20261021-1058-modefree · 2026-10-21T19:34:58.702Z · commit dc8467580a50772e34d205964d555f2e80b33607
  - done: impl-1058 · 2026-10-21T20:54:25.962Z
  - verified: rev-31 [reviewer] · run rev-20261021-1058-modefree-2 · 2026-10-21T21:04:33.845Z · commit c615fc21b73bb9c245b83e00c576b3c4b085e820
  - verified: rev-31 [reviewer] · run rev-20261021-1058-final · 2026-10-21T21:46:21.497Z · commit c615fc21b73bb9c245b83e00c576b3c4b085e820
- [x] C3. The summary carries the agents' text sections and size but never the full body or comments, and a thousand-item snapshot stays within T-1038's startup reply budgets (test).
  - done: impl-1058 · 2026-10-21T20:54:25.986Z
  - verified: rev-31 [reviewer] · run rev-20261021-1058-final · 2026-10-21T21:46:21.497Z · commit c615fc21b73bb9c245b83e00c576b3c4b085e820
- [x] C4. `hub/README.md` lists the card fields.
  - verified: rev-31 [reviewer] · run rev-20261021-1058-source-2 · 2026-10-21T19:09:27.466Z · commit bd5342b452deee9f39605424913b53d5284913db
  - verified: rev-31 [reviewer] · run rev-20261021-1058-source-3 · 2026-10-21T19:16:35.220Z · commit e37316e5b4218affb57a0511fd7bef7d30fc21e7
  - verified: rev-31 [reviewer] · run rev-20261021-1058-source-4 · 2026-10-21T19:26:11.667Z · commit dc8467580a50772e34d205964d555f2e80b33607
  - verified: rev-31 [reviewer] · run rev-20261021-1058-modefree · 2026-10-21T19:34:58.702Z · commit dc8467580a50772e34d205964d555f2e80b33607
  - done: impl-1058 · 2026-10-21T20:54:26.010Z
  - verified: rev-31 [reviewer] · run rev-20261021-1058-source-5 · 2026-10-21T20:55:31.503Z · commit c615fc21b73bb9c245b83e00c576b3c4b085e820
  - verified: rev-31 [reviewer] · run rev-20261021-1058-modefree-2 · 2026-10-21T21:04:33.845Z · commit c615fc21b73bb9c245b83e00c576b3c4b085e820
  - verified: rev-31 [reviewer] · run rev-20261021-1058-final · 2026-10-21T21:46:21.497Z · commit c615fc21b73bb9c245b83e00c576b3c4b085e820
- [x] C5. Each stage of an epic with a plan carries merged/total counts that include closed members, and Neovim's stage counters (plan.lua progress, the card's current-stage "X of N merged", listed by T-1061 in its topic) read them instead of loaded rows (tests).
  - verified: rev-31 [reviewer] · run rev-20261021-1058-modefree · 2026-10-21T19:34:58.702Z · commit dc8467580a50772e34d205964d555f2e80b33607
  - done: impl-1058 · 2026-10-21T20:54:26.031Z
  - verified: rev-31 [reviewer] · run rev-20261021-1058-modefree-2 · 2026-10-21T21:04:33.845Z · commit c615fc21b73bb9c245b83e00c576b3c4b085e820
  - verified: rev-31 [reviewer] · run rev-20261021-1058-final · 2026-10-21T21:46:21.497Z · commit c615fc21b73bb9c245b83e00c576b3c4b085e820

## Comments

### impl-1058 · 2026-10-21T18:51:14.751Z

Implemented card metadata and complete stage counts through the existing projection. Local Darwin arm64 TDD: frame test red on missing verdict reason, then 7/7 targeted passing including two stages and mutation deltas. Neovim red showed 0/3 merged (loaded); corrected plan/explorer/card now use per-stage merged/total/status histogram including unloaded closed members, with a 2/3 delta regression. The copied-live Lua guard caught snapshot.refused at 1,049,845 > 1,048,576 bytes; bounded previews (96-code-point verdict sentence; 300-code-point Decision summary) now fit that copied fixture at 1,035,503 bytes with 0 Lua differences. Existing startup guard now includes card facts and retains all eight reply budgets plus the full items snapshot cap. Docs and affected fixtures are being finalized before source review. No queued suite or QA pass claimed.

### rev-31 · 2026-10-21T19:03:38.455Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261021-1058-source-1
commit: 9836b51cb363922e8d8a6a043e373268913d089a
scope: full
findings: [{"severity":"medium","text":"M1: closed projection removes verdict scope, but #announce uses that projection for verdictIdentity comparisons, whose identity includes scope. Closing or reopening scoped verdict history re-emits unchanged historical verdicts as newly posted subscription events. Preserve canonical notification identities and regress both transitions while retaining closed-payload compaction.","file":"hub/src/tracker/tracker.ts","line":2060}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review not clear at 9836b51c. Standards: 0 findings; Spec: M1 medium. A-8637 records source trace, criteria coverage and qualified A-8632/A-8633 local targeted evidence. No reviewer tests run; no queued/full pre-merge pass claimed. Correct source and request fresh review before verification.

Criteria: C1 failed (M1: state-only close/reopen changes scoped verdict identities and emits false newly posted verdict events; needs regression and correction before verification.).

### impl-1058 · 2026-10-21T19:08:39.100Z

Fixed review M1 in bd5342b452deee9f39605424913b53d5284913db (tree 276a361fd59baf2b95f522ea8b3acf181f8f2464), pushed to origin; no dev merge after the first source review. Separate canonical verdict baselines now drive notification identity while closed row compaction remains unchanged. Retained original red/green logs in A-8641: red 122.210375 ms emitted two false historical verdict posts; targeted green 139.925625 ms. Local Darwin arm64 pre-commit working-tree checks (committed unchanged): frame file8/8, events7/7, default subscriptions8/8, npm check exit0 (lint report-only132/59,0 refusals). Regression also confirms bounded closed by-id facts and one genuine scoped-verdict delivery. Requesting fresh source review before queued verification; earlier 9836b51c evidence remains historical.

### rev-31 · 2026-10-21T19:09:27.466Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1058-source-2
commit: bd5342b452deee9f39605424913b53d5284913db
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M1 resolved by canonical verdict notification baselines separate from closed client payloads. Regression covers no false close/reopen events/messages, bounded closed hydration and one genuine new scoped-verdict delivery. A-8642 carries Standards/Spec review and qualified original local receipts A-8641. C4 source verified; C1/C2/C3/C5 runtime settlement awaits exact-head mode-free verification and Coordinator-required full pre-merge verify all. No queued/Linux/QA pass claimed; no merge enqueue.

Criteria: C4 verified.

### rev-31 · 2026-10-21T19:13:22.237Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261021-1058-evidence-1
commit: bd5342b452deee9f39605424913b53d5284913db
scope: evidence
findings: [{"severity":"medium","text":"M2: same-head gate fails because this carrier expects original round on closed summary rows, contradicting approved closed-card by-id deferral. Reconcile open/closed assertions and retain payload budgets, default-list, latest-run and blocker controls.","file":"hub/test/tracker-summary.test.ts","line":173}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear: A-8653 audits failed Linux exact-head run 6ae5d42b/A-8652 (711 reported,710 pass,1 fail). T1 failed; later T2/Web did not establish passes; T3 deferred. Failure is a stale round assertion, not byte budget. C4 source verification retained; final runtime criteria and Coordinator full pre-merge gate remain pending. Fresh source review before another verify.

Criteria: C3 failed (Exact-head run 6ae5d42b/A-8652 failed at tracker-summary.test.ts:173 (undefined !== 3); reconcile closed-card carrier and obtain replacement verification.).

### impl-1058 · 2026-10-21T19:16:01.599Z

M2 corrected in test-only head e37316e5b4218affb57a0511fd7bef7d30fc21e7 (tree b8e115d92c977e732d7c94aecf6e9b6f6fa526b8), pushed. Original local red undefined!==3 and green complete tracker-summary11/11 plus checkexit0 are retained in A-8655 with source attribution. Preserved old open/list/budget/blocker controls; all900 closed rows must omit card facts and restore round3/r3/reason/outline through bounded by-id pages. Audited hub/test+nvim/test for further closed metadata assertions; no additional stale expectations found. Failed task6ae5d42b/A-8652 and Coordinator-cancelled full0b2f2087/A-8656 remain historical, not passes. Fresh source review precedes replacement verify.

### rev-31 · 2026-10-21T19:16:35.220Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1058-source-3
commit: e37316e5b4218affb57a0511fd7bef7d30fc21e7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at e37316e5. M2 carrier reconciled with approved closed-card boundary while retaining default-list/open budget/latest verdict/exclusion/criteria/blocker controls and adding all-900 bounded hydration assertions. Runtime source unchanged; M1 remains fixed. A-8659 records review and qualified A-8655 local red/green/check receipts. C4 source verified at current head. C1/C2/C3/C5 remain pending exact-head mode-free gate and Coordinator-required full pre-merge verification; prior failed/cancelled runs are not passes.

Criteria: C4 verified.

### rev-31 · 2026-10-21T19:23:39.297Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261021-1058-evidence-2
commit: e37316e5b4218affb57a0511fd7bef7d30fc21e7
scope: evidence
findings: [{"severity":"medium","text":"M3: old global prose-exclusion assertion rejects approved latest-verdict reason preview because the fixture's entire latest comment is the same excluded string. Separate allowed first-sentence preview from unique private suffix/history and retain payload/domain/budget controls.","file":"hub/test/connection-snapshot.test.ts","line":102}]
finding_counts: {"high":0,"medium":1,"low":0}

A-8663 audits failed exact-head Linux gate: T1 green, T2 failed, Web unexecuted, T3 deferred. Both item-summary new identities genuinely passed 5/5 load repetitions, but overall gate remains failed. No new production defect inferred; M3 carrier correction needs source review. C4 source verification retained; runtime/full pre-merge settlement pending.

Criteria: C3 failed (Exact-head 311115c1/A-8662 failed at connection-snapshot.test.ts:102; reconcile preview/privacy carrier and obtain replacement gate.).

### impl-1058 · 2026-10-21T19:25:44.480Z

M3 corrected in test-only dc8467580a50772e34d205964d555f2e80b33607/tree6b25a5b6, pushed; no runtime/cap/tier/allowance changes or dev merge. Carrier splits visible first-sentence reasons from unique private tails/history, asserts exact latest reason3/r3/round3 plus absence of full body/comments/history, and keeps all complete comments on task.view. Original local red88.898667ms, complete file12/12 (case54.814417ms), checkexit0 and prose-exclusion audit retained in A-8666. Audit found no other whole-latest-comment negative sentinel; body/private-tail and unrelated-carrier sentinels remain correct. Failed311115c1/A-8662 remains failed; source review precedes next mode-free run. Coordinator's full run is held until corrected head after T-1067/T-1050.

### rev-31 · 2026-10-21T19:26:11.667Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1058-source-4
commit: dc8467580a50772e34d205964d555f2e80b33607
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; M3 resolved by separate latest visible reason/private tails/history assertions. Original snapshot domain/byte/recent-topic/run/round/full-view controls remain; no runtime/cap/tier/allowance change. A-8667 records review and qualified A-8666 targeted local evidence. C4 refreshed; C1/C2/C3/C5 await exact-head mode-free and Coordinator-required full pre-merge verification. Prior failed/cancelled runs remain historical.

Criteria: C4 verified.

### rev-31 · 2026-10-21T19:34:58.703Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1058-modefree
commit: dc8467580a50772e34d205964d555f2e80b33607
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Intermediate mode-free evidence clear, not final settlement: exact-head62922bd8/A-8674 exit0, reported2340/2340,no skips; Linux T1/fullT2/Web all0. Three task-new identities have actual five-distinct passing test receipts and explicit5/5; max.325/.425/.629s. Prior failing carriers pass. A-8675 records platform/phases/report-only limits. C1/C2/C4/C5 verified; C3 current-head startup/copy-Lua T3 and Coordinator-required full pre-merge verify all remain pending. No merge enqueue.

Criteria: C1 verified, C2 verified, C4 verified, C5 verified.

### rev-31 · 2026-10-21T20:45:54.770Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261021-1058-full-evidence-1
commit: dc8467580a50772e34d205964d555f2e80b33607
scope: evidence
findings: [{"severity":"medium","text":"Required full gate fails hard first-status guard:15911.2ms>15000ms, aborting before startup byte/snapshot controls. Head/base comparison directed by Coordinator is pending; no production cause or load-outlier classification established.","file":"hub/test/startup-replies-scale.test.ts","line":82}]
finding_counts: {"high":0,"medium":1,"low":0}

A-8706 audits exact-head failed full gate:3424reported/3418pass/1fail/5skip,T1/T2green,T3failed,Webunexecuted. Current-head copied-Lua0differences/850419bytes passed independently. Prior mode-free A-8674 remains green; C1/C2/C4/C5 marks retained. Coordinator031528f9 authorized serial3head/3dev scratch comparison; no causal finding or relaxed limit assumed. C3/final settlement not clear; no merge enqueue.

Criteria: C3 failed (Required full468d3012/A-8705 failed first-status15000ms guard before startup byte/snapshot assertions; investigation and replacement full evidence pending.).

### impl-1058 · 2026-10-21T20:54:25.924Z

Addressed full-gate startup failure in c615fc21b73bb9c245b83e00c576b3c4b085e820/tree559f0f35, pushed; no dev merge. Directed serial3head/3base comparison and normalized fixture/profile evidence retained in A-8707. Original head median3595.678ms; base2014.581ms, but same rich fixture base3267.944ms. Stage summaries repeated child hydration; fix reuses member reads for status counts and avoids unnecessary direct-parent ancestry walks, preserving closure hash and all startup bounds. Fixed rich-fixture head median3284.858ms vs normalized base3260.812ms (+0.7%). Local sealed macOS arm64 current-source validation: startup1/1 (first completed status3286.8ms, startup468514B, snapshot581678B), item-summary8/8, planned-stage12/12, stage-closure5/5, npm check exit0 (report-only lint132/59,0 refusals). Two corrected scratch setup failures explicitly recorded in A-8707. These are targeted pre-commit byte-matched checks, not queued/Linux passes. Fresh source review precedes replacement mode-free run; Coordinator-required full remains pending.

### rev-31 · 2026-10-21T20:55:31.503Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1058-source-5
commit: c615fc21b73bb9c245b83e00c576b3c4b085e820
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at c615fc21: stage statuses reuse existing member reads, direct-parent membership bypass preserves ancestry semantics, closure-hash inputs unchanged. Test only adds completed-status diagnostic; all bounds/rich fixtures remain. A-8709 supersedes A-8708's minor normalized-base median transcription error and records source reasoning, hash-matched scratch receipts and local comparison limits. C4 refreshed; runtime C1/C2/C3/C5 and required full pre-merge gate need new-head evidence. No Linux/full pass or load-outlier classification claimed.

Criteria: C4 verified.

### rev-31 · 2026-10-21T21:04:33.845Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1058-modefree-2
commit: c615fc21b73bb9c245b83e00c576b3c4b085e820
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Intermediate evidence clear: exact-head756377d7/A-8710 exit0,2340/2340,no skips,LinuxT1/fullT2/Weball0. Audited actual5distinct passing test repetitions plus5/5receipts for three task-new identities,max.349/.357/.671s. A-8711 records phase/platform/report-only limits. C1/C2/C4/C5 refreshed; C3 startup/copied-Lua and Coordinator-required full pre-merge verification remain pending. No final merge-ready approval.

Criteria: C1 verified, C2 verified, C4 verified, C5 verified.

### rev-31 · 2026-10-21T21:46:21.497Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1058-final
commit: c615fc21b73bb9c245b83e00c576b3c4b085e820
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear C1–C5 at unchanged c615fc21/tree559f0f35. A-8723 audits required full431447dd/A-8722:3576pass/8unrelated-platform skips/0fail,T1/T2/T3/Weball0. Startup first-status12421.2ms<15000; reached byte assertions461204B replies/581678B snapshot. Copied-Lua850419B,1081+3rows,0differences. Same-head mode-free A-8710 and actual three5/5groups retained. Report-only timing/lint limits qualified; stronger<10s target assigned T-1081 by Coordinator8ad1ec2a. No QA/T4 or remote-hostcheck-rerun claim; no enqueue/merge.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-21T21:51:22.792Z

Merged 6a2c707ef71e9ff9cf26d6795daaa7801ba9b39c onto dev.
