---
id: T-1957
kind: task
title: ".cland/run/suites has no retention: 49,781 entries and 68 GB, constantly rewritten, feeding fseventsd's growth on macOS"
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1636
branch: t/T-1957-cland-run-suites-has-no-retention-49-781
created: 2026-11-18T04:38:52.596Z
updated: 2026-11-19T08:43:57.394Z
closed: 2026-11-19T08:43:57.394Z
---

## Summary

On 2026-11-18 04:38Z cland-impl found macOS fseventsd (pid 337, up about 35 h) holding 36 GB of memory (35 GB compressed) at 142% CPU. Swap was 30.6 of 31.7 GB, and free disk fell from 87 GB at 03:06Z to 69 GB at 04:38Z. This is the same class as 2026-10-28. `.cland/run/suites` holds 49,781 entries totalling 68 GB, and `.cland/run/executor/leases` 4,217 directories (T-1950 stops the hot reads, not the growth). The hub writes and reads under `.cland/run` constantly, and something watches that tree recursively. Nothing removes old suite run directories, so disk and file-event load grow without bound. The machine's own load also degraded local macOS covers all day, adding to T-1950's hub CPU.

## What to build

A retention rule for `.cland/run/suites`. Keep every run still referenced by a live verify, batch, cover or QA verdict, plus the last N runs per occasion, and archive or delete older ones after their artifacts (logs and coverage maps under `.cland/artifacts`) are confirmed durable. Name the recursive watcher on `.cland/run`, and narrow it to the paths it needs.

## Acceptance criteria

- [x] C1. With a fake run root of 50,000 run directories, retention in report mode (rule 27) computes exactly the referenced, recent and evidence-class runs to keep and the rest it would retire, logs those counts without deleting anything, runs in bounded yielding batches only after serving, and is idempotent; its guarded deletion owner is proven on a disposable root behind an off-by-default switch (test).
  - done: impl-1957 · 2026-11-19T07:03:57.743Z
  - verified: rev-39 [reviewer] · run rev-20261119-1957-final-14 · 2026-11-19T07:37:44.448Z · commit 2bf90a79c1b5a60af5bbc43a5d4195137a06f3e0
- [x] C2. The file-event load on `.cland/run` is accounted for with evidence: every in-repo watcher is listed with the paths it watches, the files written per suite run are counted on a fake run, and every reader of old suite run directories (rule 41) is listed with its disposition (test or artifact).
  - done: impl-1957 · 2026-11-19T02:32:50.724Z
  - verified: rev-39 [reviewer] · run rev-20261119-1957-final-5 · 2026-11-19T04:01:48.784Z · commit 16af00337579c8d7203b109c4d20ad2f883b3161
  - verified: rev-39 [reviewer] · run rev-20261119-1957-final-7 · 2026-11-19T04:36:38.589Z · commit 3d190237fdb67ac9726e90ef1dfb14235dd70a74
  - verified: rev-39 [reviewer] · run rev-20261119-1957-final-9 · 2026-11-19T06:06:01.191Z · commit 599e1644e95b5a0fd9e5442266d50f249a8663ac
  - verified: rev-39 [reviewer] · run rev-20261119-1957-final-14 · 2026-11-19T07:37:44.448Z · commit 2bf90a79c1b5a60af5bbc43a5d4195137a06f3e0

## Comments

### coord · 2026-11-18T22:14:04.692Z

Recurrence, 2026-11-18 22:15Z (v0-6a, read-only): fseventsd pid 97903, restarted by the human's killall at about 05:40Z, grew from 10 MB at 20:48Z to 1.08 GB at 22:15Z (+35 MB/min). `.cland/run/suites` is the hot directory: 612 entries changed in 10 minutes, against 26 for merge-batches and 10 for executor. It now holds 75,167 top-level entries and 70 GB, up from 49,781 and 68 GB this morning, so about 25,000 added today. Priority raised: this item starts first in E-1883 stage 2, right after stage 1 closes. Human asked (0c7d5bfa) about a killall in the meantime.

### impl-1957 · 2026-11-19T00:48:01.680Z

Consumer census underway before retention change: scheduler recovery/result/cache/log readers in hub/src/hub/suites.ts, suite-history.ts, dispatch.ts, suite-log.ts; merge-batches.ts diagnostics and batch member baselines; suite-coverage.ts pointers and executor/droplet/run.ts/run.sh collection; suite-durations.ts and hub/test/durations.ts source logs; tracker/index-db.ts verdict run identity; CLI/web/Neovim use durable hub results/artifact paths. Production watcher census finds watch.ts nonrecursive fs.watch on tracker .cland/tasks only; no recursive .cland/run watcher. C2 revision acknowledged. Pure policy and filesystem guarded-removal regressions observed red then green on macOS Node v24.21.0; no verify receipt yet.

### impl-1957 · 2026-11-19T01:05:54.997Z

Committed c8bdebb9947e72c9228a9427936a1480528b61e7 and pushed to local origin; fetched/merged current origin/dev (already up to date). Durable evidence A-21467 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21467-t-1957-retention-liveness-and-consumer-census-evidence.md contains exact reader census, watcher findings, red-to-green receipts, 50,000-run membership and task.view latency, plus explicit scope limitations. Source changes include bounded post-serving background drain, guarded rename/removal, indexed verdict references, cached bounded duration sources, and shutdown joining.

### impl-1957 · 2026-11-19T01:07:13.251Z

At c8bdebb9947e72c9228a9427936a1480528b61e7, full npm run test:lint completed exit 0 with zero refusals. Existing report-only prerequisite/build findings were reported literally to the Coordinator; they are not test passes. Selected reachable T1 run passed 715 tests in 63 files; small new T1/T2 checks passed six cases. Local T4 scale/liveness receipt is documented in A-21467. Final same-head typecheck in progress, then source review.

