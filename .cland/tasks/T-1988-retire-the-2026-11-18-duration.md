---
id: T-1988
kind: task
title: Retire the 2026-11-18 duration allowances for T-1646 and T-1984's synthetic-tracker cases by making their fixture setup cheap, before they expire on 2026-11-25
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1882
blocked_by:
  - T-1646
  - T-1984
topic: topic-1641
branch: t/T-1988-retire-the-2026-11-18-duration
created: 2026-11-18T20:41:33.453Z
updated: 2026-11-19T11:50:26.476Z
closed: 2026-11-19T11:50:26.476Z
---

## Summary

On 2026-11-18 three exact-case C-216 duration allowances were added so the hub CPU fixes could land quickly. All expire 2026-11-25, and an expired allowance fails every suite (T-1879).
- T-1646 C1: `hub/test/tracker-summary.test.ts` "ten moving branches in a 1650-item tracker …", 8.5 s (droplet 5.553 s).
- T-1646 C2: the item-summary-scale responsiveness case, 19 s (local 8.9 s, ×1.4 droplet ratio).
- T-1984 C1: `hub/test/stage-closure-component.test.ts` "unrelated freshness answers do not fan out to stage-cover dependents", 16 s (droplet 10.381 s).
Each time goes into building a 1,500–1,650-item synthetic tracker, not the asserted work.

## What to build

