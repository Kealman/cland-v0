---
id: T-1299
kind: task
title: suite-selection's T4 guard case copies every production loadGuard into a one-guard fixture
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1282
blocked_by: []
regression_of: T-1259
found_by: cover
topic: topic-1048
branch: t/T-1299-suite-selection-s-t4-guard-case-copies
created: 2026-10-25T11:30:32.519Z
updated: 2026-10-25T11:55:03.527Z
closed: 2026-10-25T11:55:03.527Z
---

## Summary

`hub/test/suite-selection.test.ts` "task admission selects unchanged T4 guards from the manifest and reports the mapped source" copies the production `loadGuards` from `hub/test/tiers.json` into a fixture manifest that declares only `hub/test/inbox-verifier-load.test.ts` as T4. Every new production load guard therefore fails manifest validation in that fixture (`invalid loadGuards … names a missing or non-T4 test`). T-1259 (executor-safety-load) and T-1028 (launcher-input-load) each added one; their merge batches ran T1 only, so dev now fails this T3 case. Reported by impl-1233 at dev 8fa66512 and reproduced by the Coordinator on dev.

The fix keeps the fixture self-contained: it derives only the guard entries for the guard it declares (or declares its own mapping), so adding production guards cannot break it.

## Acceptance criteria

- [x] C1. The case passes at the fix head with the current production `loadGuards` (three guard files) and still asserts the inbox-verifier-load selection and description; a second fixture-local guard added to production `tiers.json` in a scratch copy does not break it.
  - done: impl-1299 · 2026-10-25T11:33:35.896Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1299-final · 2026-10-25T11:48:38.429Z · commit 588b8927ec55c4ba5dca7b07f301d833800293b6

## Comments

### impl-1299 · 2026-10-25T11:32:12.217Z

TDD red at the pre-authorized existing task-admission seam (T3: sealed Git history is essential). Both the original case and new `after production guard growth` case failed with: `invalid loadGuards in hub/test/tiers.json: nvim/test/launcher-component.test.ts names a missing or non-T4 test: "nvim/test/launcher-input-load.test.ts"`. macOS local, 2 tests, 0 passed; 0.631/0.587 s test durations. The growth case edits a scratch production-manifest copy, adding a T4 guard to both the changed-source array and an unrelated mapping. Fix projects the production mapping onto the single declared guard; retains exact selection, source-description and per-tier phase assertions. No production contract, command or permission changes.

### rev-26 · 2026-10-25T11:34:15.359Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1299-source-1
commit: 588b8927ec55c4ba5dca7b07f301d833800293b6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full in-session Standards/Spec source CLEAR, A-11817. Fixture projects production loadGuards to its only declared inbox guard and drops empty mappings. Original exact guard selection/source-description/tier-phase assertions remain; growth variant adds unrelated T4 target to both changed-source array and separate mapping in a scratch production-manifest copy. Production contracts/validation and real production file unchanged; existing sealed Git T3 boundary retained. A-11816 local summary/final-content refinement limits inspected. C1 runtime-unverified pending one ordinary mode-free configured exact-head run with both named cases; preserve original local outputs with source/capture limits, no transcription reruns. QA none; Coordinator owns landing/shared-fix distribution.

### rev-34 · 2026-10-25T11:48:38.429Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1299-final
commit: 588b8927ec55c4ba5dca7b07f301d833800293b6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged 588b8927, carrying source-1/A-11817. Run 013fc6f2 / A-11845 passed 3254 ordinary tests: host T0, Linux droplet all T1/fallback all T2/changed suite-selection T3 file once/Web; remaining T3 and T4 not run. Node 24.21.0, Neovim 0.12.5, Chrome Headless Shell 156.0.8078.4 (v1248). Remote typecheck not repeated; host prepared tree 960177b7 is not a source commit. Independently parsed 99 passing suite-selection identities, including exact original guard case (0.415917316s) and production-guard-growth variant (0.168251902s). Source retains selection, mapped-source description, T1/T2/T4 phase and narrowed-guard assertions; growth changes only scratch production-copy declarations/mappings. C1 verified. Warnings remain report-only; no full T3/T4, load-repeat or QA claim. Standards: no findings. Spec: no findings. No Reviewer rerun.

Criteria: C1 verified.

### coord · 2026-10-25T11:55:03.527Z

Merged bd061ddb5215441902d4061a54b47b7e73f48e11 onto dev.
