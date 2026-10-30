---
id: T-1477
kind: task
title: The hub selects startup journal history without reading the whole file
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1466
blocked_by: []
topic: topic-1222
branch: t/T-1477-the-hub-selects-startup-journal-history
created: 2026-10-30T07:54:04.775Z
updated: 2026-10-30T09:17:48.090Z
closed: 2026-10-30T09:17:15.122Z
---

## Summary

At startup the hub reads the whole journal (374 MB, 1.1 M lines on this project) into one UTF-8 string, about 0.7 GiB of peak heap (A-14160, `readJournal` journal.ts:483,492). Select the startup history by streaming bounded complete lines or from a durable checkpoint, sharing one in-flight scan, without changing replay semantics.

## Acceptance criteria

- [x] C1. Startup journal selection never holds the whole file in one string. It streams complete lines in bounded chunks, or resumes from a durable checkpoint, and produces the same selected records as today on a recorded journal fixture.
  - done: impl-1477 · 2026-10-30T08:12:18.140Z
  - verified: rev-31 [reviewer] · run rev-20261030-1477-final1 · 2026-10-30T08:31:44.731Z · commit c6daab985cdb0faf03b6ef5d9db0a86f2b32eb3f
- [x] C2. Concurrent readers of the startup history share one scan.
  - done: impl-1477 · 2026-10-30T08:00:35.375Z
  - verified: rev-31 [reviewer] · run rev-20261030-1477-final1 · 2026-10-30T08:31:44.732Z · commit c6daab985cdb0faf03b6ef5d9db0a86f2b32eb3f
- [x] C3. On the T-1467 scratch copy, the heap at the journal-read checkpoint drops by at least 500 MiB against A-14160's 743.7 MiB, same probe and machine.
  - done: impl-1477 · 2026-10-30T08:00:35.912Z
  - verified: rev-31 [reviewer] · run rev-20261030-1477-final1 · 2026-10-30T08:31:44.732Z · commit c6daab985cdb0faf03b6ef5d9db0a86f2b32eb3f
- [x] C4. A test with a journal of at least 300 MB of synthetic lines asserts peak bytes held for the selection stay under a fixed bound (a work-count guard, rule 23).
  - done: impl-1477 · 2026-10-30T08:00:36.011Z
  - verified: rev-31 [reviewer] · run rev-20261030-1477-final1 · 2026-10-30T08:31:44.732Z · commit c6daab985cdb0faf03b6ef5d9db0a86f2b32eb3f

## Comments

### impl-1477 · 2026-10-30T07:56:13.350Z

Consumer inventory: daemon.ts startupHistory feeds Journal history, Tracker planHistory and replayAgentsRecord (released after replay). readJournal sync callers: CLI doctor, hub journal/orphan history, offline-migrate; unchanged. Tests journal-subagents and journal-async; QA briefs T-108/T-117/T-231 refer to sync CLI reader; unaffected. Search covered readJournal/startupOnly/startupHistory and imports across repo including QA, docs, skills and all tests. Adding a separate async startup reader leaves wire/persisted shapes unchanged. Measurement script written first: hub/test/measure-startup-journal.ts; C3 will use original T-1467 probe after slot.

### impl-1477 · 2026-10-30T08:00:55.915Z

Implementation committed/pushed at 714a74357. Evidence A-14163 (durable folder /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14163-t-1477-journal-selection-memory-and-regression-evidence) records same-Mac C3 journal-stage-only result: 743.7 → 61.02 MiB heap, 682.68 MiB reduction. Six journal-subagents T1 tests passed, including >=300 MiB guard and legacy selection parity; typecheck passed; test:lint report-only exit 0 / 124 findings / 0 refusals. Source review requested from responsible Reviewer; no full suite yet.

### rev-31 · 2026-10-30T08:08:09.957Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261030-1477-source1
commit: 714a7435765519bd0e0b124b791328f20e0e820b
scope: full
findings: [{"severity":"medium","text":"M1: per-test guide H1 does not name owning test path; unchanged documentation guard fails. Restore exact heading with owning red/green.","file":"docs/agents/tests/hub-test-journal-subagents.test.ts.md","line":1},{"severity":"medium","text":"M2: early async startup reader rejection skips injected options.flushLog before releasing lock, unlike normal closeLogs. Drain all log work and prove held-flush/actual receipt/lock ordering on this failure path.","file":"hub/src/hub/daemon.ts","line":140},{"severity":"medium","text":"M3: inline constructed examples have no original capture provenance, so C1 recorded-journal parity is unproved. Retain honestly labeled boundary cases and add sanitized captured subset with provenance/equality to prior reader.","file":"hub/test/journal-subagents.test.ts","line":78}]
finding_counts: {"high":0,"medium":3,"low":0}

Source1 not clear,M1/M2/M3; A-14170. Consolidated audit complete; prepared fixes need successor exact-head source review before configured verification. Reused selection predicate/shared scan/chunk+line semantics and input-work guard otherwise reviewed. A-14163 manual C3 comparison remains explicitly precommit working-tree/darwin/stage-only evidence, no final-head or later-stage claims. No runtime marks verified/Reviewer execution;QA none.

Criteria: C1 failed (Recorded-journal parity uses constructed examples without original capture provenance at the reviewed head.).

### rev-31 · 2026-10-30T08:16:14.281Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261030-1477-source3
commit: c6daab985cdb0faf03b6ef5d9db0a86f2b32eb3f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear, A-14179; Standards/Spec zero remaining findings. M1 heading, M2 all-sink early log drainage, M3 captured parity provenance resolved. M4 now pre-owns typed direct acquisition, nonrejecting tagged observer, stop/stopped join of unexpected late success and single fenced root disposal. Actual queued JSON/lock assertions retained; late-success cleanup source-audited, not claimed exercised. Source2 M4 A-14175 was delivered but not saved as a verdict because failed:[] was invalid; this exact-head review resolves it. Runtime C1–C4 remain unverified pending original configured evidence; C3 remains accepted precommit same-Mac stage-only A-14163/A-14169 attribution, not measured at successor. No Reviewer executions; QA none. Configured verification may proceed at this unchanged head.

### rev-31 · 2026-10-30T08:31:44.732Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261030-1477-final1
commit: c6daab985cdb0faf03b6ef5d9db0a86f2b32eb3f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear, A-14198; source3 A-14179 retained. Exact-head configured f9aefa18/A-14197:4231 ordinary+105 separate load-gate passing identities,0 nonpass. T0/T1/all fallback T2/Web complete;T3/T4 absent. C1 recorded-subset+constructed parity,C2 shared Promise/append/failure,C4>=300MiB/<1MiB input accounting each base+5extra pass. Native log/lock cleanup controls base+5extra pass. C3 verified from separately attributed Coordinator-accepted precommit same-Mac journal-stage A-14163/A-14169 versus A-14160:743.702→61.019MiB heap,682.682MiB less; unchanged reader through final head. Not a final-head/Linux memory run,retained-after-GC/RSS or later-stage result. Scale base2.194s,max2.393s;T1.5s advisory exceeded,report-only budgets/lint124/60 retained;0 static refusals. Host gate290a3047 reused,not remote repeated;browser CHS156/v1248. No Reviewer workloads;QA none. All C1–C4 verified;configured final clear,broader integrated cover remains Coordinator-owned.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-30T09:17:15.122Z

Merged e91d6ad0258f70f915cd1808165c37a2e89693ba onto dev.
