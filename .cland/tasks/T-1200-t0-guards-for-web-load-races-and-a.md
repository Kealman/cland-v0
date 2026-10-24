---
id: T-1200
kind: task
title: T0 guards for Web load races and a repetition gate for new Web files
state: open
status: review
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
updated: 2026-10-24T14:30:04.113Z
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

### rev-23 · 2026-10-24T14:03:23.977Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1200-delta1
commit: d4e2e9775475f283d42d594fade3fa1da092936d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1200 corrected authorized integration delta — clear

Head d4e2e9775475f283d42d594fade3fa1da092936d; tree f23b3eaad6a2e11a306d34787cc883b72364a6ce. Parents documentation fix eb553bcbb799e2c435c7f3c6d7a529befe8eae86 and incorporated dev e053338bac873b11434b8fdc61a2a86516a63bd7; branch ref matches. Carry full functional audit rev-20261024-1200-source/A-11039 at3a1f7ace, M1 only/no functional finding. Coordinator50603879 explicitly approves report-only C2 and T1239 dependency; claimant1954a3b8/8eb17d40 authorize single post-T1239/T1214 integration. Scope delta, run rev-20261024-1200-delta1; findings []. Reviewer read-only source/Git/tracker/docs/artifact parsing, no tests/probes/edits/Git mutation/browser/delegation.

## Standards
M1 resolved: exact '# hub/test/suite-runner.test.ts' guide plus index covers ten synthetic whole-file children, two sequential lanes, CPU ready/progress/liveness, terminal summaries, sealed roots, closed child/terminated worker cleanup and lease-only queued execution. It accurately distinguishes synthetic native lifecycle proof from real browser soak and report-only rollout from ordinary T3 assertion failure.

Compared original task patch d4d596db..3a1f7ace with integrated e053338b..d4e2e977: added/removed line sequences are identical on every original task file except expected help representation/fixture migration and M1 docs/index. No new functional edit. Harness differs from dev only by the same reviewed resizePage helper; landed reconnectUntilLive and its comment remain unchanged. Both AST guards/planted controls, CPU/repetition launcher/reporter, runner lease seam, T1/T3 tests and Web assertion migrations are unchanged from full audit.

usage.ts outside SUITE_USAGE is byte-identical to dev. New repetition help line is in the shipped command-owned row and equals frozen commands.json SUITE_USAGE exactly; every other frozen command, exports.json and help.txt unchanged. All incoming defaults/shard/other help text retained. Skill CHANGES provenance retained. Whitespace clean; no standard/smell finding.

## Spec
C1 syntax guards retain direct raw viewport and root-negated inline waits refusal, shared single AST traversal and rendered 640px helper receipt; no broader alias/whole-program claim. C2 retains new-file-only ten runs/two lanes under owned CPU worker and machine lease, completed typed summary/exit/CPU evidence, skips/fails/incomplete/no-load never green, extra wall outside ordinary Web timing. Coordinator's explicit report-only rollout remains accepted: missing load proof does not block ready during rollout. Existing files require only baseline read and zero extra browser/CPU starts. No policy/role/dependency/permission change. Both criteria are test-dependent, stay runtime-unverified; current done marks present.

A-11045 preserves original partial local macOS/Darwin arm64 excerpts/exits and source limits: initial source web-phase11/11 and checkexit0, precommit phone-disconnected3/3 and phone7/7 with after0 browser census, earlier strict-locator failure fixed by root anchor, planted C1/C2 red excerpts. Not complete raw logs, new-head Web or native CPU proof; no inferred totalcheckwall. A-11048 retains guide-only guard3/3exit0. A-11138 retains resolution-working-tree compatibility1/1(1.691042ms), help1/1(66.308875ms), native merge2/2(226.688292/395.891167ms), docs3/3; committed-head npmcheck finald72d89exit0, shared guard scan61.8ms, lint133/60zero refusals. Per-call polling walls are not command totals; no transcription reruns.

Clear corrected source permits one mode-free configured verify at exact unchanged d4e2e977. Native ten-child/CPU T3 contract and actual selected phases still require original same-head runtime receipt; no local unleased CPU/load probe or forced full suite requested. Original earlier checks are historical only. No per-item QA(none/after-stage), stage or landing claim; Coordinator owns enqueue/merge. Standards0 findings; Spec0 findings.

Durable A-11156.

### coord · 2026-10-24T14:21:27.320Z

Coordinator decision 2026-10-24 14:21Z (ask bd52083b): the remote runner cannot find the dev baseline (the delivery bundle carries only head ancestry), so the host computes the new-Web-file list at selection and carries it as an explicit field; an absent field keeps the 'dev baseline unavailable; missing load proof' report. Landing evidence for C2: after restart #54, a droplet verify of a branch adding a Web test file prints the 10-repetition count.

### impl-1200 · 2026-10-24T14:27:47.685Z

