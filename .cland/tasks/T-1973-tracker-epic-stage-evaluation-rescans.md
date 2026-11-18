---
id: T-1973
kind: task
title: Tracker epic-stage evaluation rescans every suite job for every stage of every planned epic on each tracker write; hub idles at ~100% CPU and a planned check stalls it to exit
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1627
branch: t/T-1973-tracker-epic-stage-evaluation-rescans
created: 2026-11-18T12:32:56.347Z
updated: 2026-11-18T16:22:46.008Z
closed: 2026-11-18T16:22:46.008Z
---

## Summary

After restart #84 (2026-11-18, dev 93026cbe9), hubs 20702 and 52877 ran at 85–109% CPU from start, against 40–55% after #83. On 20702 a 60 s stall of a planned check on E-1883 exited the hub (T-1972). Three 8 s profiles of 52877 (12:31–12:32Z, by the hub operator session) show main-thread JavaScript in the tracker's epic-stage evaluation, with the main thread only 32–40% idle:
- `#stagesOf` (tracker.ts:1980) 17–18.5% and `#stageCover` (tracker.ts:1926) 9.5–12%, which calls `stageCovers` (suites.ts:466);
- the callers: freshness `#work` (freshness.ts:330) 15–16%, `settled` → `#announceBatch` (tracker.ts:445, :606) 14–15%, `#refreshExplorer` → `#rawSummary` (tracker.ts:2198, :2168) 11–13%, and `#checkPlanned` (tracker.ts:549) 7.6–8.1%;
- `inbox.list` (inbox.ts:335) at 17–19%, up from 5% after #83;
- self time mostly SQLite (`all` 11–13%, `get` 8–9%, `prepare` 6–8%).

`stageCovers()` filters and flat-maps the whole in-memory suite job list on every call (`suite_job_summaries` has 4,686 rows), and `#stagesOf` calls it once per stage of every planned epic. Every tracker write re-evaluates it. The code is old (last changed 2026-10-16 to 10-19); what grew is the input: eight planned 0.4.1 epics with many stages and an ever-longer job list. None of the hot frames belong to T-1894, T-1964 or the lease pass.

## What to build

Compute stage covers once per job-list change, indexed by tree and occasion, and let stage evaluation look them up instead of rescanning all jobs per stage. Cache prepared statements on the hot paths that prepare per call. Keep every stage-cover result unchanged.

## Acceptance criteria

- [x] C1. With 5,000 suite jobs and 10 planned epics of 3 stages each, evaluating all stages after a tracker write visits each retained job at most once per job-list revision for shared eligibility and ancestry, observed through the real iteration (including an all-rejected-history control), while stage-specific containment checks run only over the eligible candidates and are counted separately (test).
  - done: impl-1973 · 2026-11-18T13:59:47.901Z
  - verified: rev-35 [reviewer] · run rev-35-1973-source-3 · 2026-11-18T14:03:44.074Z · commit e394753cd534150c48597d1cc0044c0f82bb8f0d
  - verified: rev-35 [reviewer] · run rev-35-1973-evidence-1 · 2026-11-18T14:39:23.745Z · commit e394753cd534150c48597d1cc0044c0f82bb8f0d
- [x] C2. Stage-cover results (cover tree, missing platforms, linux/macos run ids, closure) are identical to the current implementation on a recorded fixture of epics and jobs (test).
  - done: impl-1973 · 2026-11-18T12:49:15.758Z
  - verified: rev-35 [reviewer] · run rev-35-1973-source-3 · 2026-11-18T14:03:44.074Z · commit e394753cd534150c48597d1cc0044c0f82bb8f0d
  - verified: rev-35 [reviewer] · run rev-35-1973-evidence-1 · 2026-11-18T14:39:23.745Z · commit e394753cd534150c48597d1cc0044c0f82bb8f0d
