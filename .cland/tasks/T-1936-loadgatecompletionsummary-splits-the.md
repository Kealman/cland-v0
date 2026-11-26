---
id: T-1936
kind: task
title: loadGateCompletionSummary splits the whole retained semantic log into an array (unbounded allocation, rule 23)
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
regression_of: T-1582
topic: topic-1786
branch: t/T-1936-loadgatecompletionsummary-splits-the
created: 2026-11-17T07:21:10.812Z
updated: 2026-11-26T19:15:12.820Z
closed: 2026-11-26T19:15:12.820Z
---

## Summary

`loadGateCompletionSummary` in hub/src/suite-load-gate-plan.ts (landed with T-1582, 1e4bceff6) runs `log.split('\n')` over the entire retained semantic log, which has no fixed byte or line bound. That allocates an array of the whole history on every batch completion, against rule 23 and suite-log.ts's incremental line policy. Raised by the Reviewer during T-1931's delta review at 84ce9a604 (topic-1584). T-1931's own marker scanner in the same file was already made bounded at review.

## What to build

Scan the log incrementally (an index-based line walk or a shared pure line iterator) with bounded extra storage, keeping the same results: complete, unknown and skipped sets.

## Acceptance criteria

- [x] C1. loadGateCompletionSummary returns identical counts for the existing fixtures, plus a large planted log, without creating a whole-log array (test that bounds the work, as T-1931's bounded-scan control does).
  - done: impl-1936 · 2026-11-25T13:14:34.043Z
  - verified: rev-40 [reviewer] · run rev-40-20261126-1936-final · 2026-11-26T01:18:29.491Z · commit 41be87e257f354ed2044d9b074a68e918be33901

## Comments

### impl-1936 · 2026-11-25T13:12:54.758Z

Confirmed consumer census: loadGateCompletionSummary is called by hub/src/hub/merge-batches.ts and its pure tests; same-module exports are imported by hub/suites.ts, suite-log.ts, test/load-gate.ts, suite-soak-component, suite-stage-rules, suite-summary, suite-tiers, web-phase and suite-landed-load tests. No signature, text grammar, returned count or wire change. Existing parser fixtures retained; large planted log checks bounded allocation and forward scan.

### rev-40 · 2026-11-25T13:16:27.698Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1936-source1
commit: 41be87e257f354ed2044d9b074a68e918be33901
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23414,noinscopefindings. Forward indexOf/currentline scan removeswholelogarray, retainsallregex/emptytrailing/unterminatedcounts; finalidentitycleanup iteratessetswithoutcombinedarray. New suiteCaseownedpurecontrol positively guards split and requires20006searches/exactlinearinputwork/fixture<=200charslice and2complete2unknown; existingsemanticfixturesretained. Publicsignature/shape/productionmerge-batchconsumerunchanged; guideaccuratesets/maxlinestoragecondition. C1done,finalmarkpendingconfiguredexact-headreceipt. LocalMacNode24.21 sixfiles85cases/static0 remain authorpartialproof;720+17unknownreachabilitynotcoverage. AsideS TechdebtadjacentpreexistingloadProofIdentitieswholelogsplitreportedleadseparately,notblocker. No Reviewer execution/edits.

### rev-40 · 2026-11-26T01:18:29.491Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261126-1936-final
commit: 41be87e257f354ed2044d9b074a68e918be33901
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1 verified. A-23508 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23508-t-1936-final-clear-at-41be87e25.md). Exact-head9c7ae0ec/A-23507 passed; canonical0a162919 executable match. Named large semantic scanner base pass11658 and5/5load11821 execute positive split guard,20006search/exact-linear-work/current-line-slice bounds and final2complete/2unknown assertion. All7 planner semantic cases and direct consumers10/19/2/30/17 pass. T0/T1/fallbackT2/245selectedT3/Web exit0; Linuxc8nyc1 workers2 Node24.21/Nvim0.12.5, HeadlessShell1248/CfT156, noncached,12prerequisite skips. RemainingT3 deferred batch; T4 unexecuted, wall/budget advisories report-only, no speed claim. Adjacent preexisting helper debt remains separate T-2106. No findings or Reviewer edits/executions.

Criteria: C1 verified.

### coord · 2026-11-26T19:15:12.820Z

Merged 4b32771d6f053b481736e3599ff46ace99265fb2 onto dev.
