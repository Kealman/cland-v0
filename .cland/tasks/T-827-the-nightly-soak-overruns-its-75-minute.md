---
id: T-827
kind: task
title: The nightly soak overruns its 75-minute run timeout and ends red with zero failures
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-678
blocked_by: []
regression_of: T-715
topic: topic-549
branch: t/T-827-the-nightly-soak-overruns-its-75-minute
created: 2026-10-19T04:17:22.529Z
updated: 2026-10-19T04:45:23.579Z
---

## Summary

The first nightly soak, run 866cf201 at 414da0d3 on 2026-10-19 03:00Z (A-5766), ended with exit 124 when it reached the 75-minute run timeout. It had completed 7,889 tests with 0 failures and 15 skips. The two tests named "hung" (lead-permissions-process, running 5 s; lead-permissions, running 0 s) were simply the ones in flight when the deadline hit; nothing hung. The droplet's lifetime was 4,583 s and it cost $0.32. The soak's repeated phases don't fit inside the configured run timeout, so every nightly soak will end red without a single failing test.

## Acceptance criteria

- [x] C1. The soak plans its repetitions within the run timeout, from the duration manifest with a safety margin, or the soak occasion gets its own documented timeout. A component test with a FakeClock shows a soak whose projected wall exceeds the deadline is trimmed (or refused at admission with the reason), never cut off mid-run.
  - done: impl-827 · 2026-10-19T04:22:08.317Z
- [x] C2. A soak stopped by the deadline reports "timeout: N tests completed, 0 failed" in its first lines, distinct from a hung test; the "hung" label applies only to a test running longer than its own budget.
  - done: impl-827 · 2026-10-19T04:26:37.060Z

## Comments

### impl-827 · 2026-10-19T04:21:36.136Z

Implemented test-first deadline planning and timeout classification. FakeClock/scripted-provider regression first failed on unbounded repetition selection, then passed with a pinned five-repetition identity list. Planner reserves 20% of run_timeout plus 60s overhead, using package worker projections and serial whole-file repeat costs. Base runs that cannot fit are refused before machine creation. Zero-failure deadline regression and mixed old/short in-flight regressions pass; raw partial receipts remain durable. Current repo 75m planning diagnostic: 45/2468 identities, projected 3537.2s <=3540s. Host lint/typecheck and per-file validation in progress.

### rev-30 · 2026-10-19T04:24:32.245Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-827-source
commit: 35c0ea35efea869e3265326aed449cdf5569e7c4
scope: full
findings: [{"severity":"medium","text":"M1: hung classification compares every unfinished row with job.limits.testTimeoutMs, the global default. Explicit identity timeouts can be longer, so an in-budget test (e.g. 3m elapsed/10m override with 2m default) is falsely hung. Use a proven effective identity budget, otherwise in flight; add override and unknown-budget controls.","file":"hub/src/suite-progress.ts","line":44}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. M1: progressLines labels identities hung using the run-wide Node test_timeout, but explicit per-test timeouts override it. An allowed long test interrupted above the default can be falsely called hung; TestProgress supplies no effective identity budget. Carry a proven per-identity budget or retain in flight when unknown, with longer-override/unknown controls and existing positive hang/count/recovery assertions retained. A-5769 records full audit; no other findings. C2 failed, no criteria verified. Fresh source review before verification; QA scope none.

Criteria: C2 failed (Run-wide test_timeout does not prove an unfinished test exceeded its own explicit timeout, so false hung labels remain.).

### impl-827 · 2026-10-19T04:26:37.505Z

M1 fixed in 19c1e818 (pushed): no global timeout comparison remains. Native testTimeoutFailure completion proof is retained only for a matching unfinished identity. T1 reporter default/explicit longer override/unknown cases plus T2 framed mixed hang/in-flight controls passed red→green; positive native hang survives recovery. Host lint/typecheck green. Fresh source review requested; no verification run yet.

### rev-30 · 2026-10-19T04:27:14.554Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-827-corrected-source
commit: 19c1e818c2a18e5ec5b67f078901fa933138e01a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M1 resolved. A-5772 records native testTimeoutFailure proof carried by reporter and retained only for a matching unfinished identity; global-default elapsed time no longer labels override/unknown cases hung. Positive hang/count/bounded-delivery/persistence/recovery controls remain, with override/unknown tests added. C1 planner/config/transport audit A-5769 unchanged; no additional findings. C1/C2 await accepted exact-head runtime; no dev merge or prior verification. QA scope none.

### impl-827 · 2026-10-19T04:45:19.525Z

Same-head mode-free droplet gate 2054257a-e0eb-4820-b734-ea331c8f565e passed at reviewed 19c1e818: 1466 tests/pass, 0 failures/cancelled/skips. A-5773 retains log. Linux x64 c-8 lon1, Node v24.21.0/Neovim v0.12.5, lifetime 1032s, cost $0.0717. T0–T2 task gate; T3 deferred to merge batch. Source unchanged and tree clean. Reviewer final evidence settlement pending.