Build these synthetic trackers cheaply: one owned transaction with reused prepared statements (T-1807's corpus went from 8.6 s to under 1 s this way), or a shared seeded fixture per file. Keep every work-count bound, oracle and behaviour bound unchanged, then remove the three allowances.

## Acceptance criteria

- [x] C1. Each of the three cases runs under its normal duration budget on a droplet verify, with its assertions unchanged (evidence).
  - verified: rev-35 [reviewer] · run rev-35-1988-evidence-2 · 2026-11-19T05:10:30.729Z · commit b6771c097dc88c9e5255d54c8c50e8d36f87ba89
  - done: impl-1988 · 2026-11-19T05:11:16.698Z
  - verified: rev-35 [reviewer] · run rev-35-1988-evidence-3 · 2026-11-19T09:34:41.440Z · commit 6caa89ac80d237de897e320fd91c06c6bf18f39d
- [x] C2. The three allowances are removed from `hub/test/durations.json` before 2026-11-25 (test: the duration lint passes without them).
  - done: impl-1988 · 2026-11-19T02:50:18.550Z
  - verified: rev-35 [reviewer] · run rev-35-1988-source-2 · 2026-11-19T03:37:27.199Z · commit 3eebc59cbb1275fa81855df6f58b0c83074915ae
  - verified: rev-35 [reviewer] · run rev-35-1988-source-3 · 2026-11-19T04:36:34.612Z · commit b6771c097dc88c9e5255d54c8c50e8d36f87ba89
  - verified: rev-35 [reviewer] · run rev-35-1988-evidence-2 · 2026-11-19T05:10:30.729Z · commit b6771c097dc88c9e5255d54c8c50e8d36f87ba89
  - verified: rev-35 [reviewer] · run rev-35-1988-delta-1 · 2026-11-19T09:03:03.603Z · commit 6caa89ac80d237de897e320fd91c06c6bf18f39d
  - verified: rev-35 [reviewer] · run rev-35-1988-evidence-3 · 2026-11-19T09:34:41.440Z · commit 6caa89ac80d237de897e320fd91c06c6bf18f39d

## Comments

### coord · 2026-11-19T02:34:03.237Z

Reported by impl-1952 during T-1952 (2026-11-19): the generated-stanza paragraph in docs/agents/tests.md tells you to name the nearest open container as the allowance owner. Admission refuses epic owners and requires a standing container such as E-880; the lint said "duration allowance has epic owner E-1883 ... use a standing container". The printer guidance this item adds must name a standing container, and the docs paragraph should match.

### coord · 2026-11-19T02:34:25.811Z

Correction to my earlier comment: the printer and docs mismatch is filed as its own item, T-1993 (Bugs). T-1988's scope is unchanged.

### impl-1988 · 2026-11-19T02:44:34.874Z

Implementation: each churn file owns a separate scratch root and single-consumer tracker/hub; seed/acquisition/initial warm refresh are file setup, observed moved-tip refresh and all 40 reply rounds remain in callbacks. Coordinator confirmed this scope in 70fd9651. Stage case batches 16 file writes and uses shared seedTransaction around public rescan, restoring methods before settlement observation. Existing assertions/work-count/oracle/behaviour bounds unchanged. Shared helper consumers searched: tipChurnFixture only tracker-summary and item-summary-scale; seedTransaction only fixture and stage case; no production/wire contract changes. Three exact allowances removed, unrelated allowances untouched. Local darwin/arm64 Node24.21: full tracker-summary 23/23, file4.531s (case0.106s); item-summary-scale4/4, file19.323s (case0.915s); stage-closure11/11 file5.490s (case2.392s). These are targeted local evidence, no browser, not droplet criterion proof. Broken controls: broad invalidation fails summary bound 3300>100 (hydrated8400>400); per-answer fan-out fails 1500>1; three 1100ms delayed task.view replies fail p95 at1118.466ms. All temporary production edits restored. Lint/typecheck and source review pending; droplet verification awaits source verdict/window.

### impl-1988 · 2026-11-19T02:49:29.083Z

Local evidence published after the shared scan-and-publish helper's positive-control scan: A-21502, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21502-t-1988-local-fixture-validation-and-broken-controls.md. Final source typecheck passed. Individual cases also pass in reverse file order with separate roots/processes; artifact records case and whole-file scopes, platform, ambient loads and expected broken controls. No droplet or browser evidence claimed. Current origin/dev fetched and merged again, already up to date. Final test:lint rerun is still completing; source review follows it. C1's droplet evidence remains pending.

### rev-35 · 2026-11-19T02:57:51.815Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1988-source-1
commit: ee5d780d769cfefdc5a0fc6a110344027a70d452
scope: full
findings: [{"severity":"medium","text":"Standards M1: file after/resource hooks do not bound and join original top-level seed/start/warmup plus raw-t churn callbacks before teardown; trace/socket hooks remain TestContext-owned, and fixtureNativeGuard restores after rejected resource cleanup. The new file lifetime needs pre-acquisition original-work ownership and positive closure fencing for roots/seams/guard, with failure-path receipts.","file":"hub/test/tip-churn-file-fixture.ts","line":10},{"severity":"medium","text":"Standards M2: openDatabase can capture a native connection before Tracker construction rejects, while the pre-enrolled closer only calls acquired?.stop(); no fallback closes the unassigned owner's DB. tracker-summary.test.ts:28–30 also constructs before resource registration. Pre-own connection/partial acquisition and prove native close/root ordering on constructor rejection.","file":"hub/test/stage-closure-component.test.ts","line":39}]
finding_counts: {"high":0,"medium":2,"low":0}

Full first source NOT CLEAR at clean ee5d780d769cfefdc5a0fc6a110344027a70d452, tree cb3b909b88bc54f4075733d06f364a0d3b61a0a5, base 3e99d425b. Standards two medium findings; Spec no source findings, runtime C1 pending. Author 6b5cf1e0 confirms both ownership gaps/no exemption. A-21512 gives the bounded correction bar. Exactly three allowances removed, all remaining manifest data unchanged and no assert expressions changed. Authorized file setup and reused seed transaction are accepted subject to ownership fixes. Primary Coordinator a6731e96 explicitly sets C1's enforcing per-case cap to five seconds; tier budgets remain report-only and before/after whole-process droplet file elapsed must be disclosed, with no runner change. C1 failed this source pass; C2 implementation-done remains intact but no criterion verified. A-21502/local full-file checks include earlier working-tree epochs; later standalone/final tracker checks and lint/typecheck remain precommit, with missing invocation hashes/native/raw-scan fields unknown. Broken-control failures retained; no droplet/configured proof. Hold released for consolidated correction and fresh fixed-head source review before verification. Reviewer ran no tests/probes or source mutations.

Criteria: C1 failed (Changed fixture setup/callbacks lack bounded original-work and positive cleanup ownership; captured SQLite connections lack constructor-rejection fallback closure.).

### impl-1988 · 2026-11-19T03:30:06.341Z

A-21512 M1/M2 corrected and committed/pushed at 3eebc59cbb1275fa81855df6f58b0c83074915ae, tree90a7e6d81892c7052727e0e90aac2f5cbc908aad, sole parent ee5d780d7/no dev merge. One stageCase-owned sequence spans setup→warmup→callback; owned after-hooks plus positive resource closure fence root/control cleanup. ownedDatabases pre-enrolls seed and constructor connections; returned Tracker stops before any close authority; construction rejection has captured-native fallback; native primary error survives ancillary cleanup failure. Five actual owner regressions cover held setup/callback, rejected-close retention, constructor failure and rejected-then-confirmed fallback. Final T1 full28/28, case.219925s/file11.772381s, Node24.21/darwin-arm64, no browser. T2 full4/4 and11/11 at tree720455c1 (only final T1 SQL alias name differs), case.753044s/file23.373643s and3.830931s/file7.696483s; reverse-order singles passed there. Final full typecheck and npm run test:lint exit0 at final tree, zero refusals/130 existing report-only findings. Scope/source epochs, outage incomplete rounds, own injection failure and prior controls preserved in A-21534 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21534-t-1988-ownership-correction-source-epochs-and-retained-outcomes.md). Scan helper initially refused machine paths, export prefixes redacted, rescan/publish exit0. Historical droplet whole-file frames retained for eventual before/after disclosure: A-21424 tracker11.678078s and item-scale32.563212s; A-21412 stage16.180096s (failed overall suite, not relabelled green). C1 remains pending exact reviewed-head droplet cases<5s; stage advisory T2>2s disclosed. Fresh source review follows; no verify queued.

