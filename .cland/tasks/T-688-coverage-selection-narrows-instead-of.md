---
id: T-688
kind: task
title: "Coverage selection narrows instead of falling back: Neovim importers only, a file's covering tests for top-level edits, old maps that still map"
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
assignee: null
parent: E-676
blocked_by:
  - T-679
topic: topic-419
branch: t/T-688-coverage-selection-narrows-instead-of
created: 2026-10-16T19:59:28.645Z
updated: 2026-10-17T05:07:35.242Z
closed: 2026-10-17T05:07:35.242Z
---

## Summary

Coverage selection decided 13 of 475 task runs (median 59 s) because its forcers defeat it: `nvim test import <hub file>` forced full 66 times, and any top-level insertion, untested function or map older than two days falls back to full (report-strategy §1.3, §2.6, §3f; memo §5.2.6). This ticket widens the fallbacks the memo names; it keeps the shared-contract and suite-infrastructure fallbacks.

## What to build

- **Type-only imports do not count.** `nvimHubImports` (`hub/src/suite-selection.ts`) skips `import type` and `export type` specifiers, which the type-stripping loader erases; today eight Neovim files reach `hub/src/protocol.ts`, and `plan.test.ts` reaches the tracker, only through type imports.
- **Neovim importers only.** When a changed hub file is imported by Neovim tests, the Neovim phase runs the Neovim test files that import it, directly or through `nvim/test` helpers, plus `NVIM_SMOKE`, instead of the whole phase. The hub side is selected by coverage as today. A change to `hub/test/harness.ts` or `hub/test/process-cleanup.ts`, which most Neovim files import, still runs them all.
- **A file's covering tests.** A top-level insertion, or a hunk in a function with no covering test, in a `hub/src` file selects every test covering any function of that file, plus `HUB_SMOKE`, instead of falling back. The report names the widening.
- **Old maps that still map.** A map older than `[verification].coverage_max_age` still selects when every hunk maps through the intervening diff (the existing check); the report gives its age. A map with no ancestor, or any unmappable hunk, still falls back.
- **Measured.** `node hub/test/selection-replay.ts <range> --coverage` over the last 40 landings, before and after, recorded on this item.

## Acceptance criteria

- [x] C1. A Neovim test that reaches a hub file only through `import type` does not make that file a Neovim import, proved by a selection test.
  - done: impl-688 · 2026-10-17T04:23:16.242Z
  - verified: rev-30 [reviewer] · run rev-20261017-688-final · 2026-10-17T05:07:26.679Z · commit 688c502da4d2f8096e7e2450b66e0eda32d67a01
- [x] C2. A diff touching `hub/src/tracker/criteria.ts` selects only the Neovim files importing it plus `NVIM_SMOKE` on the Neovim side, and a diff touching `hub/test/harness.ts` still runs the whole Neovim phase, proved by selection tests.
  - done: impl-688 · 2026-10-17T04:23:16.462Z
  - verified: rev-30 [reviewer] · run rev-20261017-688-final · 2026-10-17T05:07:26.679Z · commit 688c502da4d2f8096e7e2450b66e0eda32d67a01
- [x] C3. A top-level insertion in a covered `hub/src` file selects that file's covering tests plus `HUB_SMOKE` and names the widening, proved by a selection test.
  - done: impl-688 · 2026-10-17T04:23:16.677Z
  - verified: rev-30 [reviewer] · run rev-20261017-688-final · 2026-10-17T05:07:26.680Z · commit 688c502da4d2f8096e7e2450b66e0eda32d67a01
- [x] C4. A map older than the age limit selects when every hunk maps and reports its age, and falls back when one hunk does not, proved by selection tests.
  - done: impl-688 · 2026-10-17T04:23:17.002Z
  - verified: rev-30 [reviewer] · run rev-20261017-688-final · 2026-10-17T05:07:26.680Z · commit 688c502da4d2f8096e7e2450b66e0eda32d67a01
- [x] C5. The replay over the last 40 landings shows zero misses of the merges' own changed or added tests, and more landings selecting than the baseline replay at the merge base, with both counts recorded on this item.
  - done: impl-688 · 2026-10-17T04:23:31.239Z
  - verified: rev-30 [reviewer] · run rev-20261017-688-source · 2026-10-17T04:24:56.678Z · commit 688c502da4d2f8096e7e2450b66e0eda32d67a01
  - verified: rev-30 [reviewer] · run rev-20261017-688-final · 2026-10-17T05:07:26.680Z · commit 688c502da4d2f8096e7e2450b66e0eda32d67a01
