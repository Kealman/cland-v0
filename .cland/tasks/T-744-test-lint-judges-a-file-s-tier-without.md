---
id: T-744
kind: task
title: Test lint judges a file's tier without following its fixture and helper imports
state: open
status: ready
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: topic-454
branch: t/T-744-test-lint-judges-a-file-s-tier-without
created: 2026-10-17T16:06:54.285Z
updated: 2026-10-17T17:56:30.916Z
---

## Summary

T-690's review (2026-10-17, review message ce02a5ed) found test files the lint qualifies as T1 or T2 whose imported fixtures use forbidden resources. Native fixtures open projectHub and socket peers, remote-fixture runs git and a socket hub, and suite fixtures spawn spokes and candidate workers. The lint reads only the test file itself, so its "qualifies" tier is lower than what the test really does. Once T-684 refuses on the lint, it would accept such files at the wrong tier.

## What to build

The lint resolves a test file's local imports (hub/test helpers and fixtures, transitively, within the repo) and charges the file with every resource used along the import graph, including in-process seams marked as allowed. Cache per module so a run stays fast.

## Acceptance criteria

- [x] C1. Planted T1 tests importing a projectHub helper and a child-spawning helper each get a reachable-resource diagnostic naming the import path, a pure helper adds none, and the direct qualifies result and findings used by admission are unchanged, proved by lint tests.
  - done: impl-744 · 2026-10-17T17:51:18.052Z
  - verified: rev-30 [reviewer] · run rev-20261017-744-source-correction · 2026-10-17T17:55:58.861Z · commit ef549ee569621999de02b0d2adab84b55f5f8303
- [x] C2. The review request lists every dev file whose reachable tier differs from its direct qualification, names the harness-initialization-only subset separately, and shows npm run test:lint under 10 s on the Mac.
  - done: impl-744 · 2026-10-17T17:46:05.425Z
  - verified: rev-30 [reviewer] · run rev-20261017-744-source-correction · 2026-10-17T17:55:58.861Z · commit ef549ee569621999de02b0d2adab84b55f5f8303

## Comments

### impl-744 · 2026-10-17T17:15:17.134Z

Merged origin/dev f0036591 before implementation. Read T-690 M1–M3. C1 is tested at the public lintTests seam using planted repo files (T1, filesystem only); resource source text is never executed. Whole-module graph analysis will conservatively charge every imported module resource, including unused helper exports; inert strings/comments and declaration-only type imports remain negative cases.

### impl-744 · 2026-10-17T17:34:26.496Z

Scope supersedes the initial whole-module note: Coordinator decisions 383d1b85, 29ff668c and 4725ee1c require named-export reachability, genuine import-time work, and a separate diagnostics-only reachable report. Direct qualifies and admission findings remain exactly T-743 (314/314 dev comparisons). Base origin/dev41fa3742 merged. Graph reports91 diagnostic differences, with zero existing-file ceilings solely from harness initialization; T-747/T-748 own harness cleanup/runtime enforcement. Mac final lint5.87s; typecheck/test:tiers pass. Full 5/5 serial refresh is running at load below15. No per-item QA (scope none/after-stage).

### impl-744 · 2026-10-17T17:46:16.425Z

Review requested via role reviewer at pushed head d49003393b4f07bc1af8159ceeed41a0eccf7a8c; routed to the Reviewer. Final evidence A-4671 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4671-t-744-final-review-evidence-at-d4900339-census-checks-and-serial-5-5-logs): typecheck/test:tiers pass; final Mac test:lint7.24s; 24 lint tests; test-lint/suite-tiers/suite-runner5/5 serially after last source change, peak one-second sampled load5.581<15. Direct-source314/314 unchanged;91 reachable-only differences listed in full in request/census; harness-init-only subset zero. C1/C2 marked done. Await clear source verdict before exact-head droplet verify, per protocol; no per-item QA required.

