---
id: T-851
kind: task
title: cland update renames origin to github on a v0.1.3 project initialised under a symlinked path (macOS /tmp)
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - qa-found
  - needs-triage
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-600
branch: t/T-851-cland-update-renames-origin-to-github-on
created: 2026-10-19T07:35:48.835Z
updated: 2026-10-19T19:19:21.066Z
closed: 2026-10-19T19:19:21.066Z
---

## Summary

A project initialised by v0.1.3 as `cland init /tmp/x` on macOS gets its `origin` remote renamed to `github`, and a new `origin` added, when the current `cland update` runs. v0.1.3 stored the unresolved path (`/tmp/x`); the current code resolves it to `/private/tmp/x`, sees a different territory and treats the existing origin as a foreign remote.

## Evidence

Found aside while rehearsing the E-615 QA brief on 2026-10-19 at dev 87b626ed (Coordinator sub-agent). It reproduced on the first rehearsal and disappears when the project path is already resolved. The E-615 brief avoids it with resolved paths and checks `origin renamed: 0`.

## Acceptance criteria

- [x] C1. `cland update` on a project whose recorded territory or origin path differs from the current one only by symlink resolution recognises it as the same territory: no remote is renamed or added. A regression test sets up a v0.1.3-style project under a symlinked parent.
  - done: impl-851 · 2026-10-19T14:52:36.396Z
  - verified: rev-30 [reviewer] · run rev-20261019-851-final · 2026-10-19T15:01:11.200Z · commit 6d36f7a084605101c5afc329e87f41b82d651ae1
  - verified: rev-30 [reviewer] · run rev-20261019-851-integration-final · 2026-10-19T17:42:58.729Z · commit 7398d761e19681d370abaee321569b794090c2a3

## Comments

### impl-851 · 2026-10-19T14:51:32.352Z

Regression through runUpdate with v0.1.3-style unresolved territory provisioning under a symlinked parent reproduces C1: node --test --test-name-pattern='update preserves a legacy territory origin' hub/test/territory-cli.test.ts failed (1.847 s) because update reported remotes/github updated (renamed origin to github) and remotes/origin created. Native Git config and effective URL assertions will guard no add/rename/rewrite with and without a preexisting github remote.

### impl-851 · 2026-10-19T14:53:14.299Z

Implemented and pushed 6d36f7a084605101c5afc329e87f41b82d651ae1. C1 done and checkable through native Git symlink-parent runUpdate regression with/without github. Whole touched file: 23/23 pass, 51.819s; regression 1.755s. Typecheck and test lint pass. Fresh origin/dev fetched/merged before source review. Fresh-fetch merge-tree before push clean: c14c0d2f123a86e469723bf905ac562c1ce33442. No per-item QA required (scope none; no qaCriteria).

### rev-30 · 2026-10-19T14:54:12.463Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-851-source
commit: 6d36f7a084605101c5afc329e87f41b82d651ae1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6103, findings []. Canonical realpath equality supplements exact-path identity before remote rename/add and effective URL checks. Existing shared lock, managed-territory symlink protections and foreign URL handling remain. Native T3 regression faithfully provisions a legacy unresolved parent, then checks unchanged remote actions/config, effective push URL and health through alias update with/without github. A-6099 reports red→green and 23/23 full file in 51.819 s; no new hub/harness/wait. C1 done present, final verification pending exact-head mode-free gate plus qualified host regression; task may defer native T3 to landing. No Reviewer tests/mutations.

### impl-851 · 2026-10-19T15:00:40.341Z

Same-head mode-free verification 184f190f-824a-4433-95cc-ddaf37c33112 passed at 6d36f7a084605101c5afc329e87f41b82d651ae1: 429/429 tests, zero failures/cancellations/skips. Linux x64 droplet c-8 lon1, lifetime 330s, cost $0.0229. Durable log A-6121: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6121-suite-184f190f-824a-4433-95cc-ddaf37c33112-auto-at-6d36f7a.log. T3 deferred to merge batch per queue-enabled policy; native macOS touched-file proof is 23/23 pass already recorded. Final Reviewer verdict outstanding.

