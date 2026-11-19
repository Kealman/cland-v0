---
id: T-1890
kind: task
title: Lint ratchet for fixed bounds in condition waits
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1889
topic: topic-1659
branch: t/T-1890-lint-ratchet-for-fixed-bounds-in
created: 2026-11-16T07:29:44.909Z
updated: 2026-11-19T21:25:56.642Z
closed: 2026-11-19T21:25:56.642Z
---

## Summary

test-lint already freezes `setTimeout`/`sleep` counts in `lint-baseline.json`, but not literal `timeoutMs` in `until`/`eventually`/`remoteEventually` (671 literals in 93 files). Count them, freeze, report new ones. §7 #2.

Kind: product (test lint). Triage ticket H-2 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [x] C1. Numeric `timeoutMs` and `loadFactor: 1` in condition waits count as `wall-clock-wait` unless the call names a behaviour-bound reason (test).
  - done: impl-1890 · 2026-11-19T19:34:15.308Z
  - verified: rev-39 [reviewer] · run rev-20261119-1890-final-3 · 2026-11-19T20:01:07.022Z · commit bbe465c684d89b459a440d41d9657ee7e5cb7bdd
- [x] C2. Current counts are frozen in `lint-baseline.json`, and a new literal in a changed file is reported in report mode (test).
  - done: impl-1890 · 2026-11-19T19:34:15.804Z
  - verified: rev-39 [reviewer] · run rev-20261119-1890-final-3 · 2026-11-19T20:01:07.022Z · commit bbe465c684d89b459a440d41d9657ee7e5cb7bdd

## Dependencies

H-1

## Comments

### impl-1890 · 2026-11-19T19:17:45.257Z

Consumer audit (rules 20/41): baseline direct readers/writers are hub/src/test-lint-policy.ts and hub/test/lint-tests.ts. Admission callers: hub/src/hub/suite-candidate.ts, hub/src/hub/suites.ts, hub/src/merge-test-lint.ts. Census/report callers: hub/test/lint-tests.ts and hub/test/test-lint.test.ts. Tests/fixtures pinning policy or report: test-lint.test.ts, test-lint-policy.test.ts, suite-dry-run.test.ts, suite-check.test.ts, suite-protocol.test.ts, suite-component-fixture.ts, suite-admission-cost.test.ts, suite-admission-native.test.ts; broader routing/import consumers: suite-admission.test.ts, merge-gate.test.ts, suite-tiers.test.ts, cover-quiet.test.ts, test-docs.test.ts, source-fixture.ts, harness.ts. CLI usage frozen commands.json contains no changed report bytes/help export. Docs: docs/agents/tests.md and tests/hub-test-test-lint.test.ts.md, hub/README.md, implement skill; historical evidence and merge/running docs retain existing enforce-only claims about refusals. No nvim, web, startup probe or raw socket consumer of the baseline/report found. Existing callers retain default refusal-only results; additive optional conditionWait field preserves old v1 baseline readers; previous-shape regression retained. No tier changes.

### impl-1890 · 2026-11-19T19:21:19.740Z

Validation before source review: Node v24.21.0, local macOS, candidate based on 03efb0fc1eaf62bebf7213fd74480d3e57dca887. T1 serial selection: test-lint, suite-tiers, test-docs, close-shards, load-gate-rerun, nvim-fixture-boundary, suite-cover, suite-task-selection, web-phase: 127/127 pass. T2 serial selection: test-lint-policy, suite-admission-cost, suite-protocol: 25/25 pass. Full typecheck passes. Parser positive control first failed 0 !== 1; baseline positive control first failed undefined !== 1, then both passed with implementations. No browser, native/T3, stress, or configured verification run executed. Final full test:lint underway. Audit supplement: suite-shards directly consumes touchesMachineResources; its tier/selection importers and tests were searched; suite selection refuses growth only through unchanged default policy, and advisory syntax adds no resource tier. No classification moves or inherited tier proof.

### impl-1890 · 2026-11-19T19:23:35.803Z

Final source-review head fdc7ce8cafac5c2de635dd91985bb9641bd59f4f pushed to origin, clean worktree. Second full npm run test:lint passed exit 0 (0 advisory growth, 0 refusals); full typecheck and selected 127 T1 + 25 T2 passed. Evidence A-21870 at .cland/artifacts/A-21870-t-1890-parser-and-baseline-validation.md. Exact pre-change v1 validator accepted new baseline and rejected planted unknown category. Reviewer requested; configured verification pending clear source verdict and Coordinator window.

