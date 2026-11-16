---
id: T-1889
kind: task
title: Load-aware test waits on local runs
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1534
branch: t/T-1889-load-aware-test-waits-on-local-runs
created: 2026-11-16T07:29:44.705Z
updated: 2026-11-16T09:47:53.750Z
closed: 2026-11-16T09:47:53.750Z
---

## Summary

`until` scales only by `CLAND_TEST_LOAD_FACTOR` (default 1 locally, 2 on droplets), and `eventually` never scales. Nothing sets the factor. run-suite derives a factor from load and workers for setup waits, as `remoteWaitMs` already does. Source: §7 #2 and #1.

Kind: product (test infra). Triage ticket H-1 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [x] C1. run-suite exports a load factor ≥ 1 from the 1-minute load and workers on local and droplet runs, and `until` and `eventually` setup waits use it (test).
  - done: impl-1889 · 2026-11-16T08:03:19.444Z
  - verified: rev-35 [reviewer] · run rev-35-1889-final-1 · 2026-11-16T08:44:07.874Z · commit 11f34bb60dabb6fc6e415cbde51351d2303c4f70
- [x] C2. Waits on an injected clock or a named behaviour bound keep their exact value (test).
  - done: impl-1889 · 2026-11-16T07:54:41.243Z
  - verified: rev-35 [reviewer] · run rev-35-1889-final-1 · 2026-11-16T08:44:07.874Z · commit 11f34bb60dabb6fc6e415cbde51351d2303c4f70

## Dependencies

none; lands first in A1 stage 1 (`hub/test/until.ts`, `harness.ts`)

## Comments

### impl-1889 · 2026-11-16T07:33:45.087Z

Consumer sweep: searched until, eventually, waitTimeoutMs, testSetupWaitMs, CLAND_TEST_LOAD_FACTOR and imports across hub/src, hub/test (all tiers), web/test, nvim/test, docs, shipped .agents/skills. Scope is test-only; no production wire/persisted reply changes. Existing until loadFactor:1 behaviour callers remain exact; clock.test.ts intentionally passes factor3 to exercise arithmetic. Harness eventually numeric callers retain shape and get setup scaling; remote-fixture remoteEventually currently pre-scales and needs explicit factor1 to prevent double scaling. Existing setup envelopes (host-fixture-cleanup, login-terminal, Discord acquisition, scenario-reply-owner) already use waitTimeoutMs. Shared documentation lives in docs/agents/tests.md and docs/hub/running.md; no skill examples of either wait API found.

### rev-35 · 2026-11-16T07:48:52.378Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1889-source-1
commit: f0274feea16b0c1ede118bee72f796912a818fed
scope: full
findings: [{"severity":"medium","text":"Existing eventually numeric arguments explicitly labelled behaviour now scale with suite load unless migrated to the exact behaviour option; preserve their original N/reason under Coordinator decision 1ef64553.","file":"hub/test/until.ts","line":71},{"severity":"medium","text":"eventually awaits check without an independent deadline: pending async checks never time out and late values can succeed beyond the stated injected-clock/behaviour bound.","file":"hub/test/until.ts","line":78}]
finding_counts: {"high":0,"medium":2,"low":0}

Full standards/spec source pass completed; A-19846 contains both confirmed medium findings and evidence limits. C1 pending authorized native/load proof after clear replacement source review; C3 Coordinator post-merge, not a pre-merge gate. No Reviewer runtime work. Tracked pin unchanged; untracked evidence/ is present. Hold released for consolidated correction and fresh review.

Criteria: C2 failed (Existing declared behaviour callers still scale, and eventually does not enforce its exact deadline around pending or late async checks.).

### rev-35 · 2026-11-16T07:56:28.089Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1889-source-2
commit: 11f34bb60dabb6fc6e415cbde51351d2303c4f70
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Replacement full standards/spec source pass clear, A-19857. Both A-19846 source findings resolved: independent shared deadline plus late-value guard; all 42 original N/reason migrations independently reconstruct exactly across nine files, three approved exclusions unchanged. All 15 supplied fingerprints match. C1/C2 remain pending authorized native/load and configured same-head evidence; C3 Coordinator post-merge, not pre-merge gate. Historical provenance/publication limits retained. No Reviewer runtime work; hold released.

### impl-1889 · 2026-11-16T08:40:17.112Z

Reviewed head11f34bb60 passed configured run d9ae394b-7d8e-4f71-a02e-f8c780f528bf (A-19893):6516/6516, no failures/cancellations/skips. Local T0 exit0; Linuxx64 droplet c-8nyc1 Node24.21,workers2 completed T1/allT2 fallback, changedT3,mappedT4once,Web. RemainingT3 deferred to merge batch; T4repetitions skipped by selection; duration findings report-only. Executor lifetime1791s,cost$0.1244. Focused macOS native1/1 and Linux20/20 loaded T1 at8.02–8.34 retained A-19872. C1/C2 done; final reviewer settlement pending. C3 post-merge, Coordinator, not a premerge gate per decision6157e34b. No source change after source clear.

### rev-35 · 2026-11-16T08:44:07.874Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1889-final-1
commit: 11f34bb60dabb6fc6e415cbde51351d2303c4f70
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head C1/C2 evidence clear, A-19906/A-19905. C3 explicitly remains Coordinator post-merge under6157e34b and is not marked verified. Independently audited6516base tests/708files and30separate load tests/files, all pass;7wait cases,6new identities each+5, native propagation case/whole file and all selected changedT3/mappedT4 positive.20loaded Linux helper runs in A-19872 independently match saved logs; scoped Mac native receipt retained. All919consumer rows and unresolved caveats retained, zero missing selected-tier file receipts; broaderT3/T4 deferred. Historical capture/publication/report-mode boundaries preserved. Head clean/unchanged, no Reviewer runtime work. Hold released; C3 and landing Coordinator-owned.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T08:44:44.038Z

C3 (macOS covers before and after) is post-merge stage-cover evidence. It can't be checked before enqueue, so the Coordinator moved it to the epic E-1881 as a criterion of its own on 2026-11-16 (decision 6157e34b). T-1889's pre-merge bar is C1 and C2, both verified at 11f34bb60 with green verify d9ae394b (A-19893). The Coordinator runs the after-covers on dev once T-1889 lands.

### coord · 2026-11-16T09:47:53.750Z

Merged b2579dcbf6b00288dbf43009471233357ef518e7 onto dev.
