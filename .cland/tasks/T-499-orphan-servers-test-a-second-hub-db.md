---
id: T-499
kind: task
title: "orphan-servers test: a second hub.db connection hits SQLITE_BUSY against the live hub (Linux, under load)"
state: open
status: in progress
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-332
branch: t/T-499-orphan-servers-test-a-second-hub-db
created: 2026-10-15T14:07:24.615Z
updated: 2026-10-15T22:41:53.849Z
---

## Problem

`hub/test/orphan-servers.test.ts:346`, the OpenCode unverifiable-live-server case, writes hub.db through a second connection while the hub holds it, and hit SQLITE_BUSY on Linux in T-456's droplet verify 9d3032d2 (A-3050). T-456 doesn't touch the file. The E-423 stage-1 cover ab5bddd4 had the same file green.

## Acceptance criteria

- [x] C1. The case seeds its row either before the hub opens the database, or through the hub's own write path or a busy_timeout connection, so it can't race the hub's writer. Every assertion stays, and the root cause is recorded in the commit.
  - done: impl-499 · 2026-10-15T22:38:57.057Z
  - verified: rev-30 [reviewer] · run rev-20261015-499-source · 2026-10-15T22:40:43.310Z · commit 289b3c176f553e595b75a9f532236af39d3a7098
- [ ] C2. orphan-servers.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### coord · 2026-10-15T19:06:43.225Z

Second case: orphan-servers.test.ts:294, the offline-wrapper case, hit SQLITE_BUSY at its second DB connection (:320) on Linux in T-508's run c19b825b (A-3280). Same race as :346. Fix every second-connection write in the file.

### impl-499 · 2026-10-15T22:29:07.205Z

Read task, E-482 Coordinator decisions and v0.1.3 spec. Both reported races are direct DatabaseSync connections with SQLite's default zero busy timeout while a hub writer may hold its transaction. Fix will give all fixture mutation connections a bounded busy_timeout, retaining all assertions and the live-hub offline-wrapper scenario. Whole-file Mac evidence will be five serial passes, labelled quiet/loaded; source review then exact-head droplet verify.

### impl-499 · 2026-10-15T22:39:24.388Z

Source 289b3c176f553e595b75a9f532236af39d3a7098 committed and pushed to origin; origin/dev up to date before first review. A-3411 contains five serial whole-file Mac passes run alone (24/24 tests each, no skips); admissions load1 6.22/7.23/4.19/4.09/13.50, wall seconds 74.3/72.5/72.2/95.2/97.0. A-3404 records diagnosis. Review requested from Reviewer in topic-332. C1 marked done; C2 awaits exact-head droplet verify after source-clear.

### rev-30 · 2026-10-15T22:40:43.310Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-499-source
commit: 289b3c176f553e595b75a9f532236af39d3a7098
scope: full

Source review T-499 clear at 289b3c176f553e595b75a9f532236af39d3a7098, parent 21ae664d43f476ab47c7dbb08bed60760832afca. Standards and Spec reviewed directly under the no-delegation role. No high, medium or low findings.

## Standards
No findings. The file-local fixtureDatabase factory sets pragma busy_timeout=5000 immediately after construction, before any fixture SQL; all seven former direct connection sites use it. It matches Store's existing bound (hub/src/hub/store.ts:361–364), avoids sleeps/retry loops and leaves connection ownership/closure at the existing call sites. Source diff is one file, 15 additions/7 deletions; whitespace check clear. No new test identities, production path, manifest entry, global environment mutation or lifecycle bound.

## Spec
C1 verified. The commit records independent DatabaseSync connections with zero busy timeout racing a live writer. Existing Linux logs A-3050 and A-3280 directly show errcode5/database is locked on the unverifiable-live-server identity mutation and offline-wrapper status mutation. The factory covers both plus all other fixture writes, including restoring pid_started. All95 assertion lines and every test declaration are byte-identical to parent. Offline-wrapper continues to use startDaemon and proves the hub stays alive; the unverifiable-server case uses embedded projectHub, whose Store transaction commits synchronously (store.ts:672–697). This is a bounded lock-wait policy, not a guarantee against a writer held beyond5s; Linux runtime evidence remains required.

C2 UNVERIFIED in full. A-3411 raw logs establish the Mac portion: five serial whole-file passes,24/24 each (120 total), zero failures/cancellations/skips. Full wall durations74.237/72.459/72.174/95.170/96.922s. Logs label alone admissions, loads6.22/7.23/4.19/4.09/13.50, starts22:31:52/22:33:06/22:34:19/22:35:32/22:37:08Z, consistent with serial completion. README discloses queue/load/no-other-file checks. No actual Linux task verify is present yet. One exact-head diff-selected cland verify under current Coordinator admission rules may follow source clear; preserve actual executor/platform and leave C2 pending until the required droplet file pass and acceptable overall gate evidence.

Evidence: A-3404 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3404-t-499-fixture-database-race-and-validation-plan.md; A-3411 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3411-t-499-five-serial-whole-file-mac-passes-alone/README.md. No per-item QA criteria. No Reviewer tests, edits, merges or provider actions.

Standards:0 findings; Spec:0 findings, Linux portion of C2 pending.

Review artifact A-3412 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3412-t-499-source-clear-at-289b3c17-bounded-fixture-database-lock-waits.md.

Criteria: C1 verified.

### rev-30 · 2026-10-15T22:41:53.849Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-499-host-gate
commit: 289b3c176f553e595b75a9f532236af39d3a7098
scope: evidence

Evidence review T-499 not clear at unchanged 289b3c176f553e595b75a9f532236af39d3a7098: c6147dd0-f9d7-41f8-bdee-6b382b424444 / A-3416 exited 1 at host typecheck. No droplet was created and no test counts or Linux platform were recorded.

Medium gate blocker — hub/package.json typecheck script: the host could not resolve the required worktree node_modules/typescript7/bin/tsc (MODULE_NOT_FOUND). This is dependency provisioning, not a TypeScript diagnostic in orphan-servers.test.ts. The immutable head declares the typescript7 npm alias 7.0.2 in hub/package.json and both root/hub scripts require its hoisted executable.

C1 source clearance A-3412 and five complete Mac passes A-3411 stand. C2 remains unverified because its actual droplet file pass is absent; no criterion is failed on this unexecuted evidence. A-3416 is not an eligible Linux receipt or known-flake gate receipt. Restore/validate the candidate's declared dependency installation through the responsible Implementer, then run one same-head verification under current Coordinator admission rules. No source change is required by this log; any source/head change needs review before verification.

Current read-only filesystem inspection finds typescript7/package.json present already, suggesting installation may have changed since the receipt; that observation does not prove the typecheck or Linux run has passed. No Reviewer dependency mutation, compiler/test execution or provider action.

Log A-3416: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3416-suite-c6147dd0-f9d7-41f8-bdee-6b382b424444-auto-at-289b3c1.log.

Evidence artifact A-3417 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3417-t-499-host-gate-blocked-compiler-alias-unavailable-before-droplet-creation.md.
