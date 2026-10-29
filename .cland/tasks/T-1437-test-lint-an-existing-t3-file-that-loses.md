---
id: T-1437
kind: task
title: "Test lint: an existing T3 file that loses its T3 header is refused with a misleading 'exceeds frozen allowance 0' message"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1199
branch: t/T-1437-test-lint-an-existing-t3-file-that-loses
created: 2026-10-29T04:26:29.075Z
updated: 2026-10-29T17:03:07.606Z
---

## Summary

Found on T-1413 (topic-1171, 2026-10-29). An import placed above the `// T3: …` header of `hub/test/telegram-polling-restart.test.ts` made `analyzeTestSource` treat the file as not lifecycle. The admission lint then refused it with `startDaemon count 3 exceeds frozen allowance 0`. That message points at the frozen baseline, which can only shrink, instead of at the lost header. The `t3-lifecycle` finding that names the real cause is emitted only for new files.

## What to build

When a file mapped T3 (or T4) has no `T3:` header in its leading comment block, the refusal names that cause: "first comment block must name the process behaviour", with the file and line, for existing files too. Process-call counts against the baseline only apply after that.

## Acceptance criteria

- [x] C1. An existing T3 file whose header is preceded by an import is refused with the t3-lifecycle message naming the header, not a frozen-allowance count.
  - done: impl-1437 · 2026-10-29T17:03:06.772Z
- [x] C2. An existing T3 file with its header keeps its current lint result unchanged.
  - done: impl-1437 · 2026-10-29T17:03:07.190Z

## Comments

### impl-1437 · 2026-10-29T17:00:27.253Z

Consumer inventory before policy change (rule 20): checkTestLint/testLintPolicy feed verify admission (hub/src/hub/suite-candidate.ts), merge (hub/src/territory.ts), CLI census/refusal formatter (hub/test/lint-tests.ts), warmer and frozen-baseline validation (test-lint-policy.ts), component fixture (suite-component-fixture.ts). Direct facts consumers retain the TestLintFinding shape/rule union. Tests: test-lint.test.ts, test-lint-policy.test.ts, suite-admission.test.ts, suite-admission-native.test.ts, merge-gate.test.ts; T3/T4 callers searched repository-wide. QA E-676 L5 and E-677 consume the existing T3 diagnostic; it stays byte-for-byte unchanged. No wire/client/persisted record shape changes; web/Neovim only display existing generic refusal strings. Docs: hub/README.md, docs/agents/tests.md; shipped skills have no exact diagnostic dependency. Plan: surface lifecycle finding for existing T3/T4, suppress misleading process-count refusals until lifecycle declaration is valid; retain wall-clock enforcement and manifest contract/scenario exemptions. hub/src files planned: test-lint.ts and test-lint-policy.ts.

### impl-1437 · 2026-10-29T17:02:32.187Z

Coordinator scope clarification (topic-1199): preserve never-headed existing debt. Final implementation is only hub/src/test-lint-policy.ts; direct census is unchanged. Existing T3/T4 missing lifecycle refuses only when base source supplied a declaration or process calls would otherwise exceed allowance. Header refusal replaces process-count consequences; independent wall-clock rules remain. T1 tests cover displaced T3/T4 headers at allowance 0/3, loss without process calls, never-headed/headed unchanged results, and all five process helpers. Local macOS Node run: 38/38 in touched test-lint.test.ts; root npm run typecheck passed. No Linux/full suite evidence yet. SKILL.md untouched under freeze; Coordinator holds proposed rule/skill wording.