### rev-36 · 2026-11-19T19:29:00.992Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1890-source-1
commit: fdc7ce8cafac5c2de635dd91985bb9641bd59f4f
scope: full
findings: [{"severity":"medium","text":"Spec P1: advisory growth comparison runs only when previous.conditionWait exists. A legacy base without the map plus an inflated current allowance suppresses all excess reports; shrink at line67 drops an empty map, so exhaustion/deletion and reintroduction can reset the ratchet. Existing raised-baseline test starts with a present map. Anchor initial/zero debt and cover inflated first publication plus empty/deleted-map reintroduction, preserving old-v1 readability and report-only/non-admission behavior. Lead0d367163 confirms no omitted owner/disposition.","file":"hub/src/test-lint-policy.ts","line":81},{"severity":"low","text":"Standards S1: the new condition-wait workflow paragraph lacks its required paragraph-scoped T-1890/reason marker (docs/agents/documentation.md:16–24; skill line13). The sibling CHANGES record does not satisfy it, and report-mode checker exit0 does not establish compliance. Add the marker or follow the documented guidance/pointer placement. Lead18fcab7b confirms the omission.","file":".agents/skills/implement/SKILL.md","line":17}]
finding_counts: {"high":0,"medium":1,"low":1}

Source NOT CLEAR at corrected fdc7ce8cafac5c2de635dd91985bb9641bd59f4f/tree49e36f46e95db7bc1b38afe940c6aa049018d111, base03efb0fc1; clean readback, one10file commit. A-21873 separates Standards1low and Spec1medium. P1 is a static control-flow counterexample, not a Reviewer reproduction; lead0d367163 confirms it. Existing whole-baseline original-freeze handling does not anchor introduction of this optional field. Preserve first/zero debt across initial publication, empty shrink, deletion and reintroduction, with pure policy regressions; keep the gate advisory and backward-compatible. S1 unmarked new skill paragraph confirmed18fcab7b; required reason marker/placement correction is independent of CHANGES provenance.

Positive source review: shared AST/binding syntax census, literal/nonblank behaviour and alias controls; separate advisory bucket excluded from default admission/merge refusals; unchanged resource classification; CLI exit still uses default findings. Existing files/category baseline JSON unchanged;634newcounts/89manifestfiles. Runtime-resolved options explicitly outside syntax scope. C1source looks implemented but remains unverified until fixed-head configured evidence. C2failed; nothing verified.

A-21870/e2e1348e retain evolving parser/baseline reds0!==1/undefined!==1, precommit serial9T1files127/127 and3T2files25/25, finaltypecheck/lint0, localmacOSNode24.21/browsernone. Firstlint overlapped edits; TS2379 failure/fix retained. Finalcensus765/149,conditiongrowth0/refusals0 does not exercise P1. No immutable invocation trees, full exported raw logs, native PID/signal/env/timestamps; selected old-validator control not whole-client pass. No configured/T3/T4/Web/QA coverage claimed. Independently pinned consumer tiers; QA E676:218/E677:238 procedure expectations retain old enforced semantics and are unexecuted; frozenhelp bytes unchanged. Full scope/provenance in A21873, no historical counts promoted.

Hold released for bounded corrections and required local checks; fresh exact-head source review before configured verification. No full run requested. Reviewer read-only inspection only, no edits/tests/probes/scans/generators/native/browser/delegation.

Criteria: C2 failed (The advisory baseline can be inflated without a report when first published over a legacy base, or reset after its empty/deleted map is reintroduced; original and zero debt are not durably anchored.).

### impl-1890 · 2026-11-19T19:31:30.627Z

Review rev-36-1890-source-1 bounded fixes: new missing/exhausted-map regression first failed actual false / expected true on legacy v1 prior baseline, then passed 41/41. Missing map now means zero for advisory baseline growth comparisons, including first publication and reintroduction; shrink retains empty conditionWait map. No silent seed/reset, default admission unchanged. Added required immediately preceding workflow reason marker. Selected T1 128/128, T2 25/25 and full typecheck pass; final full lint underway. No merge-dev or configured verification after first review. Earlier A-21870 remains a precommit summary with invocation-tree/PID/signal/time limits clarified in reviewer answers.

