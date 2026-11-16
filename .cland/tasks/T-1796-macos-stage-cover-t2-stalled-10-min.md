---
id: T-1796
kind: task
title: macOS stage cover T2 stalled 10 min after its last file passed (command end 1, no failing test)
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1547
branch: t/T-1796-macos-stage-cover-t2-stalled-10-min
created: 2026-11-09T18:33:53.922Z
updated: 2026-11-16T13:12:43.545Z
closed: 2026-11-16T13:12:43.545Z
---

## Summary

The macOS local stage cover e50b7ddb at dev 700f88ce (A-18171) ended `exit 1; stalled: no output for 10 min` in T2 with no failing test: 1611 pass, 0 fail. The last T2 files, web-tunnel-guide.test.ts and web-upload.test.ts, both ran to `finish … outcome pass`. Then the log shows `suite command end … 1` and nothing more until the 10-minute stall guard fired. So the T2 command didn't exit after its last file completed: a handle or child process survived the file teardown, or the runner waited on something. Its "last started tests" list names files that had in fact finished. Alone, both files pass 5/5 in about 1 s each on macOS at the same commit.

## Acceptance criteria

- [x] C1. The stall report keeps the evidence that tells what kept the T2 command alive after its last file finished: the command still alive, or an inherited pipe writer after it exited, with bounded process names and pids captured before cleanup. A-18171's own survivor is recorded on the item as unknown, since its log has no native evidence (test).
  - verified: rev-36 [reviewer] · run rev-36-1796-final-1 · 2026-11-16T10:56:15.371Z · commit 2b2ea08a47a34306e84a1e78cf02e2608513a93f
  - done: impl-1796 · 2026-11-16T11:17:50.503Z
  - verified: rev-36 [reviewer] · run rev-36-1796-merge-final-1 · 2026-11-16T11:48:05.386Z · commit 446d8ae90ea6b0037d0cec4e9927cc76540bec00
- [x] C2. The stall report's "last started tests" lists only tests that started without finishing (test).
  - verified: rev-36 [reviewer] · run rev-36-1796-final-1 · 2026-11-16T10:56:15.371Z · commit 2b2ea08a47a34306e84a1e78cf02e2608513a93f
  - done: impl-1796 · 2026-11-16T11:17:50.716Z
  - verified: rev-36 [reviewer] · run rev-36-1796-merge-final-1 · 2026-11-16T11:48:05.386Z · commit 446d8ae90ea6b0037d0cec4e9927cc76540bec00

## Comments

### impl-1796 · 2026-11-16T09:54:35.262Z

Consumer sweep (rule 20): suiteCommand callers hub/src/hub/suite-worker.ts and hub/src/release-web.ts retain {code,cause}; hub/src/hub/suite-cover.ts and hub/src/hub/suites.ts classify the unchanged stall prefix. suite-log.ts parses command end, unchanged. suite-timeouts.test.ts (T3), suite-worker-cause.test.ts, suite-cover.test.ts, executor-run-rules.test.ts and suite-summary.test.ts retain existing cause/prefix compatibility. suite-progress.ts, suite-progress.test.ts and suite-runner.test.ts consume unchanged reporter progress frames. CLI suite.ts, heartbeat, Neovim and web render log/cause text; no structured stall field changed. Searched field, text, frame and function names across hub, nvim, web, shared, qa, docs and shipped .agents skills (all tiers included); no QA/skill parser of last-started text found. Updated running.md/tests.md to unfinished-only semantics. New log-only process census is additive; no wire/result fields removed.

### impl-1796 · 2026-11-16T09:59:40.989Z

A-18171 historical survivor is unknown: the retained log contains file completion receipts but no native process/handle evidence. command end 1 is written by suite-worker after suiteCommand returns and does not prove native exit preceded the stall. Coordinator disposition 84220cad accepts prospective deterministic diagnostics under rewritten C1; A-19945 and fake-child tests distinguish command pending exit from native exit 0 with inherited-pipe writer, capturing evidence before cleanup at unchanged source head 203d6eb0f92fe44ffac391c59423d1adde5667b1.

