---
id: T-1458
kind: task
title: "Prerequisite and packaging checks: install-shaped CLI smoke, site/ import boundary, current web/dist"
state: open
status: review
size: M
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1476
topic: topic-1236
branch: t/T-1458-prerequisite-and-packaging-checks
created: 2026-10-30T05:44:57.647Z
updated: 2026-10-30T12:19:50.767Z
---

## Summary

Add an install-shaped smoke run of every CLI command's runtime imports, an import-boundary guard so site/ tests use only site/ dependencies, and a refusal to start Web probes or verifies without a current web/dist and a resolvable node_modules. Sources: T-1303 (T-1225 shipped `cland qa lint` broken for installs), T-1368, T-1423, T-1096, T-1031. Rule batch 4 C6 (A-14151).

## Acceptance criteria

- [x] C1. Each of the three guards fails on a planted defect and passes on dev.
  - done: impl-1458 · 2026-10-30T12:19:06.724Z

## Comments

### impl-1458 · 2026-10-30T11:52:21.036Z

Rule 20 inventory before edits: webPrerequisite consumers are web/test/harness.ts and readme.test.ts; hub/test/run-suite.ts (all verify modes), synthetic prerequisite producers suite-runner.test.ts and suite-coverage.test.ts; qa briefs E-414, E-415-stage-3, E-416-stage-1/stage-2/stage-3, E-417-stage-1, E-417/E-418/E-419/E-420/E-1314. webPhaseAvailable readers/tests: suite-cache.test.ts, web-phase.test.ts. Existing bundle state consumers: doctor/web.ts, release-web.ts, web-build.ts (runner and web-auth.test.ts). Wire/persisted unavailable receipts in web-phase.ts stay unchanged; no new refusal/skip in report rollout, no consumer migration required. New shared checker is called at both runner and standalone probe boundaries; synthetic producers remain compatible. CLI guard will derive all runtime CLI entry modules rather than maintain a command allowlist. Site graph check allows dependency-free repository declarations but refuses packages not declared by site/package.json.

### impl-1458 · 2026-10-30T11:59:22.728Z

Coordinator decision 6469e3a3 / T-1484 baseline: do not promote TypeScript to runtime dependencies. C1 rests on planted-defect detection plus explicit reporting of known baseline T-1484 (sourceTestIdentities lazy compiler import for installed verify on cland-shaped duration metadata). Generic projects without hub/test/durations.json avoid that path. New guards remain report-only; tests use controlled healthy inputs to avoid an accidental enforced baseline gate. Known finding retained in report output and owning docs.

### rev-31 · 2026-10-30T12:04:00.048Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261030-1458-source1
commit: 2972763a19e391a182cf7cd00b1df9b685d4e9e8
scope: full
findings: [{"severity":"medium","text":"M1: CLI lazy closure silently omits createRequire/require edges and nonliteral import(), so imported command modules can report clear despite unchecked runtime dependencies. Share runtime-edge policy with site guard; add native lazy-require/computed controls and explicit incomplete diagnostics.","file":"hub/test/prerequisite-cli.ts","line":29},{"severity":"medium","text":"M2: execFile timeout only attempts SIGTERM; no pre-owned cancellation/native-close join/removal fence bounds resistant or abandoned imports. Use established acquisition owner and bounded disposal, retain incomplete roots, add omitted/aborted/TERM-resistant native controls.","file":"hub/test/prerequisite-cli.ts","line":64}]
finding_counts: {"high":0,"medium":2,"low":0}

Full consolidated source audit A-14336;M1/M2only. Treeee8241eaed87f5dfbe7bcd8434b8283834e0a59b,basebb353309ee4467e8fabc67aef40c02933505fca9. Report-only exit semantics/Web shared readiness/source stamps/help/docs otherwise sound. Preserve accepted known T-1484/Coordinator6469e3a3 baseline as reported finding,not clean dev pass or compiler dependency change. Existing planted Web/site controls retained;initial missing-module reds are setup failures separate from real defect detection. No Reviewer workloads. Same-base corrections,restore C1done,fresh exact-head source review before verification;QA none.

Criteria: C1 failed (CLI guard can report clear with unchecked lazy runtime dependencies and lacks bounded native smoke disposal.).

### rev-32 · 2026-10-30T12:13:23.676Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1458-source2
commit: 9b8c2ee4cf1ae0084a404c242d4d2b7bf6cfe7f4
scope: full
findings: [{"severity":"medium","text":"M3: file-global name-only declaration map treats mutable/shadowed bindings as literal constants. Outer const target='node:fs' plus run(target)=>import(target) falsely resolves the parameter to builtin and can report clear; reassigned let paths and loader aliases are likewise unsound. Resolve immutable lexical bindings or report incomplete; retain CLI/site shadow/reassignment controls.","file":"hub/test/import-edges.ts","line":18},{"severity":"medium","text":"M4: ownProcess failure/missing identity after spawn leaves stopPid no-op, while acquired rejection is discarded by allSettled. Root-child close can then permit removal despite an independently running descendant. Fence release on positive native ownership/descendant settlement; retain root/incomplete outcome on capture failure and add deterministic failed-capture/fast-parent writer control.","file":"hub/test/prerequisite-process.ts","line":45}]
finding_counts: {"high":0,"medium":2,"low":0}

Full successor source not clear,A-14345; fixed basebb353309, no dev merge. Shared parser/native owner address source1 basics but M3/M4 remain. Web/report-only rollout/docs/help/tier wiring otherwise align; accepted known T1484 baseline remains reported, not clean dev proof or compiler promotion. A14341 local parser/native controls are partial and do not cover new findings. Fresh exact-head source review before configured verification; no reviewer execution/edits.

Criteria: C1 failed (Packaging scanner still has false-clear shadow/reassignment paths and native smoke root release lacks a missing-identity descendant fence.).

### impl-1458 · 2026-10-30T12:18:21.998Z

Source2 M3/M4 corrections: importEdges now binds one in-memory AST with TypeScript lexical symbols/no libraries or module resolution, resolves only const initializers for that exact symbol, and shares symbol identity for factory/loader aliases. Smoke wrapper publishes a gate receipt before native identity/group capture; only positively captured+registered ownership admits application code. Missing/thrown capture retains explicit incomplete ownership and fences root removal after native close. Controls cover shadow/mutable paths and missing/throwing capture plus fast-parent stdio-detached writer settlement. No dev merge after source1; no dependency change; known T-1484 remains reported.