Coordinator90231c27 delta implemented/pushed at28d1199181840673345d0136f748295739d0d655: host-owned webRepetitionFiles from HEAD/fetchedDev merge base, runner no Git, absent/empty/list distinct, additive wire mirror and cache validation. TDD controls14/14 and docs3/3 local macOS; final npm run check exit0 (lint report-only133 findings/60files,0refusals). Original outputs/limits A-11200. Delta source requested from rev-23; no new verification before clear. Expected running-hub absent-field report before restart#54 is missing proof; Coordinator owns post-restart C2 landing count. Prior green3040-test Linux receiptA-11185 applies only to d4e2e977.

### rev-23 · 2026-10-24T14:30:04.113Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1200-delta2
commit: 28d1199181840673345d0136f748295739d0d655
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1200 host-owned repetition-selection delta — clear

Head 28d1199181840673345d0136f748295739d0d655; tree 6e9945b79082c0cd9873f46d81b68e80a734962c; sole parent prior cleared d4e2e9775475f283d42d594fade3fa1da092936d. Branch ref matches. Comparison git diff d4e2e977..28d11991,14 files; no dev merge. Scope delta, run rev-20261024-1200-delta2. Carry full source audit A-11039 and corrected integration A-11156. Coordinator90231c27 directly read in topic history explicitly owns this bounded transport correction and rollout boundary. Static source/Git/tracker/artifact reads only, no tests/probes/edits/Git mutation/browser/delegation.

## Standards
No findings. Host selectPackageSuite computes optional webRepetitionFiles alongside successful fetchedDev proof, using changed-file candidates and merge-base(dev,HEAD), then NUL baseline tree listing. New/renamed target paths absent at the common ancestor count, even when a newer dev tip contains them; existing paths are excluded. No candidates needs no extra tree lookup. Fetch/diff fallback or unavailable baseline leaves the field absent rather than asserting empty proof. Existing task/tier selection spreads retain it.

Runner receives only the carried list intersected with its actual admitted phase files. No runner execFile/Git import or baseline fallback remains. Absent returns explicit missing-proof report; [] emits checked zero-new report before fixture/CPU setup. Populated list retains prior two-lane/five-round owned CPU/child launcher, terminal summary validation, active child cleanup/closed receipt and worker terminate/exit receipt. Native fixture removes obsolete Git initialization/commit, passes an explicit list, retains all10/10/CPU/sealed-env/ten fresh summaries/active-set-empty assertions and prints its asserted report as a diagnostic. No lifecycle assertion/bound weakened.

SuiteSelection optional field and shared/wire mirror match exactly. Existing JSON/file selectionTransport carries the complete object on local worker and droplet paths. selectionFromEnv validates array/string/path shape, rejects dot traversal, duplicates, non-Web paths, CR/LF/NUL/backslash; optional absence remains valid. sameSuiteSelection compares the carried list, separating absent/[]/populated so missing-proof cache cannot masquerade as checked proof. Old producers may omit it; no new running-hub capability is required before restart.

Three new T1 controls use pure scripted Git/selection seams, no process/CPU/browser: ancestor/new/renamed/existing/newer-tip plus thrown baseline, runner list/intersection/empty/absent, transport/cache and malformed list refusal. Existing per-test guides accurately cover these controls and revised native fixture. Docs/help architecture and prior C1 syntax guards unchanged; skill CHANGES provenance present. No dependencies, permissions or role clause expansion. Whitespace clean; no material smell finding.

## Spec
Correction satisfies Coordinator90231c27's host-owned selection, no runner Git, honest absent-field report and explicit empty-list meaning. General task C1 and C2 implementation remains accepted under report-only steering50603879. Before restart#54 the currently running hub is expected to omit the field; missing-baseline report is not a fabricated count or a pre-merge failure. Coordinator owns post-restart droplet count as C2 landing evidence; it is not established here or required as pre-merge gate by that decision.

A-11200 retains local macOS working-tree original red outputs: host list [] versus new/renamed/concurrent, runner [] versus undefined, cache true versus false; all exit1. Final web-phase14/14 exit0 native Node296.557875ms (new controls .878834/.112666/.224042ms), docs guard3/3 exit0 Node134.270125ms. npmcheck final-source working tree subsequently committed unchanged exit0, typecheck/build/T0/shared guard64.4ms, report-only lint133/60zero refusals; preceding shared-wire/type narrowing failure disclosed. This artifact contains retained output/exits/native timings and source limits, not a new configured gate or an inferred checkwall. No local CPU probe/browser rerun claimed.

Historical A-11185 at OLD d4e2e977 remains green3040ordinary+15load, native synthetic CPU contract1.368662182s, actual admission missing baseline. A-11191 preserves that distinction; it does not verify replacement source. Both C1/C2 stay runtime-unverified here, claimant done present.

Clear source permits one ordinary mode-free configured verify at unchanged28d11991, then evidence review. Retain expected absent-field/landing boundary in the new receipt; no forced full mode, extra repetitions or unleased CPU probe requested. No item QA(none/after-stage). Coordinator owns enqueue/merge and post-restart evidence. Standards0 findings; Spec0 findings.

Durable audit A-11202.