### rev-35 · 2026-11-19T01:22:02.948Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1957-source-1
commit: c8bdebb9947e72c9228a9427936a1480528b61e7
scope: full
findings: [{"severity":"high","text":"Spec/H1: no shared retirement/reference-admission fence spans asynchronous rename/rm. New verdict/pointer/duration references can arrive after eligibility checks; pointer/source sets are batch snapshots. Existing newly-referenced test changes its flag before removal. Coordinate admission authority and exercise the real concurrent boundary; author confirms no owner/disposition.","file":"hub/src/suite-raw-coverage.ts","line":37},{"severity":"high","text":"Spec/H2: after rename, coverage-map.json lives in .retiring-<id>, but recovery checks only suites/<id>. ENOENT bypasses the map-artifact requirement and log-only receipts can delete the tombstone's remaining map. Preserve/revalidate complete artifact requirements across the checkpoint; current empty-tombstone test misses this, author confirms.","file":"hub/src/suite-retention.ts","line":93},{"severity":"medium","text":"Standards/M1 rule23: Store.artifacts(topic) decodes the entire global artifact index per candidate (also shard lookups1026/1027);32candidates does not bound actual history work. Latest/batch reference scans also lack independent work bounds. Scale test supplies constant callbacks, so4.1ms is not scheduler-callback proof. Use indexed/checkpointed bounded lookup with actual-scheduler work/liveness evidence.","file":"hub/src/hub/suites.ts","line":1033},{"severity":"medium","text":"Standards/M2 rule12: an earlier sequential cleanup rejection skips the new retentionWork await, letting an admitted retirement/checkpoint outlive close/storage. Stop and join the new owner despite other cleanup errors; author confirms no finally/all-settled fence.","file":"hub/src/hub/suites.ts","line":2158},{"severity":"medium","text":"Standards/M3: new async component/scale/write callbacks lack encompassing pre-acquisition original-work ownership; cleanup/drain guards are registered after acquisitions, and write fs seams are TestContext-owned. Adopt late resources in original producers and retain roots/seams until joined work/resources close; selected fixture cleanup is insufficient, author confirms.","file":"hub/test/suite-retention-scale.test.ts","line":12},{"severity":"medium","text":"Standards/M4 rule38: native guard starts after suiteUnit setup, covers only public spawn/exec/execFile plus replacement customs, and lacks sync/lower-prototype/count/final-zero proof through cleanup. Use existing counted full-boundary guard before acquisition through positive joined cleanup, with restoration owned independently of TestContext cancellation.","file":"hub/test/suite-retention-writes.test.ts","line":13}]
finding_counts: {"high":2,"medium":4,"low":0}

Full first source NOT CLEAR at clean/pushedc8bdebb9, treec3db7802, basea6f2006b: Spec2high/Standards4medium, no lows. Author b0d608e9/749abe3c confirms all owner/admission/work/recovery gaps; no approved dispositions. Positive last-N policy, post-serving/yield intent, streaming8MiB source bound, indexed verdict references, watcher/raw-reader census and docs/skill update retained. A-21474 corrects A-21467: both50k passes are evolving uncommitted epochs, revised4.1ms liveness used direct retention beside hub, not actual scheduler callbacks; final scale/wiring edits were untested by those invocations. Six small passes, selected63T1/715 and full lint/typecheck0 remain scoped; failed import/guard/fixture/lint/typecheck rounds preserved. Native/custom failed-control facts, missing hashes/raw/signal/scan receipts stay unknown; no configured run. Fail C1/C2, verify none. Hold released for one consolidated safety/indexing/shutdown/new-test owner/guard correction; preserve assertions/epochs, no unrelated helper migration or provenance rerun. New committed head needs fresh source review before verify; Coordinator slot constraints persist. Full findings and correction bar: A-21475, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21475-t-1957-first-source-review-retention-safety-work-bounds-and-owners.md.

Criteria: C1 failed (Reference admission and crash/tombstone artifact guards permit unsafe retirement; actual scheduler work/shutdown/test ownership proof remains incomplete.), C2 failed (Write-count census lacks complete-lifetime native guard/fs seam ownership; existing count is scheduler-only and not guarded across all failure paths.).

### impl-1957 · 2026-11-19T01:53:54.787Z

Fresh source review requested from Reviewer at clean pushed head 03dd71b0742e786b0984675632e3b99e0ea9e98e after the Coordinator split live pins/activation into T-1991/T-1992. T-1957 now reports classifications only; production deletes no run roots. Correction evidence A-21486 (folder, entry report.md) preserves count/teardown failures and passing receipts. Final-head full lint exit 0/zero refusals, typecheck exit 0, selected T1 73 files/750 passes. Local T4 2/2 pass belongs to 58d383197 (same production source; follow-up only test budget/preservation cases/guide); configured verification at final head remains unexecuted. Shared test ownership/native guards, durable tombstone requirements, bounded actual scheduler callbacks and rejection-safe joining are corrected. C1/C2 done; fresh review pending.

### rev-35 · 2026-11-19T02:01:00.724Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1957-source-2
commit: 03dd71b0742e786b0984675632e3b99e0ea9e98e
scope: full
findings: [{"severity":"medium","text":"Standards M1: the new guarded cases restore fs seams/native guard after rejected cleanup has left the global pending set, without a positive resource-close receipt; shared executor-lease-fixture.ts:14–17 therefore releases isolation while resources/root may remain. Applies also to new C2 write-count control. Retain per-case successful closure fencing and prove failure-path root/guard retention through the real cleanup owner.","file":"hub/test/suite-retention-scheduler.test.ts","line":33},{"severity":"medium","text":"Spec M2: retry opens suite-retirement/<id>.json before validating its directory/file and skips the directory guard when required already exists; a linked receipt parent can redirect metadata reads and receipt removal outside the literal owner. C1's disposable deletion owner needs receipt-link refusal and preserved-run/external-evidence controls.","file":"hub/src/suite-raw-coverage.ts","line":39}]
finding_counts: {"high":0,"medium":2,"low":0}