- [x] C3. A fixture hub at that scale answers a planned check and an explorer refresh with bounded work, asserted on deterministic counts (jobs visited, rows decoded), with elapsed time recorded report-only and never asserted (test); the inbox.list and prepare-per-call hot paths are fixed here or named as follow-ups (T-1975, T-1976) with their profile shares.
  - done: impl-1973 · 2026-11-18T13:23:05.364Z
  - verified: rev-35 [reviewer] · run rev-35-1973-source-3 · 2026-11-18T14:03:44.074Z · commit e394753cd534150c48597d1cc0044c0f82bb8f0d
  - verified: rev-35 [reviewer] · run rev-35-1973-evidence-1 · 2026-11-18T14:39:23.745Z · commit e394753cd534150c48597d1cc0044c0f82bb8f0d

## Comments

### impl-1973 · 2026-11-18T12:40:45.880Z

Consumer audit and pre-index oracle: A-21239, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21239-t-1973-consumer-audit-and-pre-index-oracle.md. Searches cover stage-cover/state names and raw fields across production, CLI task plan show, web, Neovim, persisted readers, shipped skills, QA briefs, frozen fixtures and all test tiers. Replies/closure storage remain unchanged; no consumer migration or tier move. Secondary profile costs tracked by Coordinator as T-1975 (inbox.list 17–19%) and T-1976 (prepare self 6–8%).