### rev-35 · 2026-11-19T03:37:27.199Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1988-source-2
commit: 3eebc59cbb1275fa81855df6f58b0c83074915ae
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source CLEAR at clean3eebc59cbb1275fa81855df6f58b0c83074915ae, tree90a7e6d81892c7052727e0e90aac2f5cbc908aad; sole parentee5d780d7/no dev merge. Standards clear; Spec clear; no findings. A-21536 records closure of M1/M2: one stageCase original sequence spans admission/setup/warmup/callback, callback after-hooks remain owned, roots/guard/seams require positive resource closure; ownedDatabases pre-enrolls captured connections and ownedTracker transfers stop authority only after construction returns, with constructor fallback and remaining-open refusal. Five real-cleanup controls establish late-work joining, separate root/control/seam retention and confirmed native DB closure. Original assertions/oracle/work/behaviour bounds unchanged; exactly three allowances removed, other manifest sections/allowances unchanged. C2 verified from removal and final-tree lint/static evidence. Prior C1 ownership failure addressed, but C1 remains unverified pending actual same-head droplet cases<5s and full-file disclosure under primarya6731e96; advisory T1/T2/file overages remain labelled. A-21534 final T1 28/28/full static0 at90a7e6d8 and T2/reverse-order receipts at720455c1 retain distinct scopes; immutable diff is only a bound-SQL alias in a T1 fault control. Historical droplet file frames and failed/incomplete/control epochs preserved. Primary48e0403e assigns unchanged seed-finally masking aside to T-1995, no T-1988 edit. Source clear permits configured verification at this exact head under Coordinator window; no production/runner/tier/config redesign. Reviewer ran no tests/probes or source mutations.

Criteria: C2 verified.

### impl-1988 · 2026-11-19T04:19:28.575Z

Why configured run2a7dc921 is green at stage6.866027859s without its allowance (retained-source audit at unchanged3eebc59c, no probe): hub/test/durations.json budget.mode is report, generic testSeconds5, T2.testSeconds2. The exact stage identity is already in manifest.tests at9.120065s (line13073); its allowance is absent. In hub/src/suite-durations.ts:99–123 checkDurations uses report-mode compare: above generic5 with an existing baseline appends regressions[], while failures[] gets an above5 entry only when the identity has no baseline. It does not detect changed callback source for that generic cap; identity is file::name. The run-suite caller emits regressions as diagnostics and gates on failures. Thus this already-baselined T2 identity has NO enforcing five-second duration check in this run. durationBudgetReport separately prints the T2 over2 report-only advisory, as A-21558 does. Tier/file budgets remain report-only; no policy/runner/allowance change requested. C1 nevertheless remains the explicit under5s acceptance criterion by Coordinator a6731e96/ea64fb30, independent of configured exit0; it is NOT done. Coordinator approved moving unobserved stage setup into the positive file owner only AFTER the Reviewer consolidated verdict, while keeping counted1500-answer drain, active-cover observations, exact assertions and alone/reverse independence proof inside; no source/experiment change yet. Next droplet must prove stage under5s; any5–6s outcome will be reported before further action.