Full revised report-mode source pass at clean 03dd71b0742e786b0984675632e3b99e0ea9e98e, tree fe6b58a792d559bf4b7762c815ba2a9d416683cb. Not clear: Standards one medium (M1), Spec one medium (M2), confirmed by implementer decision 17cb0a89. Detail and bounded correction bar: A-21490. Production live deletion is unreachable under Coordinator 2844de28; publisher pins/activation remain T-1991/T-1992 and are not findings here. Indexed callbacks, exact final batches, conservative evidence retention, tombstone artifact requirements and rejection-safe production retention join address their prior source issues. A-21486's earlier-58d T4 pass, current-03dd selected T1/static checks, and earlier failed/partial rounds remain distinct; no configured verification at this head. No criteria verified. Reviewer ran no tests/probes or source mutations. Fresh fixed-head source review is required before verification.

Criteria: C1 failed (The new cases lack positive resource-close fencing after cleanup rejection, and the disposable retirement owner follows unvalidated receipt links on retry.), C2 failed (The new write-count fixture's seams/native guard can restore after rejected cleanup without positive resource closure.).

### impl-1957 · 2026-11-19T02:32:51.525Z

Second-review correction committed/pushed at 118b172e9bfceb3a802332c5f1a098aa86d41a94; fresh full source review requested. A-21497 records positive resource-settlement/root/guard receipts, both linked-receipt red/green controls and exact-head tests: T4 2/2 pass, 19 focused cases, 73 selected T1 files/750 passes, full lint and typecheck exit 0. Production stays report-only. Legacy fixture migration T-1979; pins/live activation T-1991/T-1992. No configured verification yet.

### rev-35 · 2026-11-19T02:36:48.987Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1957-source-3
commit: 118b172e9bfceb3a802332c5f1a098aa86d41a94
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source CLEAR at clean 118b172e9bfceb3a802332c5f1a098aa86d41a94, Git tree 75a6f8fcba5ca9cb64ba098494fadf59bf459302. Standards clear; Spec clear; no findings. A-21499 records M1's retention-only positive closure/root/guard restoration fence and real failure/repair control, and M2's before-open directory/final-file receipt-link refusal with external-byte/tombstone controls. Production remains report-only under Coordinator 2844de28; T-1991/T-1992 own pins/live activation, and primary e52e5051 confirms legacy migration T-1979. A-21497's exact-head local macOS focused 19/19, T4 2/2 including actual scheduler counts/socket liveness, selected 73 T1 files/750 passes and full lint/typecheck are scoped supporting evidence, not configured verification. Prior failed/partial and different-head rounds remain separate, missing native/tree/capture provenance stays unknown. C1/C2 deliberately remain unverified pending final same-head configured evidence; no verified marks in this source pass. Source clear permits configured verification at this head subject to the Coordinator window. Reviewer ran no tests/probes or source mutations.

### impl-1957 · 2026-11-19T03:00:15.157Z

Configured run ab774d6b-c5d4-4a64-84c1-6a52ef60adb3 at source-clear 118b172e9bfceb3a802332c5f1a098aa86d41a94 is partial, exit 1 (A-21515). macOS host T0 exit 0; Linux x64 droplet c-8 ams3 T1/T2 exit 0; changed T4 two assertions pass, but command exits 1 after literal diagnostic: duration budget: hub/test/suite-retention-scale.test.ts::report mode classifies fifty thousand runs and keeps every directory while serving task views 52.757 s > 5 s (add to hub/test/durations.json with a reason). Also reports missing allowance owner. Web did not execute; remaining T3 deferred to batch. T4 task.view observations 4.3ms and 3.519ms under fixed1000ms bound, setup excluded; 108 indexed lookups in actual-scheduler case. Overall receipt is not green. Reported blocker and requested Coordinator attribution/retry decision in topic-1636; no resubmission or source edit. Droplet lifetime1070s/cost$0.0743, Node24.21.0, Neovim0.12.5.

### rev-35 · 2026-11-19T03:06:43.530Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1957-evidence-1
commit: 118b172e9bfceb3a802332c5f1a098aa86d41a94
scope: evidence
findings: [{"severity":"medium","text":"Configured run ab774d6b fails the enforcing new-case duration cap: 50,000-directory report case 52.757195455 s > 5 s, despite passing assertions; T4 and overall exit1. Coordinator9ff58c76 attributes to T-1957 and authorizes narrow cheaper fixture or exact-case E-880 allowance (~80s,<=7 days), fresh review/window. Printer issue is T-1993.","file":"hub/test/suite-retention-scale.test.ts","line":15}]
finding_counts: {"high":0,"medium":1,"low":0}

Same-head configured evidence NOT CLEAR for ab774d6b-c5d4-4a64-84c1-6a52ef60adb3/A-21515 at 118b172e9bfceb3a802332c5f1a098aa86d41a94. Standards: one medium duration-admission failure; no new behavioural source finding. Literal T4 failure: report-mode 50,000-run case 52.757 s > 5 s. Both T4 assertion identities/file pass, but T4 and overall owner exit1; Web unexecuted, T3 merge-batch deferred. T0/T1/T2 pass, including 44 Neovim files/385 cases. Complete progress index has 6559 ordinary passing tests/671 files plus95 passing load tests/files; interruption count6654 includes those95, not another ordinary total. All19 owned T1/T2 identities have ordinary+5/5 passes; T4 ran once/no repetitions. Positive 4.3ms and3.518863ms socket receipts/counts are retained partial behaviour evidence. Snapshot7b27665e differs from Git tree75a6f8fc. Linuxx64 droplet Node24.21/Neovim0.12.5; browser null, no Web execution. C1 failed this pass, C2 done retained/unverified; no verified marks. Primary Coordinator9ff58c76 authorizes a narrow cheaper fixture or exact E-880 ~80s <=7-day allowance tied to52.757195455s/sample/T4 purpose; unavailable printer is T-1993. Fresh corrected-head source review and Coordinator window required before another run. A-21517 records audit, scopes and retained earlier rounds. Hub recovery readback found no prior evidence verdict; the interrupted note was safely recovered through its same retry key. Hold released. Reviewer ran no tests/probes or source mutations.

Criteria: C1 failed (Configured T4 duration admission failed at 52.757 s > 5 s; overall run remains failed/partial despite passing behaviour.).

### rev-39 · 2026-11-19T03:13:01.154Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1957-source-4
commit: 16af00337579c8d7203b109c4d20ad2f883b3161
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear for Coordinator-authorized narrow allowance delta at16af00337579c8d7203b109c4d20ad2f883b3161/tree2979edb154df1f01ff6c254afbae30b64d5fe0e1. Standards0/Spec0 findings. Only exact-case80s/E-880/Nov19–26 entry added; key matches T4 title, reason binds Linux52.757195455s A-21515 and macOS58.537859708s A-21497 to scale fixture purpose. No global/file/tier waiver, source/assertion change, activation or dev merge;1000ms task.view bound unchanged. Read primary9ff58c76/6b253422 authorizing allowance and waiving redundant native run. A-21522 before/after production-checker replay1failure->0 for both samples is admission evidence only, not a run pass; actual-scheduler0.856111759s needs no exception. Prior complete source audit rev-35-1957-source-3/A-21499 carried for unchanged code. A-21525: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21525-t-1957-authorized-allowance-source-review-at-16af0033.md. Current lint/typecheck0,17durationT1/tierlint0 supporting evidence; localmacOSNode24.21 no browser/nativeT4/configured rerun or Reviewer execution. Priorab774d6b/A-21515 remains FAILED/PARTIAL with Web unexecuted. C1/C2 remain unverified pending corrected-head configured result; source clear permits requesting the Coordinator window.

### rev-39 · 2026-11-19T04:01:48.784Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1957-final-5
commit: 16af00337579c8d7203b109c4d20ad2f883b3161
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at exact16af00337579c8d7203b109c4d20ad2f883b3161, branch unchanged. Run5bbf5113/A-21548 passed, snapshot treeee0e51a9c3f011e6f7e7c679baf994a32f67138a/cache null. All21 retention identities pass;19T1/T2 each5/5load, twoT4once/no repetitions. Scale58.173733814s admitted by authorized80s exact allowance;50k roots/no deletion/idempotence assertions retained, socket4.7ms<1000ms. Actual-scheduler50kartifact rows/108lookups/taskView4.400400ms<1000ms, setup excluded. C2 fake scheduler census1file suite.log/4writes explicitly excludes unexecuted worker/remote; documented watcher/reader census plus prior complete source review A-21499 and allowance source A-21525 checked. C1/C2 verified. T0/T1/T2/T4/Web exit0; complete progress index6910ordinary pass+95loadpass, zero fail/cancel/skip; T3 merge-batch deferred. Linuxx64 droplet Node24.21.0/Neovim0.12.5; actualChromeHeadlessShell1248/GoogleChromeTesting156.0.8078.4, advisoriesreport-only. Priorab774d6b remains FAILED/PARTIAL. Production report-only/pins+activation T-1991/T-1992 unchanged; printerT-1993. A-21549: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21549-t-1957-final-exact-head-evidence-clear-at-16af0033.md. No Reviewer runtime execution or live deletion/all-tier/whole-hub timing claim.

Criteria: C1 verified, C2 verified.

### impl-1957 · 2026-11-19T04:07:35.749Z

Coordinator317213ec-requested merge committed and pushed at3d190237fdb67ac9726e90ef1dfb14235dd70a74 (parents16af00337 and origin/dev13cefb4b). SKILL equals dev; retention guidance moved verbatim into indexed implementation/running.md with provenance. Full JSON deep equality proves every dev duration entry kept plus sole reviewed80s allowance. A-21554 records resolution and validation: 58 selected T1/T2 passes on resolved tree; committed-head full typecheck/lint and tier lint exit0; report-only workflow lint0, closed wording0, no refusals. Prior A-21548 configured green remains parent-head behaviour evidence; no merged-head configured run yet. Source resolution review requested, C1/C2 done with parent verification stale.

### rev-39 · 2026-11-19T04:08:53.900Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1957-delta-6
commit: 3d190237fdb67ac9726e90ef1dfb14235dd70a74
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge-resolution delta clear at3d190237fdb67ac9726e90ef1dfb14235dd70a74/tree0319257437ea7cc8fd4f0b4b31ca7d2aa78cd789, parents16af00337+13cefb4b0; branch exact. Read Coordinator317213ec rule11 merge request. Standards0/Spec0 findings. Skill blob equalsdev exactly, retention paragraph moved verbatim into indexed implementation/running.md with T-1957 CHANGES provenance. Duration JSON only7additions/0deletions vsdev for unchanged reviewed80s allowance; all dev entries retained. Auto-merged Store/tracker paths preserve both inbox/cache/freshness dev changes and retention's independent indexed artifact/run-reference additions. A-21555: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21555-t-1957-merge-resolution-delta-source-clear-at-3d190237f.md. A-21554 reports58selectedT1/T2 on unchanged resolved candidate bytes and merged-head full typecheck/lint0, workflow0/closedwording0; advisories130/63 retained. No Reviewer execution or merged-head configured evidence. Parent5bbf5113/A-21548 remains valid at16af only; C1/C2 unverified/stale atmerge pending configured result. Earlier failedab774d6b retained. Source clear permits new Coordinator window.

### rev-39 · 2026-11-19T04:36:38.589Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1957-final-7
commit: 3d190237fdb67ac9726e90ef1dfb14235dd70a74
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final evidence clear. Run70bbe634/A-21570 passed at exact3d190237fdb67ac9726e90ef1dfb14235dd70a74, branch unchanged; snapshotd4db6b2a37142dc4a542d5d69698470c17ae33ee/cache null. All21retention normal cases pass,19T1/T2each5/5load/twoT4once. Scale51.24525535s<unchangedauthorized80s;50kroots/no-deletion/idempotence; socket4.4ms<1000ms. Actualscheduler50kartifactrows/108lookups/taskView3.484781ms<1000ms, setup excluded. C2census1schedulerfile/4writes excludes unexecutedworker/remote; unchanged watcher/readers dispositions and indexed guidance retained. C1/C2 verified with A-21555delta source and earlier unchanged-design source audits. Merged-landing tests implementskill5/tracker23/inbox6/itemscale4/sqlite3 pass. T0/T1/T2/T4/Web exit0; completeindex6925ordinarypass+95loadpass zero fail/cancel/skip; T3 deferred. Linuxx64droplet Node24.21/Neovim0.12.5; actualChromeHeadlessShell1248/GoogleChromeTesting156.0.8078.4, advisoriesreport-only. A-21572: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21572-t-1957-merged-head-final-evidence-clear-at-3d190237f.md. Parentgreen5bbf5113 and earlierfailedab774d6b keep their distinct heads/outcomes; report-only production unchanged. No Reviewer runtime execution/all-tier/live-deletion claim.

Criteria: C1 verified, C2 verified.

### impl-1957 · 2026-11-19T05:33:40.502Z

Coordinator-requested merge after T-1857/T-1993 committed fd3e107ae; shared guardedLeaseCase has one unchanged fence body plus timeoutMs??5000. Final review head599e1644e95b5a0fd9e5442266d50f249a8663ac includes only approved follow-up allowances: case111s and file113s/E-880/Nov26 expiry (decisions1aa49e6d,a0bf13c1). A-21594 preserves exact seam census and union108/108 T2 passes, local T4 two passes at merge head with positive4.1ms/1.315ms replies and108lookups, native slot release, initial failed replay and final before/after production checks for both platforms. Final-head20duration T1 passes; full typecheck/lint/tier lint exit0, no refusals, all sequentialstartload<8. No final-head configured run yet; fresh narrow review requested. Earlier ready/configured receipts stay prior-head evidence.

### rev-39 · 2026-11-19T05:35:12.151Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1957-delta-8
commit: 599e1644e95b5a0fd9e5442266d50f249a8663ac
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized shared-fence+allowance delta clear at599e1644e95b5a0fd9e5442266d50f249a8663ac/tree2ab7d8093a4be1d7471ad47f04dff132e28ddfea. Read Coordinator1f5beee2/a8dd8143/1aa49e6d/a0bf13c1. Standards0/Spec0 findings. Mergefd3e107ae retains ONE identical canRestore/deferRestore/releaseSeams body used by billingCase+retentionCase, plus timeoutMs??5000; legacy default unchanged. Later commits only exactcase111s/file:true113s, E-880/Nov19–26, both platform samples/purpose/unchanged1000msbounds; no global/tier/test/production-policy changes. A-21594 two-platform production-checker replay before1Linux/2macOS failures->after0each retains advisory/original samples and initial failed2!==1 replay. Mergehead108T2/T4two passes scoped there; finalhead20durationT1/fulltypecheck/lint0 with reportonly130/63 and zero refusals, no configured run. A-21595: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21595-t-1957-shared-fence-and-two-platform-allowance-delta-clear-at-599e1644e.md. C1/C2 stale/unverified atnewhead; earlier70bbe634/A-21570 green and A-21515failed remain distinct. No Reviewer runtime execution. Source clear permits new Coordinator window.

### impl-1957 · 2026-11-19T06:04:02.243Z

C2 evidence scope correction under Coordinator b6df0611/a09ba32c (supersedes any earlier complete-per-run interpretation): The fake scheduler receipt is API-scoped evidence covering fs.promises writeFile, appendFile and open. It records four intercepted API calls and one distinct observed logical filename, suite.log. It EXCLUDES stream writes and renames, including suite.log.provenance.tmp written by createWriteStream then renamed, and it IS NOT a complete per-run file census or observed final directory inventory. Complete coverage of stream writes, temporary files, renames and final inventory is T-1998 (Follow-ups, S) under C-326. Watcher evidence remains unchanged: code search found only the nonrecursive tracker .cland/tasks watcher in hub/src/watch.ts; no production recursive .cland/run watcher was found (Coordinator5a7bffd0/00:42Z revised that original hypothesis). Reader dispositions remain documented. Production retention is unchanged/report-only at599e1644e95b5a0fd9e5442266d50f249a8663ac. Configured89a72aed/A-21598 is green at that head; Reviewer is settling final C2 disposition under the Coordinator's cap. No source edit, probe or new verification.

### rev-39 · 2026-11-19T06:06:01.191Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1957-final-9
commit: 599e1644e95b5a0fd9e5442266d50f249a8663ac
scope: evidence
findings: [{"severity":"low","text":"API-scoped census observes writeFile/appendFile/open only:4intercepted calls/1logical filename, not stream/temp/rename or final inventory. Explicitly relabelled in item; complete physical census deferred toT-1998 (Follow-ups,S) by Coordinatorb6df0611/a09ba32c. Nonblocking under binding C2 bar; no complete-census claim.","file":"hub/test/suite-retention-writes.test.ts","line":15}]
finding_counts: {"high":0,"medium":0,"low":1}

Final clear at exact599e1644e95b5a0fd9e5442266d50f249a8663ac; run89a72aed/A-21598 passed, snapshot12b896cd33f43f551b3f4f6063c41feb0dd14428/cache null, branch unchanged. CHOICE under Coordinatorb6df0611: preferred NO-CODE disposition. C2 scope correction read back at06:04:02: selected3APIs only, excludes streamwrites/renames/temp/finalinventory; complete census NOT verified, Follow-ups S T-1998 filed underC-326. One low finding retained; no medium/high. C2 verified to binding behavioral bar: watcher/reader inventory and unchanged report-only retention; original recursivewatcher hypothesis already corrected by5a7bffd0, no nonexistent watcher narrowing claimed. C1 verified: all21retention ordinarypass,19x5load/twoT4once; scale47.236908446s<111s/file identitysum48.178175120s<113s, socket4.6ms<1000ms; actualscheduler50krows/108lookups/taskView3.593947ms<1000ms/setup excluded. All108shared-fence union cases pass inclbilling+retention rejection/repair. T0/T1/T2/T4/Web exit0; completeindex6944ordinarypass+95loadpass zero fail/cancel/skip; T3 deferred. Linuxx64droplet Node24.21/Neovim0.12.5; actualChromeHeadlessShell1248/GoogleChromeTesting156.0.8078.4, advisoriesreport-only. A-21599: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21599-t-1957-final-clear-at-599e1644e-with-scoped-c2-census-follow-up.md. No newobserver/source/run required undercap; earlier failed/partial/parentgreens remain distinct. No Reviewer runtime execution/live-deletion/all-tier/complete-census claim.

Criteria: C1 verified, C2 verified.

### impl-1957 · 2026-11-19T06:16:57.989Z

Coordinator-requested one-time dev merge after T-1952 committed/pushed at 9c7cabf2b898cab3a73db79057184f56d8262111, parent dev db53a0cb9 including T-1652. Sole manual conflict durations.json; full manifest equality keeps every dev entry plus our unchanged 111-second case and 113-second file allowances. Whole merge delta includes 34 paths, reported before assuming waiver; Coordinator 143e8f47 requires normal verify. A-21605 records key search, exact-head selected duration T1/T2 37/37 passes, full typecheck/lint/tier lint exit 0 and zero refusals. No native rerun required per Coordinator; changed T3/T4 will run configured. C2 API scope correction/T-1998 follow-up unchanged. Clean pushed head, narrow review requested; no current-head configured verification.

### rev-39 · 2026-11-19T06:18:42.024Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1957-delta-10
commit: 9c7cabf2b898cab3a73db79057184f56d8262111
scope: delta
findings: [{"severity":"low","text":"Carried accepted C2 scope limitation: selected writeFile/appendFile/open census excludes stream/temp/rename/finalinventory. Complete census unverified/follow-upT-1998 (S), no-code disposition Coordinatorb6df0611/a09ba32c unchanged; not a new merge finding.","file":"hub/test/suite-retention-writes.test.ts","line":15}]
finding_counts: {"high":0,"medium":0,"low":1}

Authorized merge-resolution delta clear at9c7cabf2b898cab3a73db79057184f56d8262111/treefdf6284a9efe8b7a1ff24ab2c13eeec6dbee3af6, parents599e1644e+devdb53a0cb9. Read primary07194bfe/08d39b96 and143e8f47: normal configured verify REQUIRED, no waiver. Sole manual conflict durations.json retains entiredev plus unchangedretention111scase/113sfile (15additions/0deletions vsdev); startup20sentry/reasons/owners/dates/budgets preserved. No new Standards/Spec finding; knownlowC2API-scope/T-1998 carried. Auto34-path startup/core/suites/tracker/bundling delta disclosed; retention post-serving admission/report-only semantics remain, inherited runtime interactions need currenthead execution. A-21606: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21606-t-1957-startup-allowance-merge-delta-clear-at-9c7cabf2b.md. A-21605 exact-head37selecteddurationT1/T2/fulltypecheck/lint/tierlint0 reported,129/62advisories/zero refusals; no Reviewer execution or configuredmerged-head evidence. Parent89a72aed/A-21598 finalA-21599 retain priorheadscope; C1/C2 stale/unverified until normal exact-head result under unchangedC2no-codebar.

### impl-1957 · 2026-11-19T06:38:05.570Z

Configured b8f29d1a / A-21615 at exact reviewed 9c7cabf2b is FAILED/PARTIAL: T0/T1 exit0, T2 exit1; changed T3/T4 and Web unexecuted. Ordinary summary6211 cases/6210passes/1failure, plus95 passing load records in interruption total6306. Failure in inherited T-1952 item-summary-scale.test.ts:86 case a thousand-item planned hub serves within two seconds of listening before maintenance: literal AssertionError 'the status reply arrives while the first freshness batch is still running'; false !== true at line140. Reported literal error to lead T-1957/Coordinator for attribution, holding diagnosis/source/probes/retries. Linux x64 c-8 ams3 Node24.21.0/Neovim0.12.5, lifetime918s/cost$0.0637. Earlier parent greens remain distinct, no current-head green claim.

### rev-39 · 2026-11-19T06:41:30.462Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261119-1957-evidence-11
commit: 9c7cabf2b898cab3a73db79057184f56d8262111
scope: evidence
findings: [{"severity":"medium","text":"Configured b8f29d1a failed the status/first-freshness overlap assertion (false !== true); Coordinator attributes shared dev defect to T-1999. T3/T4/Web unexecuted; required merged-head evidence is not clear.","file":"hub/test/item-summary-scale.test.ts","line":140},{"severity":"low","text":"Write census remains API-scoped (writeFile/appendFile/open), excluding stream/temp/rename/final inventory; accepted relabelled C2 scope, complete census deferred to T-1998.","file":"hub/test/suite-retention-writes.test.ts","line":15}]
finding_counts: {"high":0,"medium":1,"low":1}

T-1957 evidence verdict: NOT CLEAR
Head: 9c7cabf2b898cab3a73db79057184f56d8262111
Review run: rev-20261119-1957-evidence-11
Scope: evidence; source delta-10 remains clear.

Medium — hub/test/item-summary-scale.test.ts:140
A-21615 / configured b8f29d1a-14c4-4dc7-9277-ee54598628f2 exited 1. Literal failure:
AssertionError [ERR_ASSERTION]: the status reply arrives while the first freshness batch is still running
false !== true
The named test completed in 2.630224846 s. This is an overlap assertion failure, not a serving-deadline failure. Coordinator 62d23164 attributes it to shared dev/T-1952 and tracks correction as T-1999; this review does not attribute a retention defect.

Recorded facts independently checked from structured completion receipts: 6,211 ordinary tests, 6,210 passed and one failed; 95 separate load repetitions passed. Nineteen retention tests passed ordinarily and each generated load case passed 5/5. T0/T1 completed successfully; T2 failed. Changed T3/T4 and Web did not execute; remaining T3 is merge-batch deferred. Thus the current-head 50,000-directory T4 proof is unexecuted, and this run cannot establish final clearance or current C1 verification. No skips/cancellations recorded. Linux x64 kernel 6.8.0-147-generic, droplet c-8 ams3, Node24.21.0, Neovim0.12.5, workers2; no browser runtime receipt. Snapshot tree 2bf8df06d554bbee5a89be8af882c27a1e2eae7c; not a cache hit. Duration/lint advisories remain report-only.

Low carried — hub/test/suite-retention-writes.test.ts:15
C2 write evidence observes writeFile/appendFile/open calls only; excludes stream writes, provenance temp/rename and final inventory. Coordinator b6df0611 accepted this explicitly relabelled scope with no code extension; complete census remains T-1998 (Follow-ups, S). No new census demand.

Criteria: C1 failed for required configured evidence failure and unexecuted scale proof, not a diagnosed retention product failure. C2 scope disposition remains accepted but is not newly verified by this failed configured run. Earlier green runs remain parent-head evidence.

Coordinator 767644ce authorized one same-head resubmission after the unchanged shared case passed 5/5 alone on Darwin. Admitted successor b01cb21b-f20d-4bdb-8a60-9efa2d9ffd4b is pending; b8f29d1a remains failed. No additional run, probe or source change requested by this review.
Artifact: A-21620, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21620-t-1957-failed-merged-head-configured-evidence-authorized-retry-pending.md

Criteria: C1 failed (Required merged-head configured run b8f29d1a failed shared overlap assertion; current-head 50,000-directory T4 proof did not execute. Successor b01cb21b is pending, no retention defect attribution.).

### impl-1957 · 2026-11-19T06:59:23.556Z

Authorized same-head retry b01cb21b/A-21633 at9c7cabf2b also FAILED/PARTIAL with exactly one completed failure, shared T-1999. Literal A-21633:34060: AssertionError [ERR_ASSERTION]: the status reply arrives while the first freshness batch is still running; false !== true, item-summary-scale.test.ts:140:10 (case line86). Ordinary6211 tests/6210 pass/1 fail plus95 passing load records; T0/T1 exit0,T2 exit1,changed T3/T4/Web unexecuted. Linux x64 droplet c-8 ams3 Node24.21.0/Neovim0.12.5 lifetime928s/cost$0.0644. Both failed rounds stay recorded; Coordinator767644ce forbids another resubmission until shared fix. Holding source/head/diagnosis; waiting T-1999 and Coordinator instruction.

### rev-39 · 2026-11-19T06:59:40.888Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261119-1957-evidence-12
commit: 9c7cabf2b898cab3a73db79057184f56d8262111
scope: evidence
findings: [{"severity":"medium","text":"Authorized same-head retry b01cb21b again fails status/first-freshness overlap assertion; shared T-1999 attribution retained. Required evidence incomplete, changed T3/T4/Web unexecuted.","file":"hub/test/item-summary-scale.test.ts","line":140},{"severity":"low","text":"Accepted API-only census excludes stream/temp/rename/final inventory; complete physical census remains T-1998, no new observer work required.","file":"hub/test/suite-retention-writes.test.ts","line":15}]
finding_counts: {"high":0,"medium":1,"low":1}

T-1957 same-head retry evidence: NOT CLEAR
Commit 9c7cabf2b898cab3a73db79057184f56d8262111; review rev-20261119-1957-evidence-12, scope evidence.
Configured retry b01cb21b-f20d-4bdb-8a60-9efa2d9ffd4b / A-21633 exited1. Literal sole failure:
AssertionError [ERR_ASSERTION]: the status reply arrives while the first freshness batch is still running
at hub/test/item-summary-scale.test.ts:140:10.
Generated case: a thousand-item planned hub serves within two seconds of listening before maintenance; completion2.784524710s. The overlap assertion failed again, not the serving deadline. Coordinator's existing attribution is shared dev defect T-1999, not a retention defect.

Structured completions independently checked: 6,211 ordinary tests, 6,210passed/1failed; separate95/95load repetitions passed. Nineteen retention ordinary cases and all19x5load receipts passed. T0/T1 exit0, T2 exit1; changedT3/T4/Web unexecuted, remainingT3 deferred. No skip/cancel recorded. No current-head50k-directory T4 scale proof and no browser runtime receipt. Executor Linuxx64droplet c-8ams3, kernel6.8.0-147-generic, Node24.21.0, Neovim0.12.5, workers2; producer lifetime928s/cost$0.0644. Budget/lint/ratchet advisories report-only.

Medium: required configured evidence failed again; C1 remains failed for missing current-head complete evidence, without diagnosing a retention product failure.
Low carried: hub/test/suite-retention-writes.test.ts:15 API census covers writeFile/appendFile/open only, excludes stream/temp/rename/finalinventory; accepted no-code scope per Coordinatorb6df0611, complete census T-1998. C2 not newly verified.

The first failed round b8f29d1a/A-21615 remains failed; retry does not supersede it with green proof. This exhausts Coordinator767644ce's one retry. Hold source9c7cabf2b unchanged and wait for T-1999/Coordinator shared-fix instruction; no further resubmission, experiment or source change requested. Source delta-10 remains clear. Reviewer ran no tests/probes.
A-21635: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21635-t-1957-authorized-retry-also-fails-shared-overlap-assertion.md

Criteria: C1 failed (Authorized same-head retry b01cb21b failed shared T-1999 overlap assertion; current-head T4 scale proof remains unexecuted. Both rounds stay failed; wait for Coordinator shared-fix instruction.).

### impl-1957 · 2026-11-19T07:03:58.298Z

Coordinator 1217330a shared fix cherry-picked in order onto 9c7cabf2b: bbdf60754 as817cff1ed, then8730aa5be as2bf90a79c1b5a60af5bbc43a5d4195137a06f3e0, pushed. Delta exactly item-summary-scale.test.ts +6/-1; full blob abb2f429... and combined stable patch ID f9ce5459... match T-1999. A-21637 records one selected macOS case pass, full exact-head typecheck/lint exit0/zero refusals and original failed runs unchanged. No dev merge or independent diagnosis; production/census disposition unchanged. C1 implementation done, fresh narrow identity-only review requested, no new configured run.

### rev-39 · 2026-11-19T07:05:58.342Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1957-delta-13
commit: 2bf90a79c1b5a60af5bbc43a5d4195137a06f3e0
scope: delta
findings: [{"severity":"low","text":"Carried accepted API-only census scope excludes stream/temp/rename/final inventory; complete physical census remains T-1998. No new shared-fix finding.","file":"hub/test/suite-retention-writes.test.ts","line":15}]
finding_counts: {"high":0,"medium":0,"low":1}

T-1957 shared-fix identity review: CLEAR
Head2bf90a79c1b5a60af5bbc43a5d4195137a06f3e0; Git tree57f9dc5573971a52a2b3f6c990cc5088a5337676.
Run rev-20261119-1957-delta-13, scope delta. Narrow scope explicitly authorized by Coordinator1217330a: only whether the cherry-pick is identical to T-1999.

Standards and Spec: no new findings. Independently compared exact Git objects: delta from source-clear9c7cabf2b is only hub/test/item-summary-scale.test.ts +6/-1. Entire file blob abb2f4297723bf32095ed19168f8936d50e58f1e equals T-1999 8730aa5bee8508df3347914094f62a2c8dd6f726. T-1999 task verdict confirms rev-35-1999-source-2 is clear with no findings at that commit. The two copied changes gate the first read until status and release the gate in response finally including client acquisition failure, plus owner cleanup fallback; fixed2000ms assertions retained. No other path/production/retention/fixture/allowance changes.

Carried low hub/test/suite-retention-writes.test.ts:15: accepted API-only write census excludes stream/temp/rename/final inventory; T-1998 owns complete census. No new census requirement.

A-21637 reports one selected case1/1 on local Darwin arm64 Node24.21.0, listening→serving94.021ms and serving→status40.380ms, fixture/setup excluded from those intervals; case whole3.974726666s includes setup/cleanup. It reports whole typecheck/lint exit0/zero refusals at exact new head, advisories unchanged. This is local selected evidence, not Linux/configured proof. No browser or new configured result. Earlier b8f29d1a and b01cb21b remain failed/partial; neither is superseded by a local pass. C1/C2 remain unverified at the new head pending required configured evidence under unchanged scoped-C2 disposition. Reviewer performed read-only object/diff/evidence review, no tests/probes. Source clear permits requesting Coordinator window as instructed.
A-21640: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21640-t-1957-t-1999-shared-fix-identity-clear-at-2bf90a79c.md

### rev-39 · 2026-11-19T07:37:44.448Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1957-final-14
commit: 2bf90a79c1b5a60af5bbc43a5d4195137a06f3e0
scope: evidence
findings: [{"severity":"low","text":"Accepted API-scoped census covers writeFile/appendFile/open only; stream/temp/rename/final inventory unverified and deferred to T-1998 (Follow-ups,S) under Coordinator b6df0611/a09ba32c. No complete-census claim.","file":"hub/test/suite-retention-writes.test.ts","line":15}]
finding_counts: {"high":0,"medium":0,"low":1}

T-1957 final evidence CLEAR
Head2bf90a79c1b5a60af5bbc43a5d4195137a06f3e0; reviewed Git tree57f9dc5573971a52a2b3f6c990cc5088a5337676.
Review rev-20261119-1957-final-14, scope evidence.
Configured d7c77243-f8c0-4145-a324-ec54b4a702a2/A-21654 passed at exact source-cleared head; no cache. Producer snapshot tree8b0e60b602937cd56c31f776aa48c3fdaf2b38af is distinct from source Git tree.

Independent structured completions:6,952 ordinary passes plus95 separate load repetition passes; zero fail/skip/cancel. T0/T1/all fallbackT2/selected changedT3/T4/Web exit0. RemainingT3 is deferred to merge batch; this is not all-T3/all-T4 proof. Retention21 ordinary cases passed:policy3,component8,ownership1,scheduler6,writes1,scale2. All19 new non-T4 retention cases have5/5 load passes (95); both T4 cases ran once, no load repetition claimed.

C1 scale receipts inspected apart from exit0:
- Exact generated case "report mode classifies fifty thousand runs and keeps every directory while serving task views" passed64.119912304s. Source-retained final assertions check49,993 would-retire/7kept, zero removal, all50,000 directory names preserved, referenced bytes/artifact preserved, and unchanged second sweep. Real socket task.view4.5ms while drain active, bound1000ms, fixture setup excluded.
- "actual scheduler retention stays responsive beside fifty thousand artifact records" passed1.023208916s. Diagnostic independently records50,000artifactRows/108indexed lookups/taskView4.259455ms/bound1000ms/setupExcludedtrue. Retained final assertions:128candidate directories preserved,108would-retire/20kept/zero removed; global artifact-index decode is a failing control.
- Guarded disposable cleanup, receipt-link refusal, admitted-work join and rejected-cleanup/repair owner regressions passed in component/ownership/scheduler cases. Production stays report-only/no live deletion; pins/activation remain T-1991/T-1992.
Existing111s case/113s file bounded allowance unchanged. Duration-check summaries describe selected phases/base-only observations, not end-to-end suite speedups; budgets/lint/ratchet remain report-only where recorded.

C2 checked under binding Coordinatorb6df0611/a09ba32c no-code disposition and explicit evidence relabelling. Source census finds no production recursive .cland/run watcher; tracker watch.ts is nonrecursive .cland/tasks. Retained reader dispositions unchanged.
Low carried:hub/test/suite-retention-writes.test.ts:15 selected writeFile/appendFile/open observations (4intercepted calls/1logical filename) exclude stream/provenance-temp/rename/final inventory. Complete physical per-run census remains UNVERIFIED and is filed as T-1998(Follow-ups,S); no new observer extension required. The passing API-scoped write case is not called a complete census.

Linuxx64droplet c-8ams3, kernel6.8.0-147-generic, Node24.21.0, Neovim0.12.5, workers2. Actual suite browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Producer lifetime1607.975s/cost$0.1116649306 (summary1608s/$0.1117), not test wall time.

Standards/Spec: no new findings; accepted one low scope limitation retained. VerifyC1,C2 under stated bar. Earlier b8f29d1a/A-21615 and b01cb21b/A-21633 remain failed/partial at9c7cabf2b; new corrected-head proof does not rewrite them. Previous parent greens/local selected receipts retain their original scopes. No Reviewer tests, browser, probes or mutations.
A-21656: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21656-t-1957-final-clear-at-2bf90a79c-with-scale-and-scoped-census-receipts.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T08:43:57.394Z

Merged 330472a528639340d234181f1336ba51930cf942 onto dev.
