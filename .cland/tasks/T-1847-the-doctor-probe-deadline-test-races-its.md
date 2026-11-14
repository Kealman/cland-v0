---
id: T-1847
kind: task
title: The doctor probe-deadline test races its hanging probes' pid writes (red 1 in 5 alone)
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1501
branch: t/T-1847-the-doctor-probe-deadline-test-races-its
created: 2026-11-14T01:15:21.748Z
updated: 2026-11-14T02:18:22.374Z
---

## Summary

`hub/test/doctor-cli.test.ts` "a probe that never answers is cut at its deadline: the lock probe and a harness both, and their whole process group is killed" is intermittently red on dev, even when run alone. It sets `CLAND_DOCTOR_PROBE_TIMEOUT_MS: '1000'` and then expects at least four recorded pids (each hanging probe and its `sleep` grandchild). Sometimes only two are written before the 1 s cut kills the probes.

## Evidence

- E-1537 stage-2 macOS cover d6128175 at dev ae0a2c2b9 (log A-19235, local darwin arm64, 1 worker), test line 179: `AssertionError: the ps probe and the claude probe each ran, with a grandchild: 8126 8200`.
- Run alone five times on a quiet Mac (2026-11-14 01:14Z, CLAND_* stripped): 4 passed and run 3 failed, each in about 3.5 s. So this is not only a load flake.
- The test and the doctor code have not changed recently (last commits T-1600, T-1593, T-1617).

## What to build

The case proves the deadline cut and the process-group kill without racing the probe scripts' own startup. For example: wait until each hanging probe has recorded its pid and its grandchild's pid before the deadline can fire, or drive the deadline from a controlled clock. A probe that is killed before it records stays distinguishable from a probe that never started.

## Acceptance criteria

- [x] C1. The assertion no longer depends on both probes writing their pids within the 1 s probe deadline, and a regression that skips the process-group kill still fails it (test).
  - done: impl-1847 · 2026-11-14T01:36:59.950Z
  - verified: rev-35 [reviewer] · run rev-35-1847-final-1 · 2026-11-14T02:18:22.201Z · commit b32898d380f9b773b399bf44844501eabe5a40e4
- [x] C2. The case passes 20 lone repetitions on macOS and the task's mode-free verify (test).
  - done: impl-1847 · 2026-11-14T01:25:43.169Z
  - verified: rev-35 [reviewer] · run rev-35-1847-final-1 · 2026-11-14T02:18:22.202Z · commit b32898d380f9b773b399bf44844501eabe5a40e4

## Comments

### coord · 2026-11-14T01:16:18.758Z

Moved into R-1530 by ask 96990fef, answered 2026-11-14 01:16Z: land the test-timing fixes locally, then rerun the E-1537 stage-2 macOS cover.

### impl-1847 · 2026-11-14T01:26:24.342Z

Source a52359f7 submitted for review. Evidence A-19238: forced startup-delay red; 20 lone + 3 paired macOS green; root-only kill mutation red; full file 9/9; tmp inventory delta zero; positive-control scan 29 files zero matches. Linux not run. Mode-free verify pending source review.

### rev-35 · 2026-11-14T01:30:52.156Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1847-source-1
commit: a52359f7ed44ff8cdfe5b9deb49f3dc8d045df41
scope: full
findings: [{"severity":"medium","text":"The in-process run calls omit the optional scratch cwd and the spawn spy forwards unchanged options, so native probes inherit the task checkout. Supply disposable cwd through the production run seam for controlled and other probes; preserve all optional-argument semantics.","file":"hub/test/doctor-cli.test.ts","line":200},{"severity":"medium","text":"runDoctor's Promise.all can reject on one readiness failure while sibling controlledProbe pollers/native work remain active. Each local finally joins only its own probe. Close new admissions and attempt-all drain all admitted work before assertions/fixture disposal, with a failure-path guard/control that does not mask the final group-kill assertion.","file":"hub/test/doctor-cli.test.ts","line":225},{"severity":"low","text":"The new doctor-cli per-file guide is absent from the generated index. Regenerate via the documented canonical writer; drift remains advisory rather than an enforced test failure.","file":"docs/agents/tests/index.md","line":3}]
finding_counts: {"high":0,"medium":2,"low":1}

Complete first source pass not clear: two medium test isolation/ownership findings plus one low index finding; no product logic change. A-19241 records confirmed source paths, Standards/Spec review and independently inspected23/23 development results, mutation/full-file logs, inventory sets and A-19240's original launch/candidate/capture limits. C2 is not finally verified: corrected-head20 repetitions and mode-free verify, or explicit authorized carry, remain pending. Correct, commit/push and request fresh source review before verification. Reviewer read-only; no experiment or provenance-only rerun requested.

Criteria: C1 failed (Native probe cwd isolation and sibling failure-path asynchronous drainage are incomplete.).

### rev-35 · 2026-11-14T01:36:51.836Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1847-source-2
commit: b32898d380f9b773b399bf44844501eabe5a40e4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; all prior findings resolved. A-19247 records disposable cwd for all native probe paths, admission closure plus attempt-all active-work drainage before assertions/disposal, preserved production kill/final assertion, and regenerated guide index. Independent A-19245 audit confirms20 lone+3 paired+1 full-file executions, all status0/signalnull, identical12,617-entry inventory sets; committed-source stability and no per-child Git hash remain qualified. Earlier mutation/cwd/capture limits remain historical; no corrected-head readiness-failure experiment claimed. Final C1/C2 configured evidence pending. Restore C1 done (task.view still has source-1 failed mark), then mode-free one-worker local verification at this exact head. No extra probe/runtime/provenance rerun requested; Reviewer read-only.

### rev-35 · 2026-11-14T02:18:22.202Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1847-final-1
commit: b32898d380f9b773b399bf44844501eabe5a40e4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1/C2 verified at unchanged source-clear head on67f9c3f5/A-19252. A-19253 records independent6,263 base test/692 base file positives, separate125 load test/file positives, zero negatives/skips. Exact deadline case pass@32737, doctor-cli file pass@32740; all nine parent/nested test finishes pass, six top-level timing identities, one changed-T3 execution. A-19245's20 lone macOS passes complete C2 with this configured receipt; prior mutation/capture/candidate limits remain explicit, not relabelled as a fresh mutation. T0/T1/fallback-all T2/changed T3/Web all exit0; darwin arm64 Node24.21/nvim0.12.5, actual Headless Shell1248/Chrome156.0.8078.4. Report-only budgets and targeted-only inventory limits retained. Broader T3/T4/Linux/stage evidence separate/unexecuted. Source clean, no remaining findings; Reviewer read-only.

Criteria: C1 verified, C2 verified.
