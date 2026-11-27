---
id: T-2002
kind: task
title: Coverage-download failures keep only the latest error; earlier attempts leave no durable diagnostic
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1806
branch: t/T-2002-coverage-download-failures-keep-only-the
created: 2026-11-19T10:01:10.786Z
updated: 2026-11-27T09:04:58.852Z
closed: 2026-11-27T09:04:58.852Z
---

## Summary

Coverage downloads (`Machine.get` from `collectCoverage` in Suites) keep only the latest failure in `job.error`, which later attempts overwrite or clear. Earlier failed attempts leave no durable diagnostic. T-1729 (2026-11-19) made delivery uploads keep durable per-attempt diagnostics but scoped downloads out.

## What to build

Persist each failed coverage-download attempt's bounded stderr tail and exit or signal in the run's durable diagnostic, as T-1729 does for uploads. A later success or retry must not erase an earlier failure (rule 40).

## Acceptance criteria

- [x] C1. Two failed coverage-download attempts followed by a success leave both failures in the run's durable diagnostic with their transport facts (test with a fake Machine.get).
  - done: impl-2002 · 2026-11-27T07:43:06.808Z
  - verified: rev-40 [reviewer] · run rev-40-20261127-2002-final · 2026-11-27T08:30:23.574Z · commit 4a6172663e69ab87cd2fe2f4ceb9cd0d02471ec2

## Comments

### impl-2002 · 2026-11-27T07:36:08.101Z

C1 red/green: fake Machine.get fails twice (exit 255 and SIGTERM), succeeds third time; suite.log must retain both failure messages and previous bytes. Red missing first transport diagnostic; green 1/1 macOS Node 24.21.0. Consumer search collectCoverage and executor/droplet/run.ts: production Suites, executor facade/dependencies; scripted machine fake; suite-accounting, suite-soak-component, clock and executor component tests. Signature/wire/storage shapes unchanged; existing callers unaffected. Only new append to run-local suite.log, using existing bounded redacted MachineRequestError.message. Direct module importer list also includes executor-prepare, verification-workers, executor-lease-index, executor-run-rules, suite-timing-persistence; state-paths inventory and suite-bundle-native/system-processes reference source paths. Docs running.md scoped-out wording replaced.

### impl-2002 · 2026-11-27T07:43:06.997Z

Final design supersedes the initial suite.log append: coverage-download.log is separate from the remote byte mirror; shared coverageDownloadDiagnostic resolves it for producer and Suites. Published immutable suite log includes its pointer after collection. T-2029 readSuiteInventory counts arbitrary files and retirement removes whole owned run directories; regression now retains download diagnostics across interrupted removal and confirms eventual whole-run deletion. Exact file inventories found in suite-retention-writes use no failing downloads and stay unchanged. Consumer audit and red/green plus 230 local T1/T2 passes, typecheck and full lint evidence: A-23756. Import graph over both changed sources proves 736 reachable tests; 19 non-literal/unresolved cases are unknown, so the complete reachable count remains unknown. No full suite, T3/T4 or Web receipt claimed locally.

### rev-40 · 2026-11-27T07:46:04.130Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261127-2002-source1
commit: 4a6172663e69ab87cd2fe2f4ceb9cd0d02471ec2
scope: full
findings: [{"severity":"low","text":"L1: pointer dedup reads semantic evidence which drops this prefix; reporting retry before finalizedLog can append identical pointer again. Final checkpoint fences repeats; transport bytes/remote offsets unaffected. XS Bugs follow-up for semantic/raw-line dedup and retry control.","file":"hub/src/hub/suites.ts","line":2183}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear with one low; A-23757 records Standards/Spec. Every settled coverage copy failure appends existing bounded/redacted producer exit/signal facts before rethrow; success preserves both failures/existing bytes. Shared separate diagnostic path preserves remote byte mirror; pointer follows settled collection and immutable publication. Fake whole-case two-failure/success, pointer and interrupted-retirement controls retain actual assertions; scope/retention docs migrated. Low L1 duplicate pointer on pre-finalization retry confirmed083f2d38; no high/medium or C1 transport-retention blocker. A-23756 local230/static0 scoped; no full/Linux/browser proof,736reachable+unknown total not coverage. C1 done/unverified pending authorized same-head configured receipt. Hold released; no Reviewer edits/executions.

### rev-40 · 2026-11-27T08:30:23.574Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261127-2002-final
commit: 4a6172663e69ab87cd2fe2f4ceb9cd0d02471ec2
scope: evidence
findings: [{"severity":"low","text":"L1 retained: semantic evidence omits diagnostic-pointer prefix, so retry before finalizedLog can duplicate pointer. Diagnostic bytes/remote offsets unaffected; Coordinator filed T-2118 (XS Follow-ups).","file":"hub/src/hub/suites.ts","line":2183}]
finding_counts: {"high":0,"medium":0,"low":1}

Final clear; A-23766 audits f8f4406b/A-23765 at reviewed4a6172663. Producer0/cause empty/unfinished[], complete T0/T1/fallbackT2/selected251T3/Web0, canonicalbd0f1db1 executable match. C1 two-failure/success case base+5/5 retains exit/signal/stderr facts and previous bytes; published-pointer case base+5/5 and interrupted-retirement case pass. All8 changed/nearby files pass; counts distinguish repetitions. C1 verified; no high/medium, pointer-retry low retained under T-2118. Noncached Linuxc16nyc1 workers4 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156,12declared prerequisite skips,budgetsreportonly; remainingT3batch/T4unexecuted. No real-copy performance or follow-up-fix claim. Hold released; no Reviewer execution.

Criteria: C1 verified.

### coord · 2026-11-27T09:04:58.852Z

Merged 4464147fe36de69f2db43d4951c9f138b0e3e397 onto dev.
