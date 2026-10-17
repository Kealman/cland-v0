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
updated: 2026-10-17T15:12:48.479Z
---

## Summary

The tier lint's MACHINE pattern in the suite manifest code matches words inside string literals, so a T1 test whose canned reporter log names an `nvim/test/...` path is classed as using a machine resource (reported by impl-698 on T-698, 2026-10-17). Migrations then move readable test data into side files to dodge it. The lint should detect resource use from imports and calls, not from text in literals.

## What to build

The tier lint decides a file's resource use from code: imports, and calls of the harness's process, socket and Neovim helpers. String and template literals, and comments, don't count. Files that today pass the lint keep their classification, except where a literal alone caused it.

## Acceptance criteria

- [x] C1. A T1 test file that only names `nvim/test/x.test.ts` and "harness" inside string literals and comments gets no machine or harness finding, proved by a lint test.
  - done: impl-730 · 2026-10-17T11:31:08.760Z
  - verified: rev-30 [reviewer] · run rev-20261017-730-source · 2026-10-17T11:33:08.360Z · commit e1ebf77b02ab5233f7071bb35510269dab4bcfe4
  - verified: rev-30 [reviewer] · run rev-20261017-730-lock-correction · 2026-10-17T15:06:58.391Z · commit 733193450009713abf324d2a6b47910fcb98aadb
- [x] C2. A file that imports or calls a Neovim or process helper still gets its finding, and the classification of every file in hub/test/tiers.json on dev is unchanged or differs only where a literal caused it, listed in the review request.
  - done: impl-730 · 2026-10-17T15:01:59.928Z
  - verified: rev-30 [reviewer] · run rev-20261017-730-lock-correction · 2026-10-17T15:06:58.391Z · commit 733193450009713abf324d2a6b47910fcb98aadb

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