### rev-35 · 2026-11-18T12:55:53.893Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1973-source-1
commit: 00b3880b8e0dfa309191e50687ac2563fc2688a0
scope: full
findings: [{"severity":"medium","text":"New scale callback and both new persistence callbacks lack pre-acquisition whole-body/setup ownership; fixture resource hooks do not join original continuations on cancellation. Enroll shared normal/signal ownership, adopt late acquisitions and retain roots until original/resource work joins. A-21251 M1; author confirms 0873b4fb.","file":"hub/test/stage-closure-component.test.ts","line":16},{"severity":"medium","text":"The three new fake-only callbacks have no positively controlled counted native-launch guard through setup/body/cleanup. Semantic Git/worker fakes and TestContext-owned LocalExecutor seams do not establish isolation or seam lifetime through original-work join. M2.","file":"hub/test/suite-persistence.test.ts","line":114},{"severity":"medium","text":"C1 remains unproven: per-stage paired-history walks can revisit all rejected candidates, while the counter only logs #jobs.length after building Suites receipts (suites.ts:474). stageMissing also filters receipts per call. Count actual relevant visits and exercise rejected history with a positive repeated-work control; the old 0!==5000 red only lacks the new event. M3.","file":"hub/src/tracker/tracker.ts","line":1971},{"severity":"medium","text":"tracker.list can read the cached projection; a 40-row assertion plus declared index length does not force/observe explorer refresh or measure planned-check/refresh work required by C3. Observe the real invalidation/refresh receipt and assert actual counts; keep timing report-only. M4.","file":"hub/test/stage-closure-component.test.ts","line":65}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source00b3880b8/base93026cbe9 tree0171393c: Standards2medium, Spec2medium, A-21251. Author confirms ownership/guard gaps0873b4fb, declared-count/cached-explorer overclaims6b05f844 and rejected-history gapcb2c834b. Indexed ordering/unknown ancestry, transient include and saved closure semantics look preserved; C2 implementation-done/equality support retained, no final runtime verification. Coordinator e0d5de8d timing report-only and T-1975/T-1976 secondary-cost dispositions honored. A-21248 corrects A-21243 and supersedes A-21246; local66/66 focused,61unique T1 files699/699, full lint/typecheck0 are precommit working-tree evidence, not immutable invocation hashes or same-head verify. Earlier44/45, lint/type/development failures retained; no T3/T4/Web/droplet/QA. Read-only Reviewer; no tests/probes/edits. Hold released for consolidated bounded ownership/isolation and actual work/refresh proof corrections; fresh clean pushed-head source review before verification.

Criteria: C1 failed (Actual job/candidate visits are not observed; declared index size and a newest-valid-pair fixture do not establish the once-per-history bound, including rejected candidates.), C3 failed (The scale case does not force/observe explorer recomputation or count actual per-operation work; cached list membership and declared index size are insufficient.).

### impl-1973 · 2026-11-18T13:08:23.475Z

Review-revision consumer audit: new optional FreshnessOptions.ancestryChanged observer is consumed only by Tracker; direct constructors in freshness.test.ts and follows-native.test.ts remain compatible because it is optional. Producer notifies structured commit/tip/current facts on settled ancestry and retry invalidation; existing settled(ids) callback shape is unchanged. SuiteSchedulerOptions.stageJobs is an optional iterable instrumentation seam, forwarded only by plan-stage-fixture; default production source remains the complete job list. Existing StageCover/closure wire and stored shapes are unchanged. Search included raw constructor/field names across hub/src, all hub/test tiers, docs, QA, skills, Neovim and web. StageCandidates is internal pure ordering; CLI/web/Neovim readers still consume the same arrays/fields. C1 scope clarified by Coordinator cdf23bb4: shared eligibility/ancestry work bounded independently from stage-specific containment.

### rev-35 · 2026-11-18T13:28:18.983Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1973-source-2
commit: c8bbb6e241a615793b4259a5c7d81e15e7ba3f34
scope: full
findings: [{"severity":"medium","text":"The new guardedLeaseCase uses can restore patches/native guards after a captured cleanup rejects: drainFixtureWork observes no pending work once that rejected promise leaves the set, not a positive Suites/hub close. Persistence cleanup at :88 can reject before Store/root disposal. Require an explicit positive original-work/resource-close fence before restoration for these new cases, with actual refusal-path proof; keep unknown cleanup incomplete. A-21269; author95a1c757.","file":"hub/test/suite-persistence.test.ts","line":122}]
finding_counts: {"high":0,"medium":1,"low":0}

Full corrected sourcec8bbb6e24/base93026cbe9 tree33ebb6ea: Standards1medium, Spec0; A-21269. Earlier pre-acquisition admission/actual-count/rejected-history/forced-refresh gaps otherwise resolved. Primary Coordinatorcdf23bb4 clarified shared eligibility/ancestry vs stage containment; actual generator yields and structured retry-linked lazy candidates honor that scope. Old-Tracker mixed replay fails150000!==0; positivecontrol75000 and indexedsettled0, forced title publication/list receipt and per-operation0 extra eligibility; C2 equality/pending/closure retained. C2/C3done remain, no finalverification. A-21265 durableSHA256 matches; current61uniqueT1files700/700, stageclosure10/10, freshnessT2realGit10/10, full lint/typecheck0/zero refusals; all scopes/signals/raw capture limits qualified and earlier failures retained. No T3/T4/Web/configured/QA claim. Read-only Reviewer, no tests/probes/edits. Hold released for bounded positive-cleanup restoration correction, then fresh pushed-head source review before verify.

Criteria: C1 failed (The new guarded regression fixture lacks a positive resource-close receipt fencing guard/seam restoration after rejected cleanup; ordinary work counts remain useful and are not the failure.).

### rev-35 · 2026-11-18T14:03:44.074Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1973-source-3
commit: e394753cd534150c48597d1cc0044c0f82bb8f0d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected sourcee394753cd/base93026cbe9 tree940a3a76 clear; Standards0 Spec0, A-21284. A-21269 residual close-restoration gap resolved by item-local stageCase: original/pending join plus fulfilled required resource-close receipts precede storage/root cleanup and restoration; failed close retains real guards/seams and retries sameowner, while ancillary diagnostic stays reported after positive closure. Partial component startup cleanup registeredbeforeacquisition; nestedowners prerequisites. Real refusal/recovery identities+readableStore/retainedDB and negative removed-fence red exerciseboundary. Production unchanged since acceptedc8 Spec; actual5000yield/75000positive/0settled rejected-head and forced title publication/counts retained under Coordinatorcdf23bb4; C2oracle/differential/pending/rollback/closure intact, timingreportonly. All criteria source/local verified; final configured evidence stillpending. A-21283 hashmatches; current61uniqueT1files700/700, stageT2closure10/10, fullstatic/lint/typecheck0/zero refusals; freshness10/10 remains oldc8qualified. Failed/intermediateepochs/native-metadata/rawcapturelimits preserved. No T3/T4/Web/configured/QA claim. Sharedguardhelperunchanged. Read-only Reviewer no tests/probes/edits. Hold released; keepheadstable, request Coordinatorwindow then mode-free same-head verify.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1973 · 2026-11-18T14:33:07.448Z

Same-head configured verification dbfbdd26-82d4-4405-a6c7-0b5cbb6eed1c passed at e394753cd534150c48597d1cc0044c0f82bb8f0d, canonical tree a797da4e91342325a485dbf14c6f5196778ce34f. Durable A-21294: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21294-suite-dbfbdd26-82d4-4405-a6c7-0b5cbb6eed1c-auto-at-e394753.log. Hub aggregate 6787/6787 pass, zero fail/cancel/skip; T0/T1/T2/Web completed; task fallback ran all T2. T3 remains for merge batch/integrated cover, T4 unexecuted here. Independently checked structured finish receipts for all four new generated cases: each base pass plus 5/5 load-gate passes (5,000-receipt oracle/reload; prune/include and close-refusal/recovery; 10-epic/30-stage actual-work/forced-refresh; rejected candidate retry ordering). Final provenance records droplet c-8 ams3 Linux x64 6.8.0-147-generic, Node24.21.0, Neovim0.12.5; browser binary chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Resource lifetime1424s, cost$0.0989, workers2. Lint/duration/budget warnings are report-only and not claimed as enforce-mode performance passes. Local T0 window was released at its durable exit0 receipt. Head/worktree remain unchanged; waiting for Reviewer same-head settlement.

### rev-35 · 2026-11-18T14:39:23.745Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1973-evidence-1
commit: e394753cd534150c48597d1cc0044c0f82bb8f0d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; Standards and Spec have no findings. A-21296 audits producer-owned dbfbdd26/A-21294 finished/passed at e394753cd, exact 713 selected ordinary files / 6,787 ordinary cases, all four required identities with base plus 5/5 load passes, and file/phase/provenance receipts. C1/C2/C3 verified. T0/T1/all T2 (including Neovim 385 cases/44 files)/Web complete; T3 deferred and T4 unexecuted. Report-only lint/timing/tier advisories retain their limits; no task-file tier warnings. Evidence correction: freshness.test.ts is T3 in all pinned manifests, so its earlier c8bbb6e24 local 10/10 is not T2 or exact-head configured proof. Verification snapshot a797da4e and Git tree 940a3a76 are distinct objects. Earlier failed/incomplete rounds remain retained. Full audit: A-21296, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21296-t-1973-final-same-head-evidence-clearance-at-e394753cd.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1973 · 2026-11-18T14:39:53.245Z

Final Reviewer settlement A-21296 is clear at e394753cd: C1/C2/C3 verified, no findings, configured run dbfbdd26 passed all 713 selected files and 6787 ordinary cases, all four required identities base +5/5 load. T0/T1/all T2 including Neovim/Web completed; T3 deferred and T4 unexecuted. Evidence correction: freshness.test.ts is T3 in pinned 930/c8/e394 manifests; earlier item comments/artifacts calling its local c8 10/10 T2 were incorrect. That earlier-head native/T3 run is not current configured T3 evidence. A-21296 supersedes those labels while preserving prior failed/incomplete rounds and report-only advisories. No new source or rerun.

### coord · 2026-11-18T16:22:46.008Z

Merged da95b9681af8bc97339aaf6271955ce2ab6470c4 onto dev.