### rev-35 · 2026-11-19T04:20:47.594Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1988-evidence-1
commit: 3eebc59cbb1275fa81855df6f58b0c83074915ae
scope: evidence
findings: [{"severity":"medium","text":"Spec: A-21558:29249/29250 records the target stage case passing assertions at6.866027859s, exceeding the explicit under5s C1 acceptance bar. Autoexit0/6904passes remain valid suite facts; they do not prove C1. Other targets0.356969730s and1.003168406s pass the bar. Preserve this sample and the file envelopes; apply only the Coordinator-approved bounded setup correction after this verdict, with no new allowance/baseline change.","file":"hub/test/stage-closure-component.test.ts","line":21}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence NOT CLEAR at unchanged clean3eebc59cbb1275fa81855df6f58b0c83074915ae/tree90a7e6d8. A-21562 preserves GREEN configured2a7dc921/A-21558(autoexit0,6904 ordinary/721files plus separate235load test/file passes), one medium Spec criterion miss, no new Standards/high/low finding. Three C1 bases.356969730/1.003168406/6.866027859s; oracle1650/10/30summaries80hydrated and40+40replyp95~36ms assertions intact. All5 new owner controls ordinary+5/5 load pass; actual3target identities have ordinary samples only. Required whole-file disclosures retain prior11.678078/32.563212/16.180096s versus current11.434751/31.604802/12.704881s, different historical heads/case composition; no controlled speedup or failed-old-suite promotion. T0/T1/allT2 incl44nvim385cases/Web exit0; T3batch-deferred,T4unexecuted. Uncached Linuxx64/Node24.21/HeadlessShell1248 Chrome156; snapshot6dcff467 differs from Git90a7. Static explanation independently read: suite-durations.ts:103-123 compares report-mode known stage identity against baseline9.120065 (durations.json:13073), routes its above-generic5 sample to regressions; run-suite.ts:383-386 gates failures, and T2 2s is advisory. Thus no enforcing5 runner check fired for this known identity; item-specific C1 remains explicit under5. C2 source2 verification/removal/lint remains current, no new criterion verified. Hold released: Coordinatorea64fb30 authorizes only unobserved stage seed/acquisition/warmup into its positive file owner, preserving counted1500answer drain/active-cover observations/every assertion plus alone/reversed proof, no allowance. Primary75b9d3f reserves baseline lowering to Coordinator after a qualifying sample; leave baseline untouched and report actual sample. Fresh changed-head source review then window; if5–6s report before more work. Reviewer no runtime/probe/source mutation.

Criteria: C1 failed (Green configured2a7dc921 records stage case6.866027859s, above the explicit under5s C1 bar; other targets.356969730s/1.003168406s are below5.).

### impl-1988 · 2026-11-19T04:34:16.651Z

After consolidated A-21562 and Coordinator ea64fb30/75b9d3f, bounded stage setup move committed/pushed at b6771c097dc88c9e5255d54c8c50e8d36f87ba89, tree2a5093ab0f9dd0e90a4e32f25d6ea1772032f670, sole parent3eebc59c/no dev merge. Only stage test+guide changed; no allowance, baseline, helper, runner, tier or production edit. Same positive file owner spans acquisition/initial refresh/1500-row seed, fake watcher leaves explicit rescan. Active-cover observation, counter reset/branch transition, counted1500-answer drain and both exact assertions remain inside callback. Restore follows run's positive-close hook. Local macOS/Node24.21 full stage11/11 case1.725165s/file7.447704s, separate stage2.427996s/file5.017469s and post-control1.892637s/file4.311147s. Reverse-file-order standalone stage/reply/tracker pass; tracker full28/28 including5owner controls, full typecheck and full npm run test:lint pass (130 existing report-only findings,0refusals). Fresh broken fanout producer fails original assertion1500>1; native production byte copies restored with matching SHA256s, no production diff. A-21568 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21568-t-1988-stage-file-setup-relocation-and-fresh-counter-control.md holds exact source/load/scoped times, counter control and restoration hashes (scan helper clean/published). Prior configured2a7dc921 remains green6904/6904 but C1 failed at6.866027859s; no prior receipt relabelled. New C1 droplet proof is still missing and no retry submitted. Fresh source review follows; configured retry requires clear verdict and new Coordinator window. Coordinator owns future baseline reduction.

### rev-35 · 2026-11-19T04:36:34.612Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1988-source-3
commit: b6771c097dc88c9e5255d54c8c50e8d36f87ba89
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source CLEAR at cleanb6771c097dc88c9e5255d54c8c50e8d36f87ba89/tree2a5093ab; sole parent3eebc59c/no dev merge. Standards clear; Spec source clear; findings[]. A-21571 confirms ea64fb30-approved private one-consumer file setup spans acquisition/start/initial refresh/16-write-batched seed/owned transaction, while active-cover predicate, counter reset/branch transition, observed1500answers and both exact final assertions stay inside callback. Existing original/resource/root/guard/DB fallback owner unchanged; restore follows run's earlier positive-close hook. Only stage test+guide change, no production/helper/allowance/baseline/runner/tier/config edits. C2 removal reverified at new head. A-21568 candidate-tree local full11/11/standalone/reverse proof, fresh deliberate fanout1500>1 red with restoration and full lint/typecheck0 remain local/synopsis evidence, not droplet proof. Parent2a7dc921 remains green6904 but C1miss6.866027859s/ A-21562 retained. C1 stays incomplete/unverified until all3actual same-head droplet cases<5s and whole-file envelope disclosure; known baseline/report mode supplies no enforcing5 runner gate. No allowance; Coordinator75b9d3f owns later baseline lowering. Hold released; request fresh Coordinator mode-free verify window at this frozen head, report any>=5 before more work. Reviewer no runtime/probe/source edit.

Criteria: C2 verified.

### rev-35 · 2026-11-19T05:10:30.729Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1988-evidence-2
commit: b6771c097dc88c9e5255d54c8c50e8d36f87ba89
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR at cleanb6771c097dc88c9e5255d54c8c50e8d36f87ba89/tree2a5093ab, preserving source3/A-21571. A-21587 audits PASSED0fe63530/A-21586 autoexit0:6904ordinary/721file passes, separate235load case/file passes; no nonpass/unmatched start. C1actual target cases.427565181s/1.011974788s/3.204980086s all<5. Oracle1650/10/30summary80hydrated unchanged;40view+40queue p9542.689/42.456ms<1000; stage counted1500answers/dependents<=1/final1500rows assertions remain inside body. Five owner controls ordinary+5/5/25loadfiles pass; targets ordinary-only. Stage3.205>advisoryT2 2 remains disclosed; known baseline/report mode is not an enforcing5check. C2three allowances absent/current lint succeeds, no baseline/runner edit. Before/parent/current ordinary file envelopes disclosed separately in A-21587, no controlled speedup/failed-old-suite promotion. Parent2a7dc921 staysGREEN but6.866s C1miss remains historical. T0/T1/allT2 incl44nvim385cases/Web complete; T3batch-deferred,T4unexecuted. UncachedLinuxx64/Node24.21/HeadlessShell1248Chrome156, snapshot6e9a9a97 differs from Git2a5093ab; advisories report-only. Standards/Spec clear,findings[],C1/C2 verified. Hold released; frozen head/claim for normal merge handling. No Reviewer test/probe/source edit or further rerun requested.

Criteria: C1 verified, C2 verified.

### impl-1988 · 2026-11-19T05:12:44.662Z

Ready-report facts at frozen b6771c097dc88c9e5255d54c8c50e8d36f87ba89 (claim retained): same-head run0fe63530-a2c2-4635-81cf-f7ef2919f6c3/A-21586 is uncached green6904/6904, no failed/cancelled/skipped cases. C1's exact ordinary samples: tracker0.427565181s (A-21586:11122), replies1.011974788s(:22430), stage3.204980086s(:29230), all<5s. Against report-only tier budgets: tracker<T1.5s, replies<T2 2s, stage>T2 2s advisory. Stage's3.204980086s is the new number for the Coordinator's later baseline refresh; this item changes no baseline. Reviewer final rev-35-1988-evidence-2/A-21587 verifies C1/C2 with no findings. C1 done mark now added; both criteria have checked+done marks/current verification. Source/experiments remain fixed.
Whole-file ordinary type:file disclosure (not summed-case budgets, no controlled speedup claim): historical pre-item tracker11.678078290s/item-scale32.563211702s in A-21424; stage16.180096416s in A-21412 (that overall run remains failed). Immediate parent A-21558:11.434751460s/31.604801881s/12.704881430s. Current A-21586:11.603402486s(:11249)/31.799270366s(:22643)/10.549993705s(:29335). Moved setup remains in file-process envelopes. Parent2a7dc921 remains configured green with C1's6.866027859s timing miss; not relabelled failed or borrowed as new C1 proof.
Recorded facts beyond exit0:6904ordinary test+721file finishes,235load test+235file finishes, no bad or unmatched start; each of5owner regressions has ordinary+5/5load passes. Target3cases have ordinary receipts; no target load claim. Original tracker oracle retained,30summaries/80hydrated; reply40+40samples p9542.689/42.456ms each<1000ms. T0/T1/all fallbackT2/Web complete; T3 merge-batch deferred, T4 unexecuted. Executor droplet c-8ams3/Linuxx64 6.8.0-147-generic, Node24.21/nvim0.12.5; isolated HeadlessShell1248/Chrome156.0.8078.4; lifetime1602s/cost$0.1112. Delivery snapshot6e9a9a97a7e8c90b2d73c2be815f3977dcb6af6a differs from Git tree2a5093ab as expected. General lint/tier/skip-reason advisories remain report-only; skip reasons missing0. Final review artifact A-21587 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21587-t-1988-final-evidence-clear-all-three-droplet-cases-under-five-seconds.md retains complete scopes.

### impl-1988 · 2026-11-19T08:59:21.372Z

Coordinator-authorized single dev merge is committed/pushed at 6caa89ac80d237de897e320fd91c06c6bf18f39d, tree15e0fc83, parents b6771c09 + fetched dev439951f2 (includes T-1952/T-1957). Sole manifest conflict resolves exactly to dev minus our three allowances, preserving all175 other dev objects, including20s/111s/113s entries; no baseline/tier/budget changes by this resolution. Expected11 paths differ from fetched dev;146 incoming paths fully inventoried in A-21681 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21681-t-1988-authorized-dev-merge-resolution-and-local-checks.md). Auto-merged item-summary-scale preserves all dev startup observers; tracker-summary only inherits callback block syntax. Other own helpers/stage bytes unchanged. Exact-tree local Darwin arm64/Node24.21 checks: full typecheck exit0; duration/manifest T1 batch53/53; C1 standalones .298843/.781030/.254486s with enclosing Node durations3.746522/11.766327/1.543627s; full item-summary-scale4/4 (10.611055s), tracker-summary28/28 (4.019418s); full lint exit0/zero refusals/129 report-only findings, closed-item wording0; actual shipped test:tiers exit0. Loads and literal behavioral facts in A-21681. Earlier T1 invocation lost final receipt and remains incomplete; separate retry53/53 retained. Previous A-21586/A-21587 all-three-under5 droplet evidence remains b677-only, prior6.866s stage miss retained; no configured run yet at6caa. Both done marks retained; requesting narrow resolution review, then Coordinator window.

