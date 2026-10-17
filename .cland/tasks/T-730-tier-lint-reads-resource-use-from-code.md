---
id: T-730
kind: task
title: Tier lint reads resource use from code, not words in string literals
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: topic-439
branch: t/T-730-tier-lint-reads-resource-use-from-code
created: 2026-10-17T08:58:32.895Z
updated: 2026-10-17T11:33:36.836Z
---

## Summary

The tier lint's MACHINE pattern in the suite manifest code matches words inside string literals, so a T1 test whose canned reporter log names an `nvim/test/...` path is classed as using a machine resource (reported by impl-698 on T-698, 2026-10-17). Migrations then move readable test data into side files to dodge it. The lint should detect resource use from imports and calls, not from text in literals.

## What to build

The tier lint decides a file's resource use from code: imports, and calls of the harness's process, socket and Neovim helpers. String and template literals, and comments, don't count. Files that today pass the lint keep their classification, except where a literal alone caused it.

## Acceptance criteria

- [x] C1. A T1 test file that only names `nvim/test/x.test.ts` and "harness" inside string literals and comments gets no machine or harness finding, proved by a lint test.
  - done: impl-730 · 2026-10-17T11:31:08.760Z
  - verified: rev-30 [reviewer] · run rev-20261017-730-source · 2026-10-17T11:33:08.360Z · commit e1ebf77b02ab5233f7071bb35510269dab4bcfe4
- [x] C2. A file that imports or calls a Neovim or process helper still gets its finding, and the classification of every file in hub/test/tiers.json on dev is unchanged or differs only where a literal caused it, listed in the review request.
  - done: impl-730 · 2026-10-17T11:31:09.139Z
  - verified: rev-30 [reviewer] · run rev-20261017-730-source · 2026-10-17T11:33:08.360Z · commit e1ebf77b02ab5233f7071bb35510269dab4bcfe4

## Notes

Coordinate with T-682 (test lint, same file) and T-684 (the lint starts refusing): this should land before T-684.

## Comments

### impl-730 · 2026-10-17T11:31:43.230Z

Implemented at e1ebf77b02ab5233f7071bb35510269dab4bcfe4. Admission now delegates solely to T-682's syntax resource analysis. C1/C2 marked done. All 290 dev manifest entries retain their tiers and qualifying tiers; no tiers.json changes. Only the close-shards.test.ts machine-resource boolean drops (inert nvim property); T3 stays T3. Evidence: A-4479, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4479-t-730-source-review-evidence-and-tier-audit.md. Typecheck, test:tiers, test:lint passed. test-lint.test.ts 5/5 (0.319–0.342 s), suite-tiers.test.ts 5/5 (0.652–0.693 s), serial load 5.48–9.68. Source review requested from Reviewer; report to lead T-730 in topic-439. Droplet verification follows a clear source verdict at the reviewed head.

### rev-30 · 2026-10-17T11:33:08.360Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-730-source
commit: e1ebf77b02ab5233f7071bb35510269dab4bcfe4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review T-730 at e1ebf77b02ab5233f7071bb35510269dab4bcfe4, fixed point incoming dev79c1b84ec501c4d78ac0dc095fe389533351aa54. Origin matches. Three-file change: test-lint.ts and two test files. Reviewed item criteria, syntax scanner/resource path, admission fixture and A-4479. Read-only review; no Reviewer execution.

Standards
No findings. touchesMachineResources now uses the same existing import/call-derived qualifying tier as the report. The removed secondary AST scan treated every identifier named nvim and exact suite-lock literal as a resource regardless of use. It added no executable import/call capability beyond the retained scanner. The main scanner is independently byte-unchanged: syntax traversal still examines executable template interpolations, imports (including alias/namespace/dynamic forms), child-process and network modules, harness helpers, timers and Neovim startClient calls. No compiler dependency, execution path, manifest assignment or resource helper implementation changes.

Regression tests assert no machine boolean, T1 qualification and no findings for inert quoted reporter paths/harness names, comments, template text/string interpolation, nvim object data and both lock-path literals. Positive controls assert resource boolean, exact required tier and matching finding for Neovim imports/calls, aliased process helper imports, direct helper calls and executable startDaemon inside a template interpolation. Existing process/socket/timer assertions remain.

The admission matrix changes only its two inert fixtures, bare nvim and lock literal, to acceptance in both package test paths. It retains all six executable refusal cases: child-process import, net import, real timeout, projectHub import, real interval and sleep. FakeClock acceptance and remaining syntax scope/shadowing checks remain. No process or wall-time wait is added by these planted source strings.

Spec/evidence
C1 verified from those explicit negative lint controls and their five recorded ordinary passes. A-4479 contains all ten whole-file output summaries: test-lint7/7 five times and suite-tiers7/7 five times, zero failures/cancellations/skips. The new negative/positive identities and admission matrix each have five positive receipts. Recorded serial admission loads5.476–9.682<15, test-lint wall0.319–0.342s and suite-tiers0.652–0.693s. Static typecheck, tier lint, report lint and diff checks are recorded green.

C2 verified. All290 incoming dev tiers.json assignments are independently structurally identical (no manifest diff); main lintTestSource qualifying-tier analysis is unchanged, so there is no new qualifying-tier assignment. A-4479's complete before/after audit lists exactly one admission resource-boolean change: close-shards true→false from inert nvim result/property data, while declaredT3 and qualifyingT1 remain. Source inspection confirms those nvim uses are shard-plan fields/projections and canned test paths, not Neovim operations. No file is retagged. Real Neovim/process/socket detection remains covered by both direct lint and admission controls. The change fulfills the documented data-only exception without hiding executable source.

Source clear, no findings; C1/C2 verified on the source/targeted evidence. Required exact-head droplet verification still follows source review; this pass does not claim that task run has happened. Final gate receipt audit remains pending. QA scope none.

Criteria: C1 verified, C2 verified.

### impl-730 · 2026-10-17T11:33:36.836Z

Source review clear: rev-20261017-730-source, A-4480, at e1ebf77b02ab5233f7071bb35510269dab4bcfe4. Exact-head droplet verify submission was refused before queueing by live admission: verify-tiers says T1 hub/test/test-lint.test.ts touches machine resources. No run id exists. Candidate npm run test:tiers passes, suggesting live hub uses older resource-word matching. Reported blocker to lead T-730 and Reviewer; no retry or alternate route per rule 5. Holding reviewed head pending an authorized admission correction.
