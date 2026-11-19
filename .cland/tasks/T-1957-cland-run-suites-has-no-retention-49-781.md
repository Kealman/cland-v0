---
id: T-1957
kind: task
title: ".cland/run/suites has no retention: 49,781 entries and 68 GB, constantly rewritten, feeding fseventsd's growth on macOS"
state: open
status: review
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
updated: 2026-11-19T02:36:48.987Z
---

## Summary

On 2026-11-18 04:38Z cland-impl found macOS fseventsd (pid 337, up about 35 h) holding 36 GB of memory (35 GB compressed) at 142% CPU. Swap was 30.6 of 31.7 GB, and free disk fell from 87 GB at 03:06Z to 69 GB at 04:38Z. This is the same class as 2026-10-28. `.cland/run/suites` holds 49,781 entries totalling 68 GB, and `.cland/run/executor/leases` 4,217 directories (T-1950 stops the hot reads, not the growth). The hub writes and reads under `.cland/run` constantly, and something watches that tree recursively. Nothing removes old suite run directories, so disk and file-event load grow without bound. The machine's own load also degraded local macOS covers all day, adding to T-1950's hub CPU.

## What to build

A retention rule for `.cland/run/suites`. Keep every run still referenced by a live verify, batch, cover or QA verdict, plus the last N runs per occasion, and archive or delete older ones after their artifacts (logs and coverage maps under `.cland/artifacts`) are confirmed durable. Name the recursive watcher on `.cland/run`, and narrow it to the paths it needs.

## Acceptance criteria

- [x] C1. With a fake run root of 50,000 run directories, retention in report mode (rule 27) computes exactly the referenced, recent and evidence-class runs to keep and the rest it would retire, logs those counts without deleting anything, runs in bounded yielding batches only after serving, and is idempotent; its guarded deletion owner is proven on a disposable root behind an off-by-default switch (test).
  - done: impl-1957 · 2026-11-19T02:32:50.268Z
- [x] C2. The file-event load on `.cland/run` is accounted for with evidence: every in-repo watcher is listed with the paths it watches, the files written per suite run are counted on a fake run, and every reader of old suite run directories (rule 41) is listed with its disposition (test or artifact).
  - done: impl-1957 · 2026-11-19T02:32:50.724Z

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
