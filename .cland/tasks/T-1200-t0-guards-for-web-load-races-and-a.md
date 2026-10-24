---
id: T-1200
kind: task
title: T0 guards for Web load races and a repetition gate for new Web files
state: open
status: in progress
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-980
branch: t/T-1200-t0-guards-for-web-load-races-and-a
created: 2026-10-24T06:46:04.641Z
updated: 2026-10-24T12:51:58.723Z
---

## Summary

Three Web load races in v0.2 (T-1157 auto-retry, T-1182 measuring before the phone layout switch, T-1183 clock pause). T-1183 guards only the clock pattern. Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. A T0 check refuses raw viewport resizes across 640 px outside the helper that waits for [data-phone], and refuses waits on negated predicates, each with a planted violation (test).
  - done: impl-1200 · 2026-10-24T12:42:33.472Z
- [x] C2. A new Web test file passes 10 repetitions at two workers under CPU load before ready, and verify reports the count (test).
  - done: impl-1200 · 2026-10-24T12:51:58.723Z

## Comments

### impl-1200 · 2026-10-24T12:31:58.516Z

TDD: C1 planted violations first failed with 'Missing expected exception' in lint-web-workspace.ts; parsed guards now catch raw resize and root-negated wait callbacks. C2 T1 planner first failed [] vs ['web/test/new.test.ts']; ten-pass/two-worker planner and incomplete/skip/failure/CPU controls now green in targeted web-phase.test.ts. Implementing runner receipt and documentation wiring; no full suite or CPU stress run locally.

### impl-1200 · 2026-10-24T12:42:48.883Z

Committed and pushed head 3a1f7acedabe36930fb506933c02c9b294bf03d8 after clean merge of freshly fetched dev d4d596db. npm run check at that head passed on local macOS (typecheck/build/T0; test lint report-only 133 findings/60 files, 0 refusals). Targeted T1 web-phase.test.ts 11/11 at the head. Pre-merge isolated Headless Shell phone-disconnected 3/3 and phone 7/7, no full Web run yet. Source review request is queued for next free live reviewer; no verification submitted before a clear source verdict. C2 native ten-file/CPU runtime evidence remains pending queued post-review verification. A-11022 records source scope, TDD and measured T0 cost (final head combined Web load guards 62.0 ms).

### rev-23 · 2026-10-24T12:50:10.437Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1200-source
commit: 3a1f7acedabe36930fb506933c02c9b294bf03d8
scope: full
findings: [{"severity":"medium","text":"M1: New native ten-child/CPU repetition contract requires docs/agents/tests/hub-test-suite-runner.test.ts.md with exact repo-path heading and index row, per docs/agents/tests.md.","file":"hub/test/suite-runner.test.ts","line":48}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1200 full source review — not clear (M1)

Head3a1f7acedabe36930fb506933c02c9b294bf03d8/tree6d3881d63ba13ff362a5a04ed1b9f38b1c716081; branch ref matches. Fixed base d4d596db5a17729539508950510262dc00550240; git diff d4d596db...3a1f7ace; commits b06e1723 plus pre-review clean dev merge3a1f7ace. Thirty changed files441additions53deletions. Reviewer hold rev-23; scope full, run rev-20261024-1200-source. Both axes in-session per reviewer.subagents=false; static source/Git/docs/tracker/artifact inspection only, no tests/probes/edits/Git mutation/browser/delegation.

## Standards
M1 medium, hub/test/suite-runner.test.ts:48: new native Web-repetition lifecycle contract lacks required path-derived guide and index entry. docs/agents/tests.md opening rule requires test-specific guidance. Neither docs/agents/tests/hub-test-suite-runner.test.ts.md nor index row exists at this head. Add exact heading '# hub/test/suite-runner.test.ts', native ten-child/two-lane/CPU-ready+progress and terminal-summary evidence, sealed per-repetition directories, process cleanup and machine-lease-only execution; one index row. The native T3 process boundary is justified by child/worker lifecycle. Existing T1 web-phase guide covers pure planner/summary/rejection controls correctly. No further documented-standard or material smell finding.

C1 source: one TS AST parse/walk per Web test/helper catches direct named setViewportSize outside exact harness resizePage owner; rejects odd root ! in inline arrow/function returns passed to pageUntil/until/waitForFunction and retains even !! presence. Planted six refusal controls and positive/comment controls run at T0. This is a syntax guard for the documented inline forms, not whole-program/aliased-callback proof. resizePage waits for rendered #root > data-phone at width<640 (initial about:blank returns until pageCase first navigation). Migrations retain narrower geometry/positive state receipts and final assertions; negative DOM checks use bounded detached locator + explicit final count. Existing non-root-negated conjunctions remain. Skill edit has CHANGES provenance, no role-clause expansion/dependency change. Combined scan61.3–120.6ms per local summary; no browser work at T0. Source whitespace clean.

C2 source: new files are selected admitted Web paths absent from fetchedDev Git tree; fallback origin/dev is read locally, no fetch. Missing baseline reports missing proof; existing files start no CPU/child repeats. Two sequential lanes each five rounds provide ten unique indices. Success requires exit0, typed complete single summary, positive pass count, zero failure/skip/todo and observed CPU progress plus live worker at receipt. Reporter uses terminal Node summary only; multiple/torn/missing JSON cannot parse as proof. Native synthetic contract exercises actual sealed file processes and owned busy CPU worker, explicit10/10/fresh receipt files and empty active set, not a real-browser load soak itself. Pure controls cover incompleteness, skip, failure, zero tests, no CPU and interruption; existing suiteSummary prefix retains count.

The run-suite seam starts repetitions only after ordinary successful Web execution, retains machine lease and interruption tracking, reports separate extra wall outside ordinary Web budget. Child bootstrap holds execution until identity registration; per-repetition processes use runnerFixtureEnvironment/owned roots, timeout and owned process cleanup/closed receipt in finally. CPU worker is owned and terminated/exit-observed in finally, including setup errors. Repetitions do not contribute ordinary timing/repetition identity receipts. Source does not force new protocol/summary capability on running hub. Existing all-Web assertion failures still fail the ordinary suite.

## Spec
No functional finding. C1/C2 intended behavior is present, subject to runtime evidence. C2 wording says before ready, but Coordinator50603879 explicitly approves report-only rollout, new Web files only and load only within runner lease; this is accepted task steering, not a missing enforcement finding. Counts below10/10/missing load proof can therefore coexist with ready during this rollout, as docs/help/skill consistently state. No enforce-ready/all-Web/all-T3 cover claim.

A-11022 currently supplies summary-level local macOS working-tree TDD red/green and isolated sealed phone3/3+7/7 claims. It discloses earlier two-data-phone strict-locator failure corrected to root anchor, and distinguishes pre-merge browser checks from head-local check/web-phase11/11. Complete original command/output/exits/per-case timings not yet retained in this artifact; requested available originals with exact source/platform and missing-record limits, no reruns for transcription or inferred checkwall. New native CPU/child contract intentionally awaits queued verification rather than unleased local load.

Coordinator50603879 also authorizes one future dev integration after T-1239 shared reconnect fix, including rule11 exception. That dependency is not yet in this reviewed head. Keep current finding set M1 consolidated; after guide fix and authorized integration, request replacement exact-head review before verify. C2 failed for missing native contract guidance; C1 runtime remains unverified. No item QA required (none/after-stage). Standards1 medium finding; Spec0 functional findings.

Durable audit A-11039.

Criteria: C2 failed (M1: native repetition lifecycle contract lacks required per-test guide/index.).
