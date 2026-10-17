---
id: T-741
kind: task
title: "Eight T2-tagged tests that start git, jq or a check runner: move them to injected readers or retag T3"
state: open
status: review
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by:
  - T-735
  - T-719
topic: topic-452
branch: t/T-741-eight-t2-tagged-tests-that-start-git-jq
created: 2026-10-17T15:18:07.293Z
updated: 2026-10-17T16:51:43.578Z
---

## Summary

T-735's census (A-4576) shows eight files tagged T2 that start a non-cland child process, so they qualify only for T3: lead-permissions (git/nativeExec), release-item (git), skills-tracker (jq), suite-check (npm check/typecheck runner), suite-dry-run (git), suite-queue-policy (git), territory-cli (git) and verify-all (git). Once T-684 makes the lint refuse, each would block. T-719 adds projectHub's injected Git and process-table answers.

## What to build

For each file, either replace the child with T-719's injected reader or an in-process equivalent (keeping every assertion, with one retained T3 process proof only where the child itself is the behaviour), or retag it T3 with a `// T3: <behaviour>` header. The lint then reports no T2 file below its qualifying tier.

## Acceptance criteria

- [x] C1. All eight files are T2 with no non-cland child process, or T3 with a lifecycle header, and `npm run test:lint` reports none of them below its qualifying tier.
  - done: impl-741 · 2026-10-17T16:43:05.882Z
  - verified: rev-30 [reviewer] · run rev-20261017-741-source · 2026-10-17T16:51:43.578Z · commit 578ed3439e99f00432ac7b5b985a939bc1a6b44d
- [ ] C2. An audit maps every moved assertion, and each touched file passes 5/5 on the Mac and once in the task's droplet verify.

## Comments

### impl-741 · 2026-10-17T16:36:41.125Z

Inspecting the eight subprocess files and T-719 probe seams. Will record assertion audit and before/after Mac 5-run medians, retain native process proofs where required, and retag the sorted manifest.

### impl-741 · 2026-10-17T16:48:57.846Z

Implemented at 578ed3439e99f00432ac7b5b985a939bc1a6b44d and pushed to origin after fetch/merge origin/dev (up to date). Audit A-4632 maps 46 declarations and retains all 462 original assertion call sites including helpers; raw Mac receipts/checker/lint/census are A-4633. All ten destination test files passed 5/5 serially, no skips, load <15. Sum of file test-time medians 59.407s -> 47.930s including split coverage. Typecheck, test:tiers and test:lint pass; no scoped file below qualifying tier. T2 census: Lead component 0 children, queue policy 0, tracker only its intended CLI. C1 done; C2's Mac/audit evidence is complete, droplet evidence follows clear source review.

### rev-30 · 2026-10-17T16:51:43.578Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-741-source
commit: 578ed3439e99f00432ac7b5b985a939bc1a6b44d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-741 source review — clear

Head578ed3439e99f00432ac7b5b985a939bc1a6b44d, fixed point0ffa17c33df21a4bcb2f0d3830e2c1a220ce01c7. One commit,13 changed files; branch tip independently confirmed. No production change. Read-only review; no Reviewer tests/compiler/census execution.

## Standards
No findings. Six original native files now have explicit T3 behavior headers and matching sorted manifest entries: lead-permissions native worktree/merge races; release-item Git publication/ref/hook/retry contracts; suite-check npm completion/cancellation and writer reaping; suite-dry-run real CLI/native candidate; territory-cli native refs/hooks/pushes; verify-all real Git deciding-path/admission. Their native behavior is retained, not hidden behind T2 labels.

Four Lead rule declarations move to T2 with production adapters/frames, FakeClock, fake projectHub probes and in-process peers. TaskWorktrees' separate execFile reader is replaced with an exact-command no-territory predicate; unexpected commands fail instead of forwarding to a native child. The Codex authorization proof still drives the production adapter at held version/thread-start boundaries, while mocked app-server edges preserve rollback/no turn/client closure assertions. Existing lead-permissions-process remains the native child proof.

heldOperations is extracted byte-identically (apart from export) and registers resource-phase release/join before fixture setup. The controlled early-assertion case now supplies the real mock context to its captured-hook fixture; assertions still prove settlement while root/peer remain usable, followed by root removal. Native retained barriers continue using that ownership helper.

skills-tracker's documented jq program and complete frontier scenario move intact to T3; the T2 parser/tracker rules use fake startup probes. One intended task CLI remains because real stdin bytes are the subject. Its ChildProcess cleanup kills only a still-live owned handle and awaits close before fixture-root cleanup, avoiding the unrelated process-table probe. The exact UTF-8/exit assertions remain.

Queue policy uses the pre-existing SuiteCandidate interface for clean head/tree/selection, retaining production candidate config validation independently. Executor delivery, worker overrides, admission-time config reload, logs and invalid candidate assertions remain. No production seam was added.

## Spec
C1 verified: all eight original files and both destination files are at qualifying tiers; supplied lint agrees for every scoped path. The three remaining T2 destination files have supplied census receipts: Lead component0children, queue policy0, skills-tracker one intended CLI and0non-cland children. Source tracing supports those boundaries. Native Git/npm/jq contracts remain T3.

C2 audit/source portion supported. Reviewed all change hunks and supplied AST audit/checker.46 unique original declarations map to exactly46 destinations;452 declaration assertion sites and462 including helpers are retained. Independent read-only expression/multiplicity comparison also finds462old/465new, no missing original expression and3additional fake-command guards. The extraction preserves exact jq program execution and frontier transitions, held-operation invariants, native worktree/merge races, publication/hooks/refs, npm reaping, and dry-run/verify-all deciding-path assertions. Assertion text alone was not treated as semantic proof: fixture substitutions and retained boundaries were inspected separately.

## Supplied Mac evidence
A-4632/A-4633 contain all eight originals5/5 and all ten destination files5/5. Independent raw receipt/timing audit selects90whole-file logs with460passes,0fail/cancelled/skipped. The initial overlapping release baseline set is excluded and replaced by before-serial5/5; the initial component debug TypeError is retained, explained by the missing fixture mock context and corrected in the reviewed source, not counted as green evidence.

Summed per-file top-level test-time medians59.406702580s→47.929752168s. Separate subprocess-wall median sums62.488213625s→51.503426458s. All split coverage is included; no promised causal speed ratio. Maximum sampled1mload9.099609375. Supplied typecheck/tier/report-only lint green; all ten scoped lint lines have declared tier equal to qualifying tier. No duration manifest/baseline/allowance changes.

Full source clear; findings[]; verify C1 at this exact head. C2 remains unverified until exact-head normal mode-free droplet evidence includes the touched coverage and claimant done mark. Any standing Coordinator submission hold still applies. No per-item QA (none/after-stage).

Standards0findings; Spec0findings.

Durable review: A-4635.

Criteria: C1 verified.