### rev-35 · 2026-11-16T10:04:12.943Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1796-source-1
commit: 203d6eb0f92fe44ffac391c59423d1adde5667b1
scope: full
findings: [{"severity":"medium","text":"New census lacks semantic retention in suite-log/readSuiteEvidence/cache/report consumers; ordinary fallback truncates each line200chars and retains20lines, so full process facts can be torn/evicted. Add retention and capped/noise regression.","file":"hub/src/suite-command.ts","line":81},{"severity":"medium","text":"New fake-child stall cases restore mocks without settling/joining the admitted suiteCommand on early failure. Own a terminal fake-child receipt and attempt-all join before restoration.","file":"hub/test/suite-command.test.ts","line":29}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source pass A-19949, two confirmed medium findings. Revised C1 prospective scope independently confirmed under Coordinator84220cad; historical A-18171 survivor remains unknown. C2 source tracking present but runtime verification pending. A-19947 original hit/receipt/capture limits retained; no transitive execution proof inferred. Ordinary excerpt fallback is20lines (correcting initial question's eight). No Reviewer runtime work. Hold released for consolidated corrections and fresh source review before verification.

Criteria: C1 failed (New diagnostic is not preserved through canonical evidence retention, and its fake-child regressions lack failure-path command joins.).

### impl-1796 · 2026-11-16T10:07:05.606Z

Review correction consumer migration: suite-log.ts shared semantic evidence regex now retains suite stall processes in both streaming suiteLogLines/readSuiteEvidence and in-memory SuiteLogEvidence/suiteEvidence. suites.ts evidence/cache/receipt paths inherit that retention; suiteSummary priority output retains a log-artifact pointer for capped dispatch.ts publication (both ordinary and fallback paths call this same summary). Existing result/wire fields unchanged. Added exact T2 cases: stall census survives semantic retention and capped reporting after command noise (suite-log-backfill.test.ts), capped stall publication keeps a log pointer and complete process census (suite-selection-component.test.ts). Tested32-record census plus subsequent noise; old prefix consumers, native ownership/defaults and QA display remain as previously inventoried. New per-test docs cover both boundaries. No transitive or native execution coverage is implied; unchanged T3/T4 deferred to integrated coverage.

### impl-1796 · 2026-11-16T10:09:34.221Z

Retained failed run: full suite-selection-component.test.ts had4 failures, each Error: the hub refused: no hello received at shared/socket-client.ts:80; native exit1,duration_ms10462.059792. Concurrent task comment timed out on live hub. Coordinator disposition cff53236 identifies overlap with T-1724 loaded slot, load18.5 and hub unresponsiveness; slot stopped. Authorized solitary rerun at entryload11.24 passed4/4,exit0,duration_ms1269.303875 (macOS arm64 local Node24.21,no browser). Failed run retained as load-coincident, not a shared defect for now. New census-alone case had also passed before that overlap. No production stall-latency inference.

### rev-36 · 2026-11-16T10:17:39.462Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1796-source-2
commit: 54ca8c0df6e659525748a701f949c2e5b2fc685d
scope: full
findings: [{"severity":"medium","text":"Pre-cleanup command exit and stdout/stderr EOF remain only in ordinary stalled-cause text, which semantic evidence can truncate/evict. The retained census JSON lacks these facts, and inspection failure before census can replace outcome.cause in suite-worker, leaving no semantic distinguishing receipt. No alternate owner/raw-only exception (claimant a6deeb02). Emit/retain a bounded semantic command-state record before fallible native work, preserve old cause fields, and cover inspection rejection plus reduction/noise/capped reporting.","file":"hub/src/suite-command.ts","line":63}]
finding_counts: {"high":0,"medium":1,"low":0}

Full corrected source audit A-19960: Standards0/Spec1 medium. Both prior A-19949 findings resolved: complete census semantic retention/pointer and pre-admission fake-child terminal/join owner. Remaining pre-cleanup command-state retention gap confirmed by claimant. Revised C1 historical survivor unknown directly verified against Coordinator84220cad; no historical-cause claim required. C2 unfinished-only tracking present but unverified. A-19956 candidate/tool/raw/failed-load-run limitations retained; Coordinatorcff53236 solitary rerun disposition read, not a current configured pass. No criteria verified. Hold released for one consolidated correction, restored C1 done and fresh head review before verification; no native/provenance rerun requested.

Criteria: C1 failed (Command exit/pipe state can be lost by semantic reduction or inspection failure before census emission, defeating the live-command versus inherited-writer diagnosis.).

### impl-1796 · 2026-11-16T10:20:12.526Z

Second source correction consumer migration: bounded suite stall command log receipt captures commandPid, native exit or pending-null and stdout/stderr EOF before native cleanup awaits. Shared suite-log.ts semantic namespace retains both suite stall command and suite stall processes through suiteLogLines/readSuiteEvidence and SuiteLogEvidence/suiteEvidence/cache readers. suites.ts priority summary recognizes either receipt for dispatch capped log pointer even if no census exists. Old {code,cause}, stall prefix and diagnostic text preserved. New fake failure variants plus streaming and actual capped publication command-only cases cover inspection rejection before census; old report clients still render unchanged outcome/log fields. No shared schema/default/permission/dependency change, no native execution coverage claim.

### rev-36 · 2026-11-16T10:24:40.137Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1796-source-3
commit: 2b2ea08a47a34306e84a1e78cf02e2608513a93f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source audit A-19965: Standards0/Spec0. Sole A-19960 blocker resolved: bounded semantic suite-stall-command state is emitted synchronously before native awaits, retained by shared streaming/in-memory/cache namespace, and command-only evidence drives capped artifact pointer. Red inspection-failure2/5 -> green5/5, full backfill5/5 and actual capped dispatch5/5 recorded in A-19964 with candidate/raw limits; exact exit/pending/EOF and no cleanup authority assertions intact. Earlier census-retention and pre-admission fake-child join fixes remain. C1 done restored; no criteria verified/final ready until exact-head configured result/consumer reconciliation. Historical survivor unknown under Coordinator revised C1; failed load-coincident run and report-only advisories remain qualified. Source clear at2b2ea08a4 permits authorized mode-free verification; no new source changes without review.

### rev-36 · 2026-11-16T10:56:15.371Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1796-final-1
commit: 2b2ea08a47a34306e84a1e78cf02e2608513a93f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head audit A-19978 / independent ledger A-19977: C1/C2 verified. A-19975 run3f3f680f passed at reviewed2b2ea08a4; all15 changed-file cases base pass, eight new diagnostics/retention/capped-dispatch identities each additional5/5, max0.755075113s. Positive command state/census, inspection-failure reduction/pointer and completed-file exclusion checked with source assertions; historical A-18171 survivor remains unknown under revised C1. Deduplicated6395 base test/700 file passes plus separate250 load test/file passes; conservative984 manifest paths =700 lower/Web positive +267T3/17T4 explicit deferrals, no lower/Web gap. A-19947 original16-path hit set retained and expanded; A-19976 caller/native/QA/transitive limits explicit. Exact Linux/Node/browser provenance36986, no cache/skips; local/failed-load/raw/source-linkage limits and report-only advisories retained. No actual native cleanup/stall-cause diagnosis or fullT3/T4 claim. Hub/Coordinator own ready/landing.

Criteria: C1 verified, C2 verified.

### rev-36 · 2026-11-16T11:20:35.203Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1796-merge-source-1
commit: 446d8ae90ea6b0037d0cec4e9927cc76540bec00
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge-delta source audit A-19984: Standards0/Spec0. Both parents confirmed (prior clear2b2ea08a4/captureddev6e6b709de). Only manual conflict semantic matcher resolves exact union of suite-stall namespace plus execution-summary/unexecuted/incomplete-tier retention. Task command/tests unchanged; summary pointer and imported execution/interruption evidence coexist without dropping prior state. Auto docs/index retain both families. Coordinator18153b51/0c5a8fd9 one-merge plan read directly; later dev not required/remerged. A-19983 local focused5/5 task files, hung-component5/5,summary4/4,typecheck/lint completions retain candidate/raw/report-only limits. Prior configured A-19975 belongs old parent, no new-head runtime carry or criteria verification. Source clear at446d8ae90 permits required new authorized mode-free verify/window then same-head evidence settlement; historical survivor remains unknown.

### rev-36 · 2026-11-16T11:48:05.386Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1796-merge-final-1
commit: 446d8ae90ea6b0037d0cec4e9927cc76540bec00
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final audit A-20008 / independent union A-20007: run9ec39727/A-20004 passed exact reviewed446d8ae90; C1/C2 verified anew, old parent marks superseded.15 task base passes and eight new5/5 extras positive; all5 execution-inventory interaction cases and inherited mapped guards positive; selected imported executable-pathT3 two native cases/file passed once. Deduplicated6406 base test/703 file passes plus separate250 load test/file passes.987-path conservative union preserves all prior984+three additions:703 positive +267T3/17T4 deferrals, no lower/Web gap. Exact Linux/Node/browser provenance37062/execution tree652048b1 distinct from Git tree6fcc6d60; no cache/skips. A-20006 actual selection and A-19983/predecessor capture/report-only limits retained; A-19975 not carried. Historical survivor unknown, actual native stall cleanup/fullT3/T4/integrated QA unclaimed. Hub/Coordinator own ready/landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T13:12:43.545Z

Merged f6c633fae418114e334a19f0ec4e8bea8c555292 onto dev.
