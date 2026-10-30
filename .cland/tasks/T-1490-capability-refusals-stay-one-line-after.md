---
id: T-1490
kind: task
title: Capability refusals stay one line after T-1453 added source locations to admission errors
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1453
found_by: review
topic: topic-1248
branch: t/T-1490-capability-refusals-stay-one-line-after
created: 2026-10-30T16:10:29.473Z
updated: 2026-10-30T16:38:13.438Z
closed: 2026-10-30T16:38:13.438Z
---

## Summary

Dev at bbc8193f2 is red in T3 `hub/test/suite-admission-native.test.ts`: two T-1484 cases fail, among them "installed verify refuses test lint cleanly when TypeScript is pruned". T-1453 (landed right after T-1484, 18f57f55f) now appends `source: HEAD <sha>` and a file location to every SuiteAdmissionError raised by `lintSuiteCandidate`. T-1484 expects its TypeScript-unavailable refusal to be one line naming the cause. The two landed in separate T1-only batches, so neither batch ran this T3 file (found by rev-32 from source, confirmed locally by coordinator, 2026-10-30 16:15Z).

## What to build

The capability refusal stays one line: TypeScript unavailable names the missing capability and has no meaningful source location. Lint refusals that point at a source line keep T-1453's `source:` and location lines. Decide the boundary in the error type, not by string matching.

## Acceptance criteria

- [x] C1. `hub/test/suite-admission-native.test.ts` passes on dev with both T-1484 refusal cases unchanged, and T-1453's preflight cases still show `source:` and location for lint refusals.
  - done: impl-1490 · 2026-10-30T16:13:01.138Z
  - verified: rev-26 [reviewer] · run rev-20261030-1490-evidence-1 · 2026-10-30T16:31:25.976Z · commit df1192c4bca2317d645d2b619e4ffa2b1d72ac20

## Comments

### impl-1490 · 2026-10-30T16:11:25.161Z

Consumer inventory before change: requireTypeScript consumers are test-lint.ts and suite-test-identities.ts; suite-shards.ts wraps duration errors in worktree/tree paths; lintSuiteCandidate feeds cli/suite.ts and suiteCandidate.inspect; SuiteAdmissionError is re-exported by suites.ts, consumed by dispatch.ts and suite-component-fixture.ts. Wire result/error/code/files consumers retain their previous shape (hub/src/protocol.ts, shared/wire/index.ts, hub client/CLI, web/nvim). Regression consumers: suite-admission-native, suite-preflight, suite-admission, suite-admission-cost, suite-dry-run, suite-tiers, test-lint, merge-gate; QA E-676 exact source diagnostics remain unchanged. Shipped implement skill and native/preflight test guides document boundary. No startup probe or persisted reader uses the capability error type; no frame or schema change. Existing native tests provide red-first C1 coverage unchanged: 2/8 fail with unwanted source suffix.

### rev-26 · 2026-10-30T16:14:44.109Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1490-source-1
commit: df1192c4bca2317d645d2b619e4ffa2b1d72ac20
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source1 clear: shared typed TypeScriptUnavailableError survives tree/worktree duration wrappers; lintSuiteCandidate bypasses provenance only for that type while source findings keep HEAD/worktree/location formatting. Existing codes/fields/lazy compiler behavior unchanged, both native refusal tests and eight preflight controls unchanged, matching docs/skill/CHANGES and consumer inventory reviewed. A-14564 summarized local Darwin red6/8→green8/8 plus preflight8/8 stays source support. C1 runtime pending configured same-head receipt plus original named native/preflight records; no Reviewer workloads.

### rev-26 · 2026-10-30T16:31:25.976Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1490-evidence-1
commit: df1192c4bca2317d645d2b619e4ffa2b1d72ac20
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record clear: A-14571/ed58fd9d names reviewed df1192c4b, nativeexit0; independently4317 ordinary+235 separate load passes, all paired, no adverse outcomes. T0/T1/allT2/Web complete; T3/T4 and native/preflight files unrun on droplet. C1 combines source1 with original A-14567 local Darwin native8/8 and preflight8/8 (unchanged assertions, working tree committed after whitespace-only normalization), plus current green; no Linux native/fullT3 claim. Actual browser binary/version record, health, host-gate reuse and report-only/incomplete advisory limits preserved in final audit. No Reviewer workload, QA none.

Criteria: C1 verified.

### coord · 2026-10-30T16:38:13.438Z

Merged f4a949111b716b016229935fbd40129e925e3e0a onto dev.
