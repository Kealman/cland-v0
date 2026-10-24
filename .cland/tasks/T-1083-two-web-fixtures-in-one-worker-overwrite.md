---
id: T-1083
kind: task
title: Two Web fixtures in one worker overwrite each other's failure trace
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-976
branch: t/T-1083-two-web-fixtures-in-one-worker-overwrite
created: 2026-10-21T19:12:58.162Z
updated: 2026-10-24T12:26:16.063Z
closed: 2026-10-24T12:26:16.063Z
---

## Summary

`web/test/harness.ts` keeps its failure-trace serial inside `webFixture`, so two fixtures in one worker can write the same `${pid}-0.zip`. In impl-1071's red run (T-1071), the copied-tracker case and the 300-item case both reported `web/test-results/51103-0.zip`, and one failure trace overwrote the other.

## Acceptance criteria

- [x] C1. Two failing Web fixtures in one worker leave two distinct trace files, each named in its own failure (test).
  - done: impl-1083 · 2026-10-24T12:00:06.776Z
  - verified: rev-32 [reviewer] · run rev-20261024-1083-final · 2026-10-24T12:15:27.111Z · commit aa3d3e2a77acd5704c941fdc7d86bacda3a3e3bf

## Comments

### impl-1083 · 2026-10-24T11:52:24.271Z

Red on macOS arm64 local executor, targeted Web file at ad611df9 + regression test (duration gate not run): node --test web/test/smoke.test.ts failed with `AssertionError [ERR_ASSERTION]: fixtures in one worker retain different trace files`; both actual and expected were web/test-results/2170-0.zip. Both failure diagnostics named that same ZIP. This reproduces the fixture-local serial collision at the agreed seam. Build passed; browser/hub cleanup census reached zero.

### impl-1083 · 2026-10-24T11:53:03.307Z

Green targeted Web smoke at ad611df95d015191b8b8af11fd7aa81bcd599b6d + implementation/test edits, macOS arm64 local: all 4 node:test assertions passed; failures saved distinct 5693-0.zip and 5693-1.zip, diagnostics matched each path, first ZIP bytes remained identical, both contexts closed and browser process groups reached zero. Top-level test 1.048 s (below Web 4 s budget; direct targeted run has no duration gate). Counter now shared at module/worker scope. Fresh origin/dev fetch + merge reports already up to date. Full check is running before commit/source review.

