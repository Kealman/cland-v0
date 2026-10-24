---
id: T-1203
kind: task
title: tiers.json maps shared read paths to the T4 load files that guard them, and verify selection adds them
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1195
blocked_by: []
topic: topic-944
branch: t/T-1203-tiers-json-maps-shared-read-paths-to-the
created: 2026-10-24T06:46:05.046Z
updated: 2026-10-24T08:42:08.214Z
---

## Summary

Changes to shared read paths (T-1147) were selected without the T4 load files that guard their cost. Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. A change to a mapped read path adds its T4 load files to the task's selection, and the report names why (test).
  - done: impl-1203 · 2026-10-24T08:39:30.709Z
- [x] C2. The T-1147 read path is mapped, and the mapping is documented in docs/agents/tests.md (docs).
  - done: impl-1203 · 2026-10-24T08:39:31.096Z
  - verified: rev-23 [reviewer] · run rev-20261024-1203-source · 2026-10-24T08:42:08.214Z · commit 53f6a4a5dcba687268311e1986e14d6c21bcaafa

## Comments

### impl-1203 · 2026-10-24T08:37:03.567Z

TDD slices: T1 selection/package-plan guard test red (missing export), then green; sealed Git package-admission regression red (`durationCheck` undefined), then green with manifest mapping; manifest schema regression red (`Missing expected rejection`), then green. Added optional tiers.json loadGuards and mapped T-1147 requests/sessions/core -> inbox-verifier-load. No local T4 load execution. Updating shared docs/help/skill guidance and running check + touched selection tests next.

### rev-23 · 2026-10-24T08:42:08.214Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1203-source
commit: 53f6a4a5dcba687268311e1986e14d6c21bcaafa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1203 full source review — clear

Head 53f6a4a5dcba687268311e1986e14d6c21bcaafa; tree 609a29e05ea3898a2e630b74e54e9500eaadb158. Fixed incorporated dev base c345bf92ecb1d105d614c4cccb3c089e12f02599; comparison git diff c345bf92...53f6a4a5, two task/merge commits, 17 changed files, 174 additions / 28 removals. Run rev-20261024-1203-source. Both Standards and Spec reviewed in-session, no subagents. Findings [].

## Standards

No findings. Optional manifest metadata is parsed/validated in the shared tier-manifest module, used by ordinary and immutable-tree classification and read-path admission. Maps must be objects; relative nonempty normalized source patterns map to nonempty arrays of declared T4 targets, rejecting missing/non-T4 target entries. Existing inventory classification separately rejects nonexistent test paths, preserves sorted test-map and tier/resource contracts, and legacy manifests return no guards. Serialized manifests retain optional mapping data. The matcher uses Node path.matchesGlob on repository diff paths and deduplicates selected guards.

T1 planner tests use an immutable in-memory repository and FakeClock-free pure selection/package seams, including selected coverage, fallback, overlapping globs, changed-guard dedup, unrelated exclusion and narrowed T4 plans. T1 manifest negatives retain rejection assertions. Existing sealed Git T3 fixture supplies a real changed-source admission test and plans the guard without running it. The native Git edge is justified by diff/admission behavior; shared fixture sealing and awaited setup/cleanup are retained. No new harness/browser/provider or T4 workload execution occurs. Three exact-path indexed test notes and index entry are correct. Shared docs, README/help and implementing/merge/QA guidance are updated; kept implement provenance records the edit. No role-clause lines added under the supplied reserve constraint. Diff whitespace check passes.

## Spec

No findings. taskDurationSelection extends T-1198's existing durationCheck seam only for reduced queue-protected T1/T2 task selections. It unions changed T3/T4 files with guards whose source globs match selection.files, sorts/deduplicates and adds only the necessary T3/T4 tiers. The report reason names every matched guard and changed source. Coverage tests/functions and T2 fallback remain independent; no whole-tier widening. selectPackageSuite retains nearest open container allowance ownership. Existing tierSuiteSelection/packageShards behavior narrows T4 to selected durationCheck files, removes prior occurrences before appending, enables soak for base T4 execution, and avoids load repetitions. Integrated/occasion selection retains its existing separate policy and removes task-only metadata. Candidate and hosting queue requirements remain unchanged.

C1's planner and sealed package-admission tests show the unchanged T4 guard selected with an exact source explanation, once in the resulting file plan. They do not claim actual live-host T4 execution. C2 is established in source: hub/src/adapters/requests.ts, hub/src/adapters/sessions.ts and hub/src/hub/core.ts map to hub/test/inbox-verifier-load.test.ts. That unchanged T4 file uses verifierWorkload at 100 frames; docs/agents/tests.md records the mapping, selection/fallback/soak semantics and manifest validation. C2 verified at this head.

## Evidence and capability limit

A-10553/A-10554 retain exact-head local Darwin arm64 stdout: npm run check passed with report-only lint 133 findings/zero refusals; 126/126 targeted tests across suite-selection, suite-task-selection, suite-tiers and test-docs, no fail/cancel/skip, native total 41040.732250 ms. New package admission identity passes 1013.543625 ms, pure selection identity 1.892292 ms, manifest guard identity 37.731292 ms. These are targeted T1/T3 selection contracts, not a full task suite, Linux or T4 workload. Original red output summaries remain in task comments; native command/exit/source/platform/completion attribution has been requested for durable retention without transcription reruns.

The running hub still pins task tiers until the Coordinator restarts onto T-1198; the request reports an authorized selector-test C1 seam and future live T4 selection evidence. Source clearance permits mode-free configured verification at this unchanged head, with its actual selected phases reported. It does not prove that an older host selected/executed the new T4 guard or authorize a live capability workaround. Cite the Coordinator disposition in final evidence, keep actual task runtime and post-restart T4 selection separate. C1 runtime/final settlement pending; C2 source verified.

QA policy none/after-stage, no QA criteria. Reviewer performed source/Git/artifact inspection only: no tests/probes, edits, native Git mutation, browser, merge or delegation. Standards zero findings; Spec zero findings.
Durable review A-10559.

Criteria: C2 verified.