### rev-35 · 2026-11-19T09:03:03.604Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1988-delta-1
commit: 6caa89ac80d237de897e320fd91c06c6bf18f39d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source CLEAR at clean6caa89ac80d237de897e320fd91c06c6bf18f39d/tree15e0fc83, parents reviewedb6771c09+pinneddev439951f2. Primary045b8978 explicitly authorizes this single merge/resolution. A-21683 independently rejects duplicate JSON keys and deep-compares resolved manifest to dev minus exactly3targetallowances:178→175, no other object/source/budget/file/case-baseline changes; T1952 20s/T1957 111s+113s preserved. Exactly11own paths/146inherited; seven own helper/stage/guide files byte-identical b677. Complete scale startup source and guide tail byte-equal dev; own churn seed relocation intact. Tracker only inherits tipsMoved block-return syntax, oracle/work/latency/stage assertions unchanged. Standards/Spec delta clear,findings[]. A-21681 exact-tree local fullcompiler/lint0,53/53T1 and actual shipped test:tiers0 support C2; earlier lost invocation stays incomplete. Local C1 standalones/full-file checks are selected Darwinarm64/Node24.21 observations, not droplet proof or configured file envelopes. OldA21586/A21587 under5 green and A21558 green-but6.866smiss retain prior epochs. C2verified; C1done/current-headunverified pending all3same-head droplet samples<5 plus whole-file disclosures; report-only tier budgets/known baseline are not an enforcing5runner gate. Hold released; request Coordinator mode-free window at frozen head. Reviewer static Git/JSON/source/evidence only, no runtime/probe/edit.

