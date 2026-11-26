---
id: T-2099
kind: task
title: On Linux droplets the same T3 cases in executor-safety, stage-qa and merge-policy run 2–4x their per-case baselines (integrated two-worker runs)
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1798
branch: t/T-2099-on-linux-droplets-the-same-t3-cases-in
created: 2026-11-25T03:41:35.690Z
updated: 2026-11-26T19:53:42.428Z
closed: 2026-11-26T19:53:42.428Z
---

## Summary

This is a follow-up from T-2098 (impl-2098, 2026-11-25). Comparing the same cases, the per-test baseline sum against three Linux integrated runs, rules out new tests and stale file aggregates as the cause:

| file | cases | per-case baseline sum | stage cover A-23095 | batch A-23215 | soak A-23224 |
|---|---|---|---|---|---|
| executor-safety | 15 | 42.9 s | 110.8 s | 98.3 s | not run |
| stage-qa | 12 | 54.1 s | 140.6 s | 103.7 s | 94.0 s |
| merge-policy | 26 | 22.1 s | 94.7 s | 70.0 s | 68.0 s |

Main executor-safety outliers: remote-shell/host timeout, 13.3 s to 55.8 s and 51.3 s; prepare/fallback/cancel/watchdog, 18.8 s to 42.7 s and 37.2 s.

Limits: the Linux evidence comes only from integrated two-worker runs, so it doesn't separate a landing, machine load, fixture overhead or compile cost. Mac measurements under a pinned Node 24 show only gradual creep (merge-policy 36.7 s to 57.2 s across landings, no single culprit) and don't establish Linux causality. One Mac confounder was found and excluded: Homebrew's Node 25 on PATH roughly doubles these files.

## What to build

Attribute the Linux slowdown in these files: per-test timing under a controlled single-file Linux run, or a per-phase breakdown of setup, compile and body time from the existing timing receipts. Fix what's attributable; for the rest, record the expected Linux cost so the duration-baseline refresh can take it.

## Acceptance criteria

- [x] C1. Each of the three files has a recorded Linux phase localization per slow case group (which phase holds the time), with evidence that names the run and its isolation level and states that causality beyond the phase is unproven (evidence).
  - done: impl-2099 · 2026-11-26T17:45:44.458Z
  - verified: rev-35 [reviewer] · run rev-35-2099-evidence-2 · 2026-11-26T17:50:05.746Z · commit 1c7e26f40f41a7a05c1288464641a333106dfa80
- [x] C2. The causal follow-up is filed as its own item naming the three owning paths, and the baseline refresh records which per-case Linux values it accepts and why (evidence).
  - done: impl-2099 · 2026-11-26T17:45:44.819Z
  - verified: rev-35 [reviewer] · run rev-35-2099-evidence-2 · 2026-11-26T17:50:05.746Z · commit 1c7e26f40f41a7a05c1288464641a333106dfa80

## Comments

### impl-2099 · 2026-11-26T00:26:38.098Z

Coordinator authorized report-only phase receipts in the three target files, followed by source review and one Linux task verification. Collector controls were red for missing counts, then green; full lint/typecheck and local T3 validation are in progress. C1/C2 remain pending Linux phase evidence; no slowdown cause or baseline refresh is claimed.

### rev-35 · 2026-11-26T00:35:55.447Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2099-source-1
commit: 1c7e26f40f41a7a05c1288464641a333106dfa80
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Preparatory instrumentation source clear; A-23502 records standards/spec and evidence limits. Fixed-label aggregates, scoped wrappers, existing owners/assertions and truthful inclusive/unknown timing labels retained. Independent local log audit confirms15/12/26 top-level diagnostics and bounded rows, not Linux causality. Full finalized logs retain diagnostics; reduced semantic summary/cache does not. Final clean-head dry-run is explicitly transcript-only; A-23497/selection.log belongs to the earlier dirty occasion and is not credited for this head. Coordinator accepted the reported766-file/723.984s projected plan. C1/C2 intentionally unchecked/unverified pending Linux attribution and baseline/fix dispositions. No findings; hold released. Request Coordinator verify window; no reviewer test/probe/run performed.

### impl-2099 · 2026-11-26T02:30:27.938Z

Exact-head Linux run 415fc047-94a2-46c5-93b2-8d602ef304a2 at 1c7e26f40 passed T0/T1/T2/selected T3/Web (7790 pass, 1 skip); integrated two-worker droplet measurement, not isolated. Full log A-23532; validated per-case phases, baselines and unresolved dispositions A-23533. Completion observation dominates executor, land dominates stage, substantial merge body remains unresolved. No causal regression or baseline replacement accepted; C1/C2 remain open. Reviewer holds source/experiments; supervising Lead decision requested for narrower instrumentation or explicit scope/dispositions. No resubmission or source change after review.

### impl-2099 · 2026-11-26T17:45:54.230Z

Coordinator decision 06db55a0 accepts limited phase localization and revised C1/C2 for this release. A-23533/A-23534 retain phase evidence and independent audit; new A-23543 records all 53 accepted exact per-case Linux values with individual reasons for next stage-close add-only refresh. T-2111 is filed for executor completion, stage merge/restart, merge/enqueue causal receipts. Revised C1/C2 marked done; evidence verdict requested from Reviewer. Source remains clean at reviewed/green 1c7e26f40; no new run, source or tracked baseline change.

### rev-35 · 2026-11-26T17:50:05.746Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2099-evidence-2
commit: 1c7e26f40f41a7a05c1288464641a333106dfa80
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear under the revised C1/C2 and Coordinator decision 06db55a0-72d3-4db0-a749-f11435246fd3. A-23547 records the independent audit: all 53 accepted case identities/values in A-23543 match the prior A-23533 audit and positive native finish/timing receipts in exact-head run 415fc047/A-23532. C1 establishes integrated two-worker Linux phase localization with causality beyond phases explicitly unproven. C2 establishes the filed T-2111 owning-path follow-up and the per-case accepted-value/reason list for the next add-only refresh; no tracked baseline refresh is claimed executed. Existing result is code 0, empty cause, T0/T1/T2/selected T3/Web exit 0; remaining T3/T4 unexecuted and prerequisite skip retained. Earlier measurement limits and known accounting disclosure remain. No new run, source change or baseline write. Findings: none.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-26T19:53:42.428Z

Merged 8c5d3374d2bf7fb6612e668b5a90452837a91db8 onto dev.