- [x] C6. `docs/agents/tests.md` describes the four narrowings.
  - done: impl-688 · 2026-10-17T04:23:17.313Z
  - verified: rev-30 [reviewer] · run rev-20261017-688-source · 2026-10-17T04:24:56.678Z · commit 688c502da4d2f8096e7e2450b66e0eda32d67a01
  - verified: rev-30 [reviewer] · run rev-20261017-688-final · 2026-10-17T05:07:26.680Z · commit 688c502da4d2f8096e7e2450b66e0eda32d67a01

## Comments

### impl-688 · 2026-10-17T04:19:14.040Z

Implementation covers C1–C4/C6 with selection/import graph tests and a new T1 fixed-map coverage-selection file. Initial replay artifacts A-4300 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4300-t-688-baseline-replay-last-40-landings-at-6174032f.md) and A-4301 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4301-t-688-narrowed-replay-same-last-40-landings.md): same latest 40 at 6174032f, 6→6 hub-selected, zero own/historical misses. Shared infrastructure/unsupported-path rules dominate. Per Coordinator decision abc6fd81, next compare the 40 feature landings ending at 457aacb2, keeping every retained fallback and reporting per-landing causes if counts remain unchanged. Replay selector-ref now loads both package/import and coverage selectors from the requested ref; previously --coverage ignored selector-ref for coverage.

### impl-688 · 2026-10-17T04:21:37.210Z

C5 approved feature window (Coordinator answer abc6fd81): 40 landings ending at 457aacb2, baseline selector 6174032f: 8 hub-selected; new selector: 9 hub-selected. Zero own-test misses and zero historical misses in both, with 9 ancestor maps and 619 retained run logs. A-4303 baseline, A-4304 after; T-566 (70eb4bb8) switches from package fallback on a top-level edit to all tests covering tracker/index-db.ts, estimated 73.3% hub test-time. Latest infrastructure-heavy window remains 6→6 (A-4300/A-4301). Type stripping inspection confirmed that inline import/export { type A } retains empty module-executing declarations, so these remain runtime dependencies; only declaration-level import type/export type is erased. Current final-source replay is being republished after this conservative parser correction. Origin/dev merged before first review (e443f8f4, tracker-only fast-forward).

### rev-30 · 2026-10-17T04:24:56.678Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-688-source
commit: 688c502da4d2f8096e7e2450b66e0eda32d67a01
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review T-688 at 688c502da4d2f8096e7e2450b66e0eda32d67a01, fixed point e443f8f4. One implementation commit; origin task branch matches. Read-only review; no Reviewer execution.

## Standards
No findings. New coverage-selection cases use fixed maps and fake Git replies, declare T1 and have a sorted tier entry. New import graph/cache checks use in-process/filesystem fixtures; the existing T3 package-runner contract now proves importer execution as well as omission of unrelated tests. No new wall-clock wait, harness daemon or spoke launch is introduced. Existing coverage fallback assertions are changed only for the specified narrowings.

## Spec
No findings.
C1: import parsing excludes declaration-level import type/export type, preserves a value binding named type and inline type specifiers (module execution), and retains literal dynamic import/re-export handling. Graph regressions cover type-only helper paths.
C2: runtime dependency attribution traverses nvim/test helpers per test, with cycles and cached parsed dependencies. Selected Neovim importers plus NVIM_SMOKE are carried through selection transport validation, packageShards, descriptions and cache equivalence, including the full/hub-fallback mode. Shared contracts, package settings, harness/process-cleanup and suite/executor infrastructure retain broad fallbacks. The execution fixture asserts exactly the selected hub tests, Neovim importer and smoke files.
C3: mapped top-level/unknown-function or untested-function edits widen to all tests covering the source file, name the reason and keep HUB_SMOKE. Missing source/covering tests and unmappable coordinates retain package fallbacks.
C4: old ancestor maps now report age/limit rather than reject solely for age. Translation and unmappable-hunk checks remain before widening; future/invalid/unrelated maps still fall back. Fixed-map and admission tests cover the behavior.
C5 verified from audited replay artifacts: primary Coordinator abc6fd81 authorizes the 40 feature landings ending at 457aacb2. A-4303 and committed-selector A-4309 contain the same ordered 40 landing/item identities and nine ancestor maps, no --nearest. Counts independently checked: 8 -> 9 hub-selected; zero own/historical misses in both. The sole mode change is T-566 (70eb4bb8), package fallback -> file covering-test selection for tracker/index-db.ts; the reported 73.3% is estimated hub test-time, not wall saving. Baseline selector 6174032f's suite-selection/coverage source is byte-identical to fixed point e443f8f4. Retained history count increased 619 -> 620 between captures; no identical historical-corpus claim. The current infrastructure-heavy window remains 6 -> 6, explicitly recorded.
C6 verified: docs describe type erasure/runtime imports, importer subsets plus smoke and shared-helper fallback, file-covering widening, old-but-mappable maps and fallback limits.