### rev-30 · 2026-10-19T15:01:11.200Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-851-final
commit: 6d36f7a084605101c5afc329e87f41b82d651ae1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6122, C1 verified, findings []. A-6121 exact-head mode-free 184f190f full audit: ordinary 429/429, zero fail/cancel/skip/TODO, all 201 load groups 5/5, zero tier-mismatch rows. Native territory-cli T3 did not run in this task gate; A-6103 source plus A-6099's qualified reported host red→green/23-test pass establish the alias config/effective-URL proof. Linux T3 remains landing evidence. C1 done present, source unchanged, inherited report-only budget/baseline debt retained. No further item run or Reviewer tests.

Criteria: C1 verified.

### impl-851 · 2026-10-19T15:48:07.619Z

Landing blocked: hub batch 7654a430-b150-41c3-87e9-5c8474d14182 reports 'cannot identify batch candidate tree'. Queue confirms T-851 remains pinned at reviewed/verified 6d36f7a084605101c5afc329e87f41b82d651ae1, with T-862/T-857/T-666. Task worktree clean; source head unchanged. Reported to supervising lead for Coordinator batch recovery; no new item run needed.

### impl-851 · 2026-10-19T17:34:22.971Z

Resolved merge-conflict drop per Coordinator: merged origin/dev once (parent f6cacadf), combining only conflicting imports in territory-cli.test.ts while retaining T-861 regressions and unchanged T-851 fix/test assertions. New pushed head 7398d761e19681d370abaee321569b794090c2a3. Typecheck pass; touched file 25/25 pass in 43.227s (symlink-origin 1.794s). Fresh-fetch merge-tree before push clean e90fcab41c13a0b60d275f07d4946ef7802bd4af. Requesting delta source review before mode-free verification.

### rev-30 · 2026-10-19T17:35:17.711Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-851-integration-source
commit: 7398d761e19681d370abaee321569b794090c2a3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integration delta clear; A-6292. Coordinator07627a76 authorizes this merge. Import union retains T851 identity helpers and T861 native Git/worktree helpers/tests; predicate and full symlink regression body byte-identical to prior clear head. Reported host25/25 qualified; no current Linux native claim. C1 awaits new mode-free exact-head gate; retain existing touched-file output for final provenance, no rerun requested. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6292-t-851-integration-delta-review-at-7398d761.md

### impl-851 · 2026-10-19T17:42:35.389Z

Post-conflict exact-head mode-free verify c96498d8-7ec9-44c4-99f8-b7c000253a4e passed at 7398d761e19681d370abaee321569b794090c2a3: 455/455, zero failures/cancellations/skips/TODO. Linux x64 c-8 lon1, lifetime 363s, cost $0.0252. Durable log A-6295: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6295-suite-c96498d8-7ec9-44c4-99f8-b7c000253a4e-auto-at-7398d76.log. Current-head native 25/25 receipt is A-6293; T3 Linux remains merge-batch evidence. Final Reviewer evidence verdict pending before reporting ready for Coordinator re-enqueue.

### rev-30 · 2026-10-19T17:42:58.729Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-851-integration-final
commit: 7398d761e19681d370abaee321569b794090c2a3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final integration evidence clear; A-6296. A-6295 ordinary 455/455, all 227 groups 5/5, zero tier mismatch. Native territory-cli is excluded; A-6293 retained merged-source host capture supplies 25/25, owned symlink case 1.794 s plus landed whitespace/worktree controls. Tested-tree provenance qualified separately from Linux gate. C1 verified; T3 Linux remains landing evidence. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6296-t-851-final-integrated-head-evidence-at-7398d761.md

Criteria: C1 verified.

### coord · 2026-10-19T19:19:21.066Z

Merged 25f8b738391c8583d5777ce8d46ca1576cdeaf30 onto dev.
