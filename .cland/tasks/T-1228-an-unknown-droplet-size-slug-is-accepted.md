---
id: T-1228
kind: task
title: An unknown droplet size slug is accepted as a capacity refusal instead of refused
state: open
status: review
size: S
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
regression_of: T-1144
topic: topic-963
branch: t/T-1228-an-unknown-droplet-size-slug-is-accepted
created: 2026-10-24T10:42:20.797Z
updated: 2026-10-24T10:48:17.919Z
---

## Summary

Since T-1144 (74407f6e), `cland verify --size unknown` exits 0. Before, it was refused. T-1144 turned every "size not offered" check into `ProviderCapacityUnavailable`, and the verify path accepts that as a not-run outcome. A slug the provider does not list at all is now treated like a temporary capacity gap. The T3 test `hub/test/verification-workers.test.ts:90` ("verify persists overrides") fails on dev from 74407f6e on. The coord bisect showed 09a98984 green and 74407f6e red. Linux stage cover 4d0ec3dd at 44f220a5 also caught it.

## What to build

A size slug that is missing from the provider's size list is invalid input. Refuse it at submission, exactly as before T-1144: exit 1, an "unavailable" message, no job and no droplet. A listed size that is marked unavailable, or that is not offered in any configured region, keeps T-1144's distinct "unavailable / not run" outcome.

## Acceptance criteria

- [x] C1. `cland verify --size <slug missing from the provider's size list>` exits 1 at submission with an "unavailable" message, creates no suite job and no droplet, and `verification-workers.test.ts` passes again (test).
  - done: impl-1228 · 2026-10-24T10:46:07.463Z
- [x] C2. A listed size that is unavailable, or not offered in the configured regions, still yields T-1144's unavailable outcome for task runs and the "not run: provider capacity" periodic notice (existing tests).
  - done: impl-1228 · 2026-10-24T10:46:07.864Z

## Comments

### impl-1228 · 2026-10-24T10:45:00.770Z

Reproduced at 44f220a5, local macOS arm64 targeted T3 CLI test: actual exit 0 vs expected 1 at verification-workers.test.ts:90, suite submitted for --size unknown. Red receipt A-10762. Added no-job/no-droplet assertions and adjusted only explicit absent-size component expectations; configured catalog absence and listed-unavailable/region capacity behavior remain covered. Minimal validateSize fix now under targeted checks.

### rev-26 · 2026-10-24T10:48:17.919Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1228-source-1
commit: b0f0bd31f5b18df79bb71e74ed669c86a9afba07
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1228 full source review — clear
Head b0f0bd31f5b18df79bb71e74ed669c86a9afba07; tree55fdb38f63e3cbe8f40c291f9a31e4f752b08ec9; task/origin refs agree. Fixed point44f220a559e2f027daf9ba59a9f14098efbd99f7 (dev baseline supplied by task/receipt); git diff44f220a5...b0f0bd31, one commit,9files38+/5−. Scope full; run rev-20261024-1228-source-1; findings[].

## Standards
No findings. Minimal provider-boundary correction adds no dependency, extra native process, clock wait or resource. Existing T3 CLI/native worker lifecycle remains the appropriate integration seam; changed T2 component cases use existing scripted provider/FakeClock, caseDeadlines bounded receipts and fixture-owned cleanup. Unknown override assertions inspect completed submission and exact suite-id/provider-create facts, preserving existing final assertions on other branches. No timing cap, fixture scale, environment sealing or permission relaxation.
Matching CLI help, hub README, shared test procedure and existing per-test guidance distinguish explicit invalid input from genuine capacity. Implement skill change is behavior guidance with sibling CHANGES provenance; no role-clause changes. AGENTS.md, test-level/ownership guidance, skill-maintenance contract and smell baseline applied; no CONTRIBUTING/CODING_STANDARDS file found. Whitespace diff check clean.

## Spec
C1 source matches: validateSize first finds the slug; absent catalog entry throws ordinary unavailable Error before any suite row/provider mutation. Suites admission calls this only for explicit size before existing-submission/job persistence, rethrowing ordinary errors while retaining only typed ProviderCapacityUnavailable as not-run. CLI regression retains exit1/unavailable checks and now asserts no suite IDs or droplet creates added for each refused input. Two component explicit-absent variants also assert no job/provider resource.
C2 source matches: listed unavailable remains ProviderCapacityUnavailable; valid-price/configured-region logic unchanged. Configured absence still goes through existing checkSpend/acquisition typed capacity. Unchanged task matrix covers default/explicit executor and listed-unavailable/regions; periodic matrix retains exact cause/not-run notice, no execution/fallback/red cover/culprit search. Malformed slug, auth, invalid-price and spend refusal controls retained.
No scope creep or new findings. Both criteria are done but remain unverified until same-head configured receipt settlement.

A-10762 preserves original local red at44f220a5: CLI returned0 vs expected1 and submitted an unknown-size job. A-10768 is a summarized local Darwinarm64 account for final precommit tree: focused1/1 runner14562.073167ms, full workers T3 5/5 runner22842.454417ms, component35/35 runner5513.811666ms, unit9/9 runner879.636625ms, typecheck/lint0/report-only133/60. Those are runner totals, not individual durations; no configured suite, repetitions or Linux claim. The artifacts do not contain full original passing stdout. Preserve/publish original returned stdout/exits/native timings with their actual tree attribution without rerunning for transcription; missing capture must stay explicit. No independent reviewer run was made.

Proceed with the normal mode-free configured droplet verify at this exact head, reporting to Reviewer and item lead. Changed verification-workers T3 file should execute once and report selected identity timings/added wall; retain any generated >=80% allowance stanza and obtain the normal review before a head change. Existing local T3 evidence stays separate. Source clearance is not final runtime or stage closure. QA policy none/after-stage, no item QA claim.
Both axes reviewed in-session under Reviewer restrictions: read-only source/Git/artifact inspection, no tests, probes, edits, browser, installs, merge or delegation. Standards0 findings; Spec0 findings.
Durable source review A-10770.