A-4308 reports typecheck/tier lint green; selection 90/90 (18.24 s), fixed-map selection 3/3 (0.09 s), cache 6/6 (32.82 s), final executor-importer fallback 0.52 s. The isolated suites cache edit calls the reviewed equivalence helper, so a differing Neovim subset cannot reuse a prior green.

Source clear. Verify C5,C6; C1-C4 remain unverified until normal mode-free same-head droplet task verification. No per-item QA criterion.

Criteria: C5 verified, C6 verified.

### impl-688 · 2026-10-17T05:07:18.323Z

Exact reviewed-head droplet verification e0726676-512b-454b-8a1b-696fb2646130 passed at 688c502da4d2f8096e7e2450b66e0eda32d67a01. Log A-4311 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4311-suite-e0726676-512b-454b-8a1b-696fb2646130-auto-at-688c502.log): 2472 tests, 2464 pass, 0 failures, 8 skips. All 12 new/renamed identities in suite-selection and suite-coverage-selection passed 5/5 load repetitions; none skipped. Linux x64 c-8 lon1, workers 2, lifetime 2502s, cost $0.1738; suite wall 2435.60s. Auto correctly retained the full suite-infrastructure fallback for this selector change. Working tree clean and reviewed head unchanged. Awaiting Reviewer same-head final evidence verdict; no per-item QA required.

### rev-30 · 2026-10-17T05:07:26.680Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-688-final
commit: 688c502da4d2f8096e7e2450b66e0eda32d67a01
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review T-688 at 688c502da4d2f8096e7e2450b66e0eda32d67a01. Current origin branch, source review A-4310 / rev-20261017-688-source and completed hub verification record identify the same head. Evidence: mode-free droplet e0726676-512b-454b-8a1b-696fb2646130 / A-4311.

## Standards
No remaining findings. Read-only receipt audit; source standards review stands.

## Spec
C1 verified: declaration-level type erasure and Neovim type-only helper graph cases pass, including preservation of inline-type module execution.
C2 verified: criteria changes select only runtime importers plus smoke and coverage-selected hub tests; the same regression asserts the shared harness restores the complete Neovim phase. The helper-cycle case passes. The real package-runner fixture executes the exact selected set, includes its Neovim importer and smoke, and omits unrelated tests (1.143 s).
C3 verified: planted top-level and untested-function edits select every covering test, name the widening and retain the empty-evidence fallback; package admission tests also pass.
C4 verified: old maps select translated hunks and report age; unmappable and unrelated map cases retain fallback. The configured-age admission regression passes.
Cache equivalence regressions pass for changed Neovim subsets in both selected and hub-fallback modes. All eight newly added task identities pass ordinary execution and five fresh repetitions each (40/40); renamed existing identities also have green gate receipts. Full selection and cache compatibility files complete without failures.
C5/C6 remain established at this exact head by A-4310: authorized same-40 feature-window replay 8 -> 9 selected, zero reported own/historical misses, and documented narrowings. No runtime wall-saving claim is inferred from the replay.

A-4311 has full hub plus Neovim, exit zero. Independent phase totals: 2472 tests, 2464 passed, zero failed/cancelled, eight skips (free 52/52; hub machine 2021 pass/5 skip; Neovim 391 pass/3 skip). Host gate typecheck succeeds and is reused remotely via its candidate-tree receipt. Two machine workers, wall 2435.60 s, peak one-minute load 10.25. Tier wall overage and duration-regression notices are report-only, with no hard budget/load-gate failure.

Final review clear; C1-C6 verified. No source changes or additional verification requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-17T05:07:35.242Z

Merged c3f3c0ada6e441f1866d502ac22528cebaf1ed0a onto dev.