### rev-30 · 2026-10-17T14:58:53.147Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-730-runtime
commit: e1ebf77b02ab5233f7071bb35510269dab4bcfe4
scope: evidence
findings: [{"severity":"medium","text":"M1: the two package-admission fixtures still expect shared-lock filesystem lookups to be refused, but touchesMachineResources now admits their existsSync('/tmp/cland-suite[‑nvim].lock') calls. Unlike an inert reporter string, these inputs execute a filesystem read; they proceed into runPackageSuite instead of producing the expected exit1/resource error and both hit120s timeouts in A-4557. Preserve code-aware inert-data acceptance while making the package-level resource-refusal fixtures/policy coherent; retain an actual shared-resource refusal proof and rerun these bounded package cases before a new source review.","file":"hub/test/suite-runner.test.ts","line":755}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear on A-4557/6569987b exit124. M1 suite-runner.test.ts:755–756: executed existsSync(shared-lock-path) fixtures still expect exit1/resource refusal, but the new sole AST qualification predicate admits them; both package cases run into120s timeouts. Fix package-boundary compatibility while retaining inert reporter-data acceptance and genuine resource-refusal meaning, then focused evidence/new-head source review. I missed this caller compatibility in prior source review. Raw log also shows out-of-diff ask-chain forward case red9.731s; classification belongs to lead.84/84 is only completed free phase, not a zero-failure whole run; machine incomplete, Neovim not reached. C2 failed, C1 source support retained. No unchanged-head retry or full task run requested.

Criteria: C2 failed (Existing package shared-resource refusal fixtures are admitted by the new predicate and both hit120s timeouts; correct code-aware policy/fixtures and preserve boundary coverage before re-review.).

### impl-730 · 2026-10-17T15:02:41.037Z

Corrected M1 and pushed 733193450009713abf324d2a6b47910fcb98aadb. Differential lint replay and the two unchanged package cases were observed red on e1ebf77b (actual exit0, expected1). New T1 regression covers actual fs/fs-promises calls on shared suite locks, import aliases/namespaces and const path bindings; unused lock strings/report contents/local functions remain inert. The scanner now emits T2 only for the filesystem call/path use. Both original package-refusal assertions remain unchanged and passed5/5; complete suite-runner.test.ts passed43/43 in71.091s. Typecheck, test:tiers, test:lint pass; touched test-lint and suite-tiers files pass5/5 serially below load15. A-4561 contains logs/audit at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4561-t-730-m1-fix-t1-lock-call-regression-package-refusal-and-tier-audit.md. Merged origin/dev26f6ad11 under the Coordinator's T-698 shared-fix authorization, no conflicts. All304 dev tier declarations unchanged; only inert nvim-property resource booleans drop in close-shards and executor-admission, with their declared tiers unchanged. C2 marked done again; requesting fresh delta source review before droplet verification.

### rev-30 · 2026-10-17T15:06:58.391Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-730-lock-correction
commit: 733193450009713abf324d2a6b47910fcb98aadb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-730 source correction and authorized merge review

Reviewed commit: 733193450009713abf324d2a6b47910fcb98aadb.
Fixed points: prior reviewed e1ebf77b02ab5233f7071bb35510269dab4bcfe4 and incoming dev 26f6ad11824010727aac413dfc1de2a2876a7d5a.
Scope: delta. Read-only review; no Reviewer test execution.

## Standards
No findings. The new sharedLockPath analysis resolves string/no-interpolation-template literals and const identifier bindings through the existing lexical binder, with a cycle guard. It applies only to calls bound to fs/fs-promises and their first path argument. Aliased and namespace imports are handled by the existing binding analysis. It adds no process, socket, real-time wait or test execution to the T1 regression.

The three-file task delta retains the existing lint module's import/process/socket/Neovim detection. Admission and report use the same qualifying tier. The new pure table proves executable shared-lock access and keeps negative controls for unused strings, private paths, report contents passed as data, unrelated modules and local functions. Existing suite-runner.test.ts is byte-identical to incoming dev; the actual package refusal assertions were not relaxed.

## Spec and M1 correction
C1 source support remains intact: reporter paths and harness names in strings, template data, comments and object data produce neither machine admission nor lint findings. C2 source support is restored: genuine Neovim/process helper controls retain findings, and actual fs.existsSync access to either global suite lock now requires T2.

A-4561 records the pre-correction differential and package failure (exit 0 versus expected 1), followed by green corrected results. I independently audited its embedded metadata/raw summaries: test-lint 8/8 five times, suite-tiers 8/8 five times, both unchanged package-refusal cases 2/2 five times, and whole suite-runner 43/43, zero failures/cancellations/skips, 71.090546417 seconds. Fifteen serial admissions show loads 5.2861328125–5.5556640625. The new lock-call identity appears in the whole-file lint receipts. Typecheck, tier lint and report lint outputs are included; report lint remains non-failing (341 findings in 198 files). Read-only diff check is clean.

tiers.json is independently byte-identical to incoming dev. A-4561's 304-file differential lists no qualifying-tier or manifest changes. Its only admission-boolean reductions are close-shards and executor-admission data-only nvim properties; the files' declared T3/T2 tiers are unchanged. Source inspection agrees with that exception.

## Merge authority and evidence limits
Coordinator primary confirmation 027fb8b7-9b15-4104-9a59-fbfd831ee6f5 confirms the merge of dev 26f6ad11 under e7f715e7/rule 11 to take T-698's frozen-legacy/live-plan proof. The final task delta versus that dev is limited to test-lint.ts and the two test files. No manual merge conflict occurred.

Correction to A-4561's description: the Coordinator states no durations-baseline refresh has yet been posted; that refresh is deferred to the next green integrated cover. This review does not claim such a refresh was imported.

Source clear; M1 resolved, no remaining findings. Refresh C1/C2 source verification. A fresh normal mode-free exact-head droplet verification is still required before final evidence clearance. A-4557 remains the failed prior-head receipt (84/84 was only its completed free phase; machine phase was incomplete and Neovim was not reached). Out-of-diff ask-chain failure is tracked as T-739; no final acceptance is inferred from it.

Durable review: A-4562.

Criteria: C1 verified, C2 verified.

### impl-730 · 2026-10-17T15:12:48.479Z

Same-head droplet verification ff69cf52-32fa-424a-a6b2-45323f6c1ffb passed at reviewed 733193450009713abf324d2a6b47910fcb98aadb: exit0, hub-selected plus Neovim smoke, 230pass/0fail/0cancelled/0skipped. Linux x64 c-8 lon1, Node24.21.0, Neovim0.12.5; droplet lifetime272s, cost$0.0189. Evidence A-4570 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4570-suite-ff69cf52-32fa-424a-a6b2-45323f6c1ffb-auto-at-7331934.log. Reviewer received the same-head result directly; final evidence verdict pending. No source/head changes after source delta clearance rev-20261017-730-lock-correction.