### rev-30 · 2026-10-17T17:48:08.113Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-744-source
commit: d49003393b4f07bc1af8159ceeed41a0eccf7a8c
scope: full
findings: [{"severity":"medium","text":"M1: select('$init') unconditionally follows dynamic import/require initialization edges collected at154, including calls inside uncalled held functions and excluded CLI guards. Pure-helper imports therefore gain resources from modules that never load. Implementer reproduced the false positive and is preparing a correction/new head.","file":"hub/src/test-lint.ts","line":419}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-744 full source review — not clear

Reviewed d49003393b4f07bc1af8159ceeed41a0eccf7a8c against incoming dev41fa374226b8ce67644eb1af2fa52d7916679e4c. Two task commits, four files; read-only source/receipt review, no Reviewer execution or delegation.

## Standards
No separate standards findings. New tests plant source files without executing their resource text; filesystem fixtures are T1 and have no live writer cleanup boundary. Documentation separates diagnostic reachability from direct admission, and describes caching, fallbacks and lack of branch/injection/method-override evaluation. Source adds no retags or gate enforcement.

## Spec — medium M1
hub/src/test-lint.ts:419 (originating at:154): dynamic import()/require() edges are put in the same global imports list as hoisted static imports. select('$init') then unconditionally adds every $init edge, even if the corresponding dynamic call lies inside an uncalled function or an excluded CLI guard. Thus importing pure() from a helper that also holds `const held = () => import('./native.ts')` charges native.ts's top-level resources despite that module never loading. The corresponding require form has the same defect.

This contradicts primary29ff668c's instruction that function values only referenced, never called, are not executed, and the implementation's own import-time/CLI exclusions. Diagnostic-only scope avoids an admission regression but does not make the resource report correct. C1 fails for this pure-helper negative.

Implementer decision036aca6b independently confirms a focused red pure-import→T3/expectedT1, then reports a working fix removing global dynamic-edge insertion and positive/negative regressions for both import and require. That correction is not part of reviewed d4900339. Await committed/pushed replacement head plus refreshed evidence; no verification cleared at this head.

## Remaining source analysis
Primary Coordinator decisions383d1b85,29ff668c,4725ee1c and76d04cad were read directly. Named export/local value dependency analysis with per-module/export/resolution caches, real module initialization and registered callbacks, explicit namespace/star fallback, and unchanged direct qualification are the authorized scope. Branch/DI/method override evaluation and runtime enforcement are excluded; T-747/T-748 are separately owned.

Reviewed local resolution including extension/index candidates, canonical repo confinement/symlink escape, data/type exclusions, cached module loads and cycle-safe per-test graph traversal. No other high/medium finding in this pass. CLI uses detailed paths; default report gives resource kinds and one highest-tier path. Direct-source resource/policy logic remains separated from the added reachable result. Supplied comparison reports314/314 direct qualifies and findings arrays equal T-743; no admission-policy change is intended or found in the reviewed diff.

## Supplied evidence and limits
A-4671 raw15 serial whole-file logs independently checked: lint24, tier8 and runner43 tests per invocation, five each,375 passes total; zero failure/cancellation/skips. serial.json names exact head and maximum sampled load5.58056640625. Lint0.323–0.326s, tiers0.518–0.529s, runner66.275–67.418s subprocess wall; no skipped fixture branch is counted green. Static typecheck/tiers supplied green.

Final Mac test:lint7.24s real is supplied in checks.md (<10s); no Reviewer timing run. Full lint has314 direct and314 reachable summaries. Supplied in-process Suites.start dry-run JSON independently encodes205726bytes and314 reachable summaries, below1MiB; no candidate/worker execution is claimed.

Census includes every91 differing dev files with representative resource path:7T1→T2,28T1→T3,56T2→T3; direct counts57/58/199, reachable22/9/283. Harness-init-only existing subset explicitly zero; removing only the two preload imports changes no existing final tier, while a synthetic pure-harness input exposesT3→T1. Those controlled comparison results are supplied, not rerun here. Graph limitations are disclosed; census/report must be refreshed after M1 correction, even if final tier counts remain unchanged.

Not clear; one medium Spec finding, no separate Standards findings. FailC1. No criterion verification recorded on this not-clear pass. Exact-head droplet execution remains pending corrected-head source clearance; no per-item QA.
Durable review A-4676.

Criteria: C1 failed (Pure-helper reachability includes native module initialization from uncalled dynamic import/require; separate hoisted static initialization from reached dynamic calls and re-review the committed correction.).

### impl-744 · 2026-10-17T17:55:08.715Z

M1 correction committed/pushed as ef549ee569621999de02b0d2adab84b55f5f8303, no dev merge. Red→green regression proves uncalled/CLI-guard dynamic import and require do not initialize native modules; called/top-level positives still report resources. Corrected evidence A-4683 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4683-t-744-m1-correction-at-ef549ee5-refreshed-census-and-serial-5-5-evidence):25 lint tests, typecheck/tiers pass, Mac lint6.79s, allthree files5/5 serially at this head (380 passes,0 failure/cancellation/skip, maxload5.562),314 direct results unchanged, refreshed91-difference census with zero harness-init-only subset, dry-run314 lines/205726bytes. C1 re-marked done; C2 remains done. Replacement source review requested via Reviewer role; verification held for clear verdict.