### impl-1890 · 2026-11-19T19:34:28.941Z

Fresh review requested at bbe465c684d89b459a440d41d9657ee7e5cb7bdd, pushed clean to origin. Bounded fixes pass full typecheck and test:lint (89 advisory initial allowance reports, 0 refusals), 128 selected T1 and 25 selected T2. A-21876 retains redacted check logs, exact commands/order and explicit invocation identity/native metadata limits; original red and prior not-clear retained. Reviewer role received request (resolved rev-39). No configured verification until clear source verdict and Coordinator window.

### rev-39 · 2026-11-19T19:36:50.262Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1890-source-2
commit: bbe465c684d89b459a440d41d9657ee7e5cb7bdd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1890 corrected source review CLEAR
Commitbbe465c684d89b459a440d41d9657ee7e5cb7bdd
Git tree558b426ff598985798cc40b599e2c99ca3bbc940
Base03efb0fc1eaf62bebf7213fd74480d3e57dca887
Reviewrev-20261119-1890-source-2; scope full.
Correction after rev-36-1890-source-1/fdc7ce8ca:6files,+32/-3,no dev merge.

## Standards
Clear; no findings. PriorS1 resolved by the immediately preceding T-1890/nonblank-reason cland-workflow-change marker for the new skill paragraph; CHANGES provenance and shared/per-file docs updated separately. New tests remain pure T1 syntax/policy data, no new fixture/native/timer lifecycle. Shared AST/binding facts supply both parser and baseline policy, without a copied checker or resource/tier change. Optional top-level conditionWait field keeps original v1 files/category shape readable by older callers; no frozen help bytes change or new command/role permission.

## Spec
Clear; no findings. PriorP1 resolved: report-mode allowance growth comparison is unconditional and treats absent prior maps as zero. First publication, explicit empty/exhausted map and deletion/reintroduction no longer suppress advisory baseline increases. shrink returns conditionWait even when empty; deletion leaves unallowed source-site reports. New pure regression covers those cases while checking default admission stays empty. Existing fixed-count/growth line/legacy baseline/real timer refusal and syntax positives/negative controls remain.
Independently compared baseline JSON objects:634advisory sites/89files unchanged from first reviewed head; existing files/category counts exactly equal original base; version1 retained. This is a JSON fact check, not an AST census rerun.
C1 syntax behavior remains shared: inline numeric timeoutMs/literal loadFactor1 for until/eventually/remoteEventually including imported aliases; nonblank literal behaviour exempts; both properties in one options object count once; strings/comments/unrelated/dynamic inputs are excluded as documented. Runtime-resolved options remain explicitly outside syntax scope.
C2/report-only boundary preserved: only CLI lint calls policy with reportOnly:true for advisory lines; default admission/merge/exit path skips condition-wait bucket. No advisory refusal/enforcement added. First89seed notices are intentionally visible; existing timer debt/resource classification/default refusal semantics unchanged. Production, raw baseline/parser/report callers, tier/selection consumers, docs/skill/QA procedure references and frozen help disposition from prior full review remain applicable and were checked against changed paths.

Evidence A-21876 retains redacted command/order account and candidate-worktree limitations. Missing-map red log:41tests/40pass/1fail, AssertionError with legacy baseline actualfalse/expectedtrue; preserved separately. Corrected pure file41/41; selected9T1files128/128;3T2files25/25; zero fail/cancel/skip. Companion lint log reports89initial advisory allowance growth and0refusals; full typecheck reportedexit0. Checks completed before commit in evolving candidate on local macOS Node24.21.0, no immutable invocation-tree/PID/signal/UTC proof. Personal path redaction/scanner facts remain author's export account. Command durations11.177193291s/13.197027833s are selected T1/T2 command scopes, not suite timing or speedup. Earlier A-21870 parser/baseline reds, mixed firstlint/TS2379 correction and selected old-validator proof keep original scope; not a whole old-client pass.
No browser/T3/T4/Web/QA/stress/configured verification in this evidence. No historical tier proof promoted. C1/C2 remain unverified pending same-head configured evidence; source and selected precommit checks alone are not final clearance.

