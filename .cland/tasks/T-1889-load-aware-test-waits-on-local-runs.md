---
id: T-1889
kind: task
title: Load-aware test waits on local runs
state: open
status: review
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
updated: 2026-11-16T07:54:53.403Z
---

## Summary

`until` scales only by `CLAND_TEST_LOAD_FACTOR` (default 1 locally, 2 on droplets), and `eventually` never scales. Nothing sets the factor. run-suite derives a factor from load and workers for setup waits, as `remoteWaitMs` already does. Source: §7 #2 and #1.

Kind: product (test infra). Triage ticket H-1 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [ ] C1. run-suite exports a load factor ≥ 1 from the 1-minute load and workers on local and droplet runs, and `until` and `eventually` setup waits use it (test).
- [x] C2. Waits on an injected clock or a named behaviour bound keep their exact value (test).
  - done: impl-1889 · 2026-11-16T07:54:41.243Z
- [ ] C3. Two macOS covers before and after name the load-timing failures each had (evidence).

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