Criteria: C2 verified.

### impl-1988 · 2026-11-19T09:33:12.685Z

New-head droplet evidence retained: run2a0cffad-ff84-4dd4-a45f-6e9907ba9e95 / A-21689 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21689-suite-2a0cffad-ff84-4dd4-a45f-6e9907ba9e95-auto-at-6caa89a.log), head6caa89ac80d237de897e320fd91c06c6bf18f39d, runtime snapshot tree738ae78703ddc31399e32d3aac0f8840d79a1523 (Git source tree15e0fc83). Actual ordinary target receipts all pass: tracker0.338906800s (A-21689:9666/9667), reply0.809106806s (:20936/20937), stage0.769754145s (:27792/27793), each strictly<5; each also below its respective report-only T1 .5s/T2 2s advisory. Ordinary whole-file type:file envelopes, including file setup/cleanup: tracker8.028238744s (:9793), replies18.536096438s (:20950), stage7.828358384s (:27914). Original tracker oracle remains022b27e1c78253fc0c96f0df78a3cf228227db51cb68ace680868503562bd745;1650items/10moves/20summaries/80hydrated/no recomputed unrelatedids (:9669). All40 view+40queue replies observed; p95 26.739/26.706ms below unchanged1000ms (:21034/:21035). Streamed progress audit:6957ordinary tests+730ordinary files pass;25load-gate tests+25load files separately pass;0nonpass and0unmatchedstarts. Each of five own cleanup/constructor controls passes once ordinary plus5/5load. Configured autoexit0; T0,T1,allT2,Web and selected T3 suite-bundle-native/startup-listener-scale plus T4 suite-retention-scale exit0; remainingT3 deferred to merge batch, T4 repetitions skipped, no claim of fullT3/T4 coverage. Executor droplet c-8/ams3, linuxx64 kernel6.8.0-147,Node24.21.0,Neovim0.12.5, isolated Chrome Headless Shell1248/Chrome forTesting156.0.8078.4 (binary in A-21689:35908/:38495); lifetime1505.304s/cost$0.104535. Duration budgets/report-only advisories and previous6.866027859s stage miss remain retained; different-head envelopes are disclosed, not a controlled speedup. No source/baseline/allowance edit or further run. Awaiting Reviewer evidence settlement; claim/head frozen. Coordinator's later baseline refresh may use actual target samples above after settlement.

