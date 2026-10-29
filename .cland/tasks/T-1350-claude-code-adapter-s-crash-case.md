---
id: T-1350
kind: task
title: claude-code-adapter's crash case advances its injected clock once and can miss a late OS exit
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1191
branch: t/T-1350-claude-code-adapter-s-crash-case
created: 2026-10-26T22:36:48.083Z
updated: 2026-10-29T16:48:40.393Z
---

## Summary

hub/test/claude-code-adapter.test.ts::"a crashed Claude Code process: the state turns unknown and the hub logs it once; launched again under its name, it works" intermittently fails with "the process gone: not within 15000 ms". It hit T-1341's rule 6 run 09c84a9b (A-12503, Linux) and older logs (A-1151, A-1544, A-1551). It passed 5/5 alone. The test advances its injected clock by 150 ms once, right after `killDaemon`. If the OS exit is observed later than that, under load, the hub's watcher never ticks again on the frozen clock, and the wait times out.

## What to build

Make the wait drive the injected clock. Inside the `eventually` that waits for the exited row, advance the clock by the watcher tick plus the grace on each attempt, or wait for the native exit receipt before advancing. No product change, and the assertions stay unchanged.

## Acceptance criteria

- [x] C1. The named case advances its clock until the exited row appears, without depending on the OS exit landing before a single advance, and passes 10/10 sequential runs plus its load-gate repetitions (test).
  - done: impl-1350 · 2026-10-29T16:16:03.019Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1350-final · 2026-10-29T16:48:39.971Z · commit 19e24ad44acf949bdc55a374ccf59e6a5ecd650e

## Comments

### impl-1350 · 2026-10-29T16:03:25.573Z

Scope/seam: existing native Claude Code binary contract through hub frames and fake Claude fixture. No shared contract changes or hub/src changes. Regression will advance the injected clock while the discovered process is still running, assert its running row, then kill it: native exit necessarily follows that first advance. Existing exited-state, process event, once-only log and replacement injection assertions remain. Fix drives 150ms watcher/grace advances inside eventually. C1 requires 10 sequential targeted passes; mode-free verification supplies configured load evidence (report exact selection).

### rev-34 · 2026-10-29T16:10:29.403Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1350-source1
commit: f0dc5aef8a7ecf1a66d8708a44e73a5271ee2bfe
scope: full
findings: [{"severity":"medium","text":"M1: New guide H1 is not its exact repository test path, so unchanged test-docs rejects it. Use '# hub/test/claude-code-adapter.test.ts'. Remove the blank line before the new Notes row so it remains within the index table; retain guard sources.","file":"docs/agents/tests/hub-test-claude-code-adapter.test.ts.md","line":1},{"severity":"medium","text":"M2: Proposed local proof driver A-13754 acquires leases and records acquisition before its try/finally, leaving an exit path without releases. Native command/test children also lack a pre-owned bounded close/drain owner; sending SIGTERM alone can wait indefinitely. Repair acquisition/child/worker/lease ownership before using the authorized probe and retain native completion receipts."}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source/proposed proof review not clear for M1 guide/index contract and M2 authorized load-driver ownership gaps. Clock-driving change is correct by source inspection and all original semantic crash/replacement assertions remain. C1 runtime remains pending; no Reviewer execution or configured proof yet. Correct the owning guide/index and publish a bounded pre-owned driver before fresh source request/probe.

### rev-34 · 2026-10-29T16:15:21.489Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1350-source2
commit: 19e24ad44acf949bdc55a374ccf59e6a5ecd650e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source/revised proof plan clear. M1 guide/index corrected, crash source/assertions unchanged. M2 driver A-13763 now pre-owns acquisitions/children/workers/leases, bounds observation separately from native close/drain and retains incomplete/cleanup receipts. No probe executed yet; C1 remains unverified. Only Coordinator-authorized five-run leased sealed-clone CPU probe plus exact-head mode-free run may proceed; original sequential capture remains transcript-only, not invented native logs.

### impl-1350 · 2026-10-29T16:37:09.216Z

Evidence at unchanged reviewed19e24ad44/tree709975bc: mode-free run029ff519 exit0, A-13801 original log,4156pass/0fail/cancel/skip. T0 host check complete; allT1/fallback allT2/Web and changedT3 file6/6 complete; otherT3/T4 not run. Required crash identity native finish pass5.291864244s (report-only5s overrun; existing identity, no new test allowance). Linux x64 c-8 sfo2 droplet Node24.21.0/Nvim0.12.5/Chrome Headless Shell156.0.8078.4 v1248; lifetime978s/$0.0679. CPU-load original A-13778 separate local darwin arm64 Node24.21.0/no browser, reviewed sealed clone,5/5 exit0 native summaries, both counters advanced each run, child/group cleanup settled,2worker joins/3lease releases.10 earlier sequential passes and red remain explicitly terminal-transcribed A-13751, no original logs invented. Duration/lint gates report only; full-all/stage or Linux load repetitions not claimed.

### rev-34 · 2026-10-29T16:48:39.971Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1350-final
commit: 19e24ad44acf949bdc55a374ccf59e6a5ecd650e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C1 final evidence clear. Fresh authorized A-13816 supplies original ten exact sequential native passes at reviewed head/tree, 14 child joins/3 lease releases/clean completion; historical transcript no longer substitutes for that proof. A-13778 independently supplies five local CPU-load passes with both counters and joins/releases. Linux A-13801 supplies 4156 ordinary passes and changed Claude file 6/6, exact crash 5.291864244 s at line 21344. T0/T1/all T2/changed T3/Web complete; other T3/T4 absent, host-tree reuse and report-only warnings retained. No findings, C1 verified.

Criteria: C1 verified.