### rev-30 · 2026-10-17T17:55:58.861Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-744-source-correction
commit: ef549ee569621999de02b0d2adab84b55f5f8303
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-744 source correction — clear

Exact head ef549ee569621999de02b0d2adab84b55f5f8303, direct child of reviewed d4900339. Fixed base remains incoming dev41fa374226b8ce67644eb1af2fa52d7916679e4c; no dev merge after source review. Scope delta, read-only review with no Reviewer execution or delegation.

## Standards
No findings. Production delta is one logical line: dynamic/require call edges remain solely in runtimeCalls instead of being inserted into the hoisted static imports array. Added focused test uses planted source/temporary files only, without executing child/socket resource text; T1 boundary unchanged. No admission, manifest, gate, branch-evaluation or unrelated source changes.

## Spec
M1/A-4676 resolved. select('$init') now takes only static import/re-export initialization globally; dynamic edges come from walking their reached call node. Held function bodies and excluded process.argv/fileURLToPath CLI branches remain unexecuted in initialization slices. A selected called function/top-level dynamic call still yields its dependency initialization and resources. Both import() and require() have eight planted caller cases covering the two negatives/two positives, resource path presence/absence, and unchanged directT1/empty findings.

Prior full source analysis A-4676 applies to unchanged graph resolution, per-module/export caches, named/local/re-export dependencies, static/registered initialization, namespace/star fallbacks, type/data/external/repo-boundary exclusions, and cycle handling. Primary383d1b85/29ff668c/4725ee1c/76d04cad scope remains diagnostic-only: no branch, DI or method-override evaluation and no reachable-tier admission enforcement. Direct-source result/policy logic is unchanged by this correction. Supplied full314-file comparison again reports identical direct qualifies and findings arrays versus T-743.

C1 verified from source plus corrected targeted proof. C2 verified from corrected complete census and supplied Mac timing: all91 differing dev paths are listed in request/A-4683, with representative reasons;7T1→T2,28T1→T3,56T2→T3 independently counted from differences.json. Direct57/58/199 and reachable22/9/283; paths refreshed although ceilings unchanged. Harness-initialization-only existing subset explicitly0 after controlled removal of just the two preload imports; supplied comparison not rerun by Reviewer. Synthetic initialization effect and T-747/T-748 ownership remain disclosed.

## Corrected evidence
A-4683 raw15 logs independently parsed: lint25×5, tiers8×5, runner43×5=380passes,zero failure/cancellation/skips. serial.json binds all15 to ef549ee5 and max sampled load5.56201171875. Reported process wall ranges lint0.328–0.417s, tiers0.696–0.887s, runner63.518–69.427s. Static typecheck/tiers supplied green. Final Mac test:lint6.79s real under10s is supplied; no Reviewer timing run.

Dry-run integration JSON independently has314 reachable summaries and compact encoded size205726bytes<1048576, with no candidate/worker execution claimed. CLI keeps detailed paths while dry run keeps kinds/highest-tier representative; report bounds do not rely on dropping file summaries. Earlier A-4671 source/diagnostic context remains historical, not substituted for these corrected raw runs.

Standards0/Spec0 remaining findings. Source clear; verify C1/C2. This is a source verdict, not a passing task-verification receipt. Implementer may submit normal mode-free exact-head droplet verification and await final same-head evidence review. No per-item QA.
Durable review A-4685.

Criteria: C1 verified, C2 verified.

### impl-744 · 2026-10-17T17:56:30.916Z

Source correction clear (A-4685, rev-20261017-744-source-correction) at ef549ee569621999de02b0d2adab84b55f5f8303; C1/C2 verified. Submitted exact-head mode-free droplet verify8758bf4f-f4ca-44d6-a28a-df6280fe7f12, topic-454, to impl-744/coord, queue position1. Clean tree confirmed; no new dev merge or source changes. Going idle until hub result; final same-head evidence verdict remains pending.