### rev-35 · 2026-11-19T09:34:41.440Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1988-evidence-3
commit: 6caa89ac80d237de897e320fd91c06c6bf18f39d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head CLEAR at clean6caa89ac80d237de897e320fd91c06c6bf18f39d/Git tree15e0fc83; delta A-21683 current. A-21691 audits passed2a0cffad/A-21689 beyondexit0: C1actual ordinary tracker0.338906800/reply0.809106806/stage0.769754145s all<independent5s, no targetallowances. Oracle022b27e1...bd745/1650items10moves20summ80hydrated/recomputed[];40view+40queue p9526.739/26.706ms<1000; stage counted1500answers/dependents<=1/final1500rows assertions unchanged. Ordinary file envelopes8.028238744/18.536096438/7.828358384s disclosed with older epochs, no controlledspeedup. C2three allowances absent; exact dev-minus3 integrity/current lint retained, no baseline/runner change. Complete index6957ordinarypasses/730file envelopes,0nonpass/unfinished. Separate25loadtest+25filepasses for5ownercontrols5/5, targetsordinaryonly. T0/allT1/allT2 inclNeovim44files385tests/Web complete; selectedchangedT3 2files3cases andT4 1file2cases complete once, no repeats;remainingT3batchdeferred/otherT4unexecuted. Inheritedstartup5.052s/T4scale57.356s are distinct allowed identities, notC1samples. UncachedLinuxx64/Node24.21/HeadlessShell1248Chrome156,c8ams3,1505s/$0.1045; snapshot738ae787 differs fromGit15e0fc83; generaladvisoriesreport-only. Oldb677green and3eebgreen-but6.866sC1miss/local/incomplete epochs remain separate. C1/C2verified,findings[]. Hold released; no further run/source change requested. Reviewer static source/log/JSON/index only.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T11:50:26.476Z

Merged d76bbdb9c6f9ff8a5bf6c8712a6cbb75576e7efe onto dev.
