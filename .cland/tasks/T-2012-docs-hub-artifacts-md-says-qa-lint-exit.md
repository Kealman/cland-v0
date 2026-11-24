---
id: T-2012
kind: task
title: docs/hub/artifacts.md says qa lint exit 0 means 'no findings'; it should say 'no blocking findings' after T-1903's report-only advisories
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: topic-1741
branch: t/T-2012-docs-hub-artifacts-md-says-qa-lint-exit
created: 2026-11-19T19:40:29.286Z
updated: 2026-11-24T12:02:34.413Z
closed: 2026-11-24T12:02:34.413Z
---

## Summary

`docs/hub/artifacts.md:177` says a `cland qa lint` exit 0 means "no findings". Since T-1903 added report-only QA lint advisories, exit 0 means "no blocking findings". The main qa-brief-lint reference and help already say so. This was a low, non-blocking finding in T-1903's review (A-21884).

## Acceptance criteria

- [x] C1. `docs/hub/artifacts.md` describes exit 0 as "no blocking findings", matching the qa-brief-lint reference and help, and no other doc still says "no findings" for that exit (search across docs and skills) (docs).
  - done: impl-2012 · 2026-11-24T11:24:19.844Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-2012-source · 2026-11-24T11:25:17.075Z · commit bca344b87b85b12059a4383094fa843775c90360
  - verified: rev-40 [reviewer] · run rev-40-20261124-2012-final · 2026-11-24T11:58:13.002Z · commit bca344b87b85b12059a4383094fa843775c90360

## Comments

### impl-2012 · 2026-11-24T10:56:03.908Z

Confirmed sole stale QA lint exit description in docs/hub/artifacts.md. Focused assertion failed before the fix and passed after; docs/skills search has no other QA lint no-findings claim. qa-lint.test.ts T1 passed 36/36 locally on macOS with Node v24.21.0. Awaiting coordinated lint slot before review.

### rev-40 · 2026-11-24T11:25:17.075Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2012-source
commit: bca344b87b85b12059a4383094fa843775c90360
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at bca344b87. C1 source-verified: artifacts.md:177 correctly states no blocking findings for0 and blocking findings for1, matching runQaLint's separate advisory output and blocking-only return status, qa-brief-lint reference and help. Exact-head docs/skills search finds only unrelated no-findings statements about adapter review/design verdicts; no stale QA lint exit claim. One paragraph/docs-only, no runtime/help/policy contract change. A-22882 records both axes and A-22880 local macOS Node24.21 focused/static evidence limitations. Configured verification remains pending; source criterion verification is not final suite clearance. No findings or reviewer tests/probes/edits.

Criteria: C1 verified.

### rev-40 · 2026-11-24T11:58:13.002Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2012-final
commit: bca344b87b85b12059a4383094fa843775c90360
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchangedbca344b87. cf9e54f5/A-22911 exact-head finished/passed, canonicalabcb7455 executable match. C1 documentation/source mark retained; all36qa-lint base outcomes pass, plus exact CLI advisory-exit0/blocking-exit1 control29114 and error/help controls29077/29109. T0/T1/fallbackT2/selectedT3/Web exit0;7processfiles100passing identities once/no repetitions, remainingT3 batch/T4unexecuted;7469pass/1Mac-selector skip/0fail. Noncached Linuxx64c8nyc1 workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156.0.8078.4; budgets/lint advisory, no performance claim. A-22912 records both axes/provenance/limits. No findings or reviewer runs/edits.

Criteria: C1 verified.

### coord · 2026-11-24T12:02:34.413Z

Merged bcb6abc94e39b4e4efeea571adf6b95cdd780ae4 onto dev.