### rev-23 · 2026-10-24T11:57:23.263Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1083-source
commit: ee6f9fcec48095ebc500e238ef5cb000bf25665b
scope: full
findings: [{"severity":"medium","text":"M1: Add the required path-derived Web smoke guide and index entry documenting the new two-fixture failure-trace regression/lifecycle (docs/agents/tests.md:3).","file":"web/test/smoke.test.ts","line":34}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1083 full source review — not clear

Head ee6f9fcec48095ebc500e238ef5cb000bf25665b/tree96f514b8739afff5eab4fe25f66aede0ab43459b, fixed parent/base ad611df95d015191b8b8af11fd7aa81bcd599b6d. One commit/three files: web harness/smoke/README. Origin task ref matches. Scope full, run rev-20261024-1083-source, both axes in-session under Reviewer subagents=false.

Standards M1 medium: web/test/smoke.test.ts:34 adds/changes the task-specific two-fixture regression but docs/agents/tests/web-test-smoke.test.ts.md and index entry are absent. docs/agents/tests.md:3 places per-test guidance in the path-derived guide. Add exact '# web/test/smoke.test.ts' heading and one index row, documenting Web production edge, the lifecycle reason for a second browser/hub fixture, planted failures, path/ZIP/byte-preservation/context and process cleanup assertions. Keep guard/runtime assertions unchanged.

Otherwise source is sound. traceSerial moves from fixture-local scope to module/worker scope, with synchronous increment in each trace pathname allocation; existing PID prefix separates worker processes. Allocation after asynchronous mkdir still increments atomically in one worker's JS turn. No new dependency, public API, permission, trace-path format or fixture-local tracePaths behavior changes. Trace remains preserved for failure reporting; passing cases still stop tracing without a ZIP and all contexts close in finally. No separate smell finding.

Spec: regression genuinely exercises two webFixture instances in one worker and catches the earlier same-PID/local-zero overwrite. It plants distinguishable failures, asserts each own tracePaths array, distinct names and exact diagnostic messages, ZIP signatures, and byte-for-byte survival of first trace after writing second. Both contexts are closed; second fixture has automatic onCleanup fallback before assertions and explicit close on success, first fixture retains parent cleanup. Existing ownProcess, empty group census, stopped scratch-hub and browser profile/root ownership remain. The extra Headless Shell is justified by C1's multiple-fixture lifecycle seam, not an arbitrary process added to an in-process unit. README accurately describes worker-wide names. No functional Spec finding.

A-10873 is a local macOS arm64 summary: regression-only base red reports same2170-0.zip; implementation green reports distinct5693-0.zip/5693-1.zip, four Node results, top-level1.048s/runner1.350s and check pass/report-only lint133/60/zero refusals. It is not original full call/stdout/exit evidence or configured phase coverage. Requested preservation of original retained tool receipts, no transcription reruns. No source or runtime clearance derives from the summary alone.

C1 test/source intent established but final runtime criterion unverified; M1 required guidance incomplete. Record C1 failed for M1 until corrected source request. No configured verification yet; keep it held until clear exact-head source verdict. QA none/after-stage/no item brief. Reviewer static Git/source/tracker/artifact reads only; no tests/probes/edits/install/Git mutation/browser/delegation. Standards1medium; Spec0findings.
Durable audit A-10880.

Criteria: C1 failed (M1: Changed two-fixture regression lacks required per-test guide/index entry.).

### impl-1083 · 2026-10-24T11:57:50.711Z

Corrected M1 in aa3d3e2a (pushed): added docs/agents/tests/web-test-smoke.test.ts.md with exact heading, Web production-edge and second-fixture lifecycle reason, planted failure/diagnostic/ZIP/byte/context/process assertions; one index row. No runtime guard or assertion changed. Original tool calls/stdout/exits/native timings preserved in A-10881 with macOS arm64/local and working-tree source attribution (not a committed-head runtime receipt). No transcription rerun. git diff --check passed. Per rule 11, no dev merge after first review.

### rev-32 · 2026-10-24T11:59:48.837Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1083-source-2
commit: aa3d3e2a77acd5704c941fdc7d86bacda3a3e3bf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1083 corrected source review — clear

Headaa3d3e2a77acd5704c941fdc7d86bacda3a3e3bf; treed58a21fcc6181448cf616fdbfe7f1154a29bb4de; parentee6f9fcec48095ebc500e238ef5cb000bf25665b. Task/origin refs agree; one corrective docs commit, no dev integration. Scope full for corrected source, carrying rev-23's accepted functional audit rev-20261024-1083-source/A-10880. No overlapping hold. Whitespace check exit0; findings[].

## Standards

M1 fixed: exact '# web/test/smoke.test.ts' heading in the path-derived guide and one canonical test/index row satisfy docs/agents/tests.md:3 and the inspected test-docs guard contract. Guide names Web production edge, isolated Headless Shell, disposable/sealed roots, bundle prerequisite, second-fixture lifecycle reason and retained assertions. It matches the source rather than changing a guard.

The complete correction diff touches only that guide and index. Runtime harness, smoke assertions and README are identical to ee6f9fce. Rechecked module-scoped traceSerial, synchronous per-path increment/PID prefix, per-fixture tracePaths, context finally closure, process-group/reaped-PID/scratch-hub cleanup and the changed test's exact diagnostics/distinct ZIP/first-ZIP-byte preservation assertions. No added process, dependency, policy, authority, weakened assertion or baseline smell.

## Spec

The two-fixture regression preserves C1's requested seam: separate fixtures in one worker, planted distinct errors, exact own diagnostic paths, two distinct ZIP signatures and unchanged first trace bytes after writing the second. Both browser context lists empty; explicit second fixture close plus registered fallback and parent close/exit assertions remain. The new guide describes those exact checks. Source intent established; C1 remains runtime-dependent and is not verified on this source pass.

A-10881 independently inspected: original tool-call/output transcriptions with exits and native timings, not reruns or fabricated committed-tree receipts. Darwinarm64 local: red at basead611df9+regression reports both2170-0.zip and actual/expected same path; green uncommitted implementation reports5693-0.zip/5693-1.zip,4/4 Node results, top-level1.048216s/Node1.349878s. Check exit0 on implementation/test/README working tree predates final docs corrections; lint report-only133findings60files/zero refusals. Tree hashes and whole-check wall were not captured and are not inferred from per-tool wait intervals. No configured/Linux/full-suite pass claimed.

Proceed with normal mode-free cland verify at unchangedaa3d3e2a, Reviewer/item-lead routing, then final exact-head Web evidence audit. task.view still has C1 unchecked after the prior not-clear verdict; claimant must restore its done mark when appropriate. No per-item QA brief (scope none/after-stage). Any changed head needs fresh source review.

Both axes completed personally through read-only Git/source/docs/artifact inspection; no tests, browsers, probes, edits or delegation. Standards0 findings; Spec0 findings.

Durable audit A-10892.

### impl-1083 · 2026-10-24T12:14:02.588Z

Mode-free verify c24e1f90 at aa3d3e2a77acd5704c941fdc7d86bacda3a3e3bf exit 0; raw A-10924. T0 host gate + all T1 + fallback all T2 + Web completed, 2945 pass / 0 fail. Runtime Linux x64 droplet c-8 lon1, lifetime 698 s/cost $0.0485; duration budgets and test lint report-only with unrelated overruns. T3 deferred to periodic dev/integrated occasions; no changed T3/T4 files. Two-fixture Web receipt: 45094-0.zip and 45094-1.zip, case 1.745611431 s; top-level 3.765620076 s under 4 s. Fresh dev conflict check: fetched origin/dev 512c4960bb573e8df6e215de8bceb509af8e7d6a, git merge-tree exit 0 / tree e55e2ed696cad66a965a5b7f03621e9549e7ddec. Head unchanged and clean. Same-head evidence review requested, assigned Reviewer; completion waits for ready. Coordinator owns merge enqueue.

### rev-32 · 2026-10-24T12:15:27.111Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1083-final
commit: aa3d3e2a77acd5704c941fdc7d86bacda3a3e3bf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1083 final same-head evidence review — clear

Headaa3d3e2a77acd5704c941fdc7d86bacda3a3e3bf; treed58a21fcc6181448cf616fdbfe7f1154a29bb4de. Task/origin refs and task.view match A-10924. Source2 rev-20261024-1083-source-2/A-10892 carries forward unchanged, including rev-23's accepted functional audit. Scope evidence, findings[]; C1 verified.

## Standards

Configured mode-free c24e1f90-1bde-4699-8d4d-7ec55b5eb383 finishes exit0; original finish records2945 ordinary test passes/423 passing file completions, zero failures/cancellations/skips, no load-gate finish records. Actual phases: hostT0 npm check28.315s; allT1; fallback allT2 hub+Neovim; Web. T3/T4 not run. Modefull is task selection fallback, not a full stage/soak cover.

Linuxx64 6.8.0-142-generic c-8lon1 cland-v0-0267fbb6, Node24.21/Nvim0.12.5, workers2/Web4, lifetime698s/$0.0485. Host gate marker bbb87fcc7f5c1da09173c2736c3a734db6e441c1 reused, not repeated remotely. Command envelopes66/366/161s differ from suite walls60.98/361.50/156.49s. Web's final150.266s@2worker projection is not actual156.49s@4worker wall.

Generic lint/budgets remain report-only:133findings60files, zero static refusals. Existing items49.31s/shell10.95s/connection6.604s/inbox41.25s/scale2.972s/render2.233s warnings and Web wall>40s remain. T3 ratchet2195.304s unchanged. No clean enforcing-budget or T3 pass claim. New regression1.745611s; top-level parent3.765620s stays below4s trigger, so no allowance edit required. File completion5.245456s is a different measure.

## Spec

C1 verified by original Web smoke records: all four Node results pass, including two failing fixtures retain distinct traces named in their diagnostics1.745611431s (nested) and its parent3.765620076s. The source-cleared test actually checks separate fixtures, exact own diagnostic paths, different filenames, both ZIP signatures and unchanged bytes of the first after the second, plus context/fixture cleanup. Its deliberately caught failures are not suite failures. Module-wide serial/PID prefix and preserved cleanup/assertions remain unchanged.

A-10881 local Darwinarm64 precommit red/green/check receipts remain supplemental with missing exact dirty hashes and unavailable whole-check wall labelled; they do not substitute for this configured Linux result. QA none/after-stage, no QA/stage/full-suite/publication claim. Normal ready/queue policy applies.

Reviewer used read-only Git/source/tracker/log/artifact audit, no browser, tests, probes, edits or delegation. Standards0 findings; Spec0 findings.

Durable audit A-10935.

Criteria: C1 verified.

### impl-1083 · 2026-10-24T12:16:14.797Z

Completion boundary reached: hub task.view reports ready after final evidence verdict rev-20261024-1083-final / A-10935 at unchanged aa3d3e2a. Fresh post-verdict conflict check: git fetch --no-auto-maintenance origin dev; origin/dev remains 512c4960bb573e8df6e215de8bceb509af8e7d6a. git merge-tree --write-tree aa3d3e2a 512c4960 exits 0 with tree e55e2ed696cad66a965a5b7f03621e9549e7ddec. Worktree clean. No branch mutation since source review; claim retained for Coordinator merge enqueue.

### coord · 2026-10-24T12:26:16.063Z

Merged 4b617576635e60110aea55df67f310c8abb780c1 onto dev.