Standards0/Spec0 findings. No Reviewer edits/tests/probes/scans/generators/browser/delegation/commits/merges; read-only pinned Git/source/JSON/docs/artifact inspection only, diff whitespace check passes. Source clear permits configured verification at this exact head under Coordinator window.
A-21880: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21880-t-1890-source-clear-advisory-seed-reset-ratchet-and-workflow-marker.md

### impl-1890 · 2026-11-19T20:00:39.113Z

Configured verification da39687f-7e75-40fc-94a0-109ca4b1120f passed at reviewed bbe465c684d89b459a440d41d9657ee7e5cb7bdd / tree 289f6ebf418fbc8bdacaf248baf6ab48b8e12a47, evidence A-21891. T0 host check exit0; droplet Linux x64 6.8.0-149-generic, Node v24.21.0: T1, fallback all T2, and Web exit0; aggregate 7025 pass, 0 fail/cancelled/skipped/todo. Browser receipt: Chrome Headless Shell / Google Chrome for Testing 156.0.8078.4, chromium_headless_shell-1248. T3/T4 did not run in this task receipt; T3 is deferred to merge batch under enabled queue. Duration and Web wall budgets remain report-only, with advisory overruns in A-21891, not silently cleared. Droplet lifetime 1191s, cost $0.0827. No resubmission or source change; awaiting reviewer same-head final settlement.

### rev-39 · 2026-11-19T20:01:07.022Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1890-final-3
commit: bbe465c684d89b459a440d41d9657ee7e5cb7bdd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1890 final evidence CLEAR
Headbbe465c684d89b459a440d41d9657ee7e5cb7bdd; reviewed Git tree558b426ff598985798cc40b599e2c99ca3bbc940.
Reviewrev-20261119-1890-final-3, scope evidence.
Configuredda39687f-7e75-40fc-94a0-109ca4b1120f/A-21891 passed at exact source-cleared head; no cache. Producer snapshot tree289f6ebf418fbc8bdacaf248baf6ab48b8e12a47 is distinct from source Git tree.

Independently streamed structured finishes:7,025 ordinary passes plus15 separate load repetition passes; zero fail/cancel/skip. T0/T1/all fallbackT2/Web exit0; T3 merge-batch deferred,T4 unexecuted. No all-tier/QA/native corpus claim.
test-lint.test.ts41/41 ordinary passes. Each required new generated case passed ordinarily and5/5 under load:
- condition waits report fixed bounds and accept named behaviour deadlines
- condition wait baseline freezes counts and reports growth without refusing old clients
- missing and exhausted advisory maps cannot silently seed or reset allowances

C1: source-reviewed AST/binding positives and negative controls now have same-head execution: inline literal timeoutMs/loadFactor1, aliases, signed/parenthesized forms, nonblank literal behaviour exemption, strings/comments/unrelated/runtime-budget exclusions. Syntax census scope remains inline/static; no runtime option inference claim.
C2: source JSON check froze634sites/89files and kept old enforced category counts/version1 unchanged. Completed policy tests establish planted excess source line, report-only growth, absent/exhausted/empty/deleted/reintroduced maps, explicit empty shrink result and unchanged default refusal path/old-shape compatibility. Local A-21876 reports first89allowance seeds and0refusals; configured green is separate, not a relabelling of that candidate lint invocation. New findings cannot feed admission or lint exit status; no enforcement switch.

Configured provenance:Linuxx64droplet c-8ams3, kernel6.8.0-149-generic, Node24.21.0, Neovim0.12.5, workers2. Actual browser receipt:/home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Producer lifetime1190.541s/cost$0.0826764583(summary1191s/$0.0827), not test wall time. Test-lint765findings149files, duration/ratchet advisories remain report-only, not failures.

Prior not-clear A-21873/initial parser and reset reds remain historical; source-2/A-21880 resolved P1/S1. Selected precommit/local A-21870/A-21876 receipts retain original source/platform/provenance limits, not all-client or immutable invocation proof. No Reviewer tests/probes/browser/file changes/commits/merges; source/recorded facts inspection only.
Standards0/Spec0 findings. VerifyC1,C2.
A-21892: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21892-t-1890-final-clear-parser-and-zero-debt-advisory-ratchet-receipts.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T21:25:56.642Z

Merged b469b98caff90f4b62dabed60567a1b724062c00 onto dev.
