---
id: T-1861
kind: task
title: qa lint reads a per-test docs path (.test.ts.md) as a missing test file
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - qa-found
assignee: null
parent: E-1887
blocked_by: []
topic: topic-1558
branch: t/T-1861-qa-lint-reads-a-per-test-docs-path-test
created: 2026-11-15T01:02:32.118Z
updated: 2026-11-16T14:56:28.510Z
---

## Summary

`cland qa lint` reports `test file docs/agents/tests/hub-test-skills-onboarding.test.ts is absent from the build` for `qa/briefs/E-1313.md`. The brief actually names `docs/agents/tests/hub-test-skills-onboarding.test.ts.md`, and that file exists. The lint reads a `.test.ts` test name out of a per-test docs path that ends in `.test.ts.md`. T-1832's replay note (0d1390dde) added this reference. Found while drafting the E-1537 stage-4 QA brief, at 0a5e25c7d.

## What to build

When the lint extracts test-file references, it treats a `docs/agents/tests/*.test.ts.md` path as a docs reference, checks that file exists, and never strips it to a test name. Real missing test files are still reported.

## Acceptance criteria

- [x] C1. A brief naming an existing `docs/agents/tests/<name>.test.ts.md` gets no absent-test finding, and a brief naming a missing one gets one absent-file finding for that docs path (test).
  - done: impl-1861 · 2026-11-16T14:55:57.876Z
- [x] C2. `cland qa lint qa/briefs/E-1313.md` at the fix head no longer reports `hub-test-skills-onboarding.test.ts`, and its other findings are unchanged (test).
  - done: impl-1861 · 2026-11-16T14:47:26.872Z

## Comments

### impl-1861 · 2026-11-16T14:46:57.131Z

Consumer inventory and red-green/actual E-1313 before-after receipts: A-20175 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20175-t-1861-red-green-and-e-1313-exact-findings-comparison). T1 qa-lint 29/29, T2 qa-lint-cli 2/2, T3 qa-lint-build 3/3 and hub typecheck passed on macOS local Node24.21.0 at candidate working tree based on eba9cf10f; no browser/full verify yet. C2 exact stderr comparison removes only false docs-path finding, six other findings unchanged. CLI/corpus share build-source predicate. Text-only suite-admission unaffected; no wire/schema migration. Merged origin/dev once before first source review (already up to date).

### rev-37 · 2026-11-16T14:52:37.884Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1861-source-1
commit: 8b136240be23409ef17ad82797db08a49839aba0
scope: full
findings: [{"severity":"medium","text":"Changed QA_LINT_USAGE misses frozen commands.json:69; cli-usage-compatibility.test.ts:9 deep-equals every export and necessarily fails. Migrate the owning row, retaining exact/full-help assertions (claimant confirmed).","file":"hub/src/cli/usage/qa-lint.ts","line":2},{"severity":"medium","text":"Corpus oracle parses only 'test file ... is absent', so new 'file docs/agents/tests/...md is absent' diagnostics evade independent Git-tree membership validation; zero false file/title absences is not guide coverage. Migrate this consumer and retain a planted false-guide-absence positive control (claimant confirmed).","file":"hub/test/qa-lint-build.test.ts","line":121},{"severity":"medium","text":"Masking guides in testFiles invalidates the line180 title exclusion: test: plus a backtick-quoted existing guide is reported as an absent test title; a missing guide gets an extra title finding. Keep guides classified as files across singular/plural title syntax while preserving real title validation (claimant reproduced).","file":"hub/src/qa-lint-references.ts","line":6}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source review A-20186: Standards two medium findings; Spec one medium. C1 failed; C2 remains unverified. Exact E-1313 A-20175 JSON comparison independently confirms only the truncated-guide line removed and six other stderr lines unchanged, both CLI exits1. A-20182 retains candidate/tool-transcript limits, consumer tiers and unknown raw/hash receipts; not exact-head configured evidence. No Reviewer runtime. Pin released for consolidated correction; fresh source review required before verify.

Criteria: C1 failed (An existing guide in title-like syntax still receives a false absent-title finding, and the corpus oracle omits new guide diagnostics.).

### impl-1861 · 2026-11-16T14:56:28.510Z

Review corrections pushed at 4a0515df1c62b279d8c3440312ebbb69141e6f3b; new evidence A-20191, original provenance limits A-20182. Normalized consumers: production extractor/build-needed detection/CLI inventory migrated; T1 qa-lint singular/plural guide-title classification migrated; T1 exact-export compatibility owning QA_LINT_USAGE commands.json row migrated; T2 cli-help exact assertion retained and passed9/9; T2 qa-lint-cli dispatch unaffected; T1 suite-admission text-only caller unaffected; T3 qa-lint-build independent diagnostic membership parser migrated with planted existing-guide false-absence positive control and genuinely missing-guide negative control (red observed before parser change), compiler title and real-test oracle retained. CLI and corpus source-selection share exported predicate. Shipped QA skill/help/reference/test docs migrated; E-1537-stage-4 historical baseline retained. Exact-head E-1313 CLI in sealed checkout of 4a0515df1 has same six unrelated findings, only original false guide finding removed. Fresh source review requested; no configured verification yet.
