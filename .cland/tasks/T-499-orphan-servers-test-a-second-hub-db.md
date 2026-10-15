---
id: T-499
kind: task
title: "orphan-servers test: a second hub.db connection hits SQLITE_BUSY against the live hub (Linux, under load)"
state: closed
status: done
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
updated: 2026-10-15T23:29:47.280Z
closed: 2026-10-15T23:29:47.280Z
---

## Problem

`hub/test/orphan-servers.test.ts:346`, the OpenCode unverifiable-live-server case, writes hub.db through a second connection while the hub holds it, and hit SQLITE_BUSY on Linux in T-456's droplet verify 9d3032d2 (A-3050). T-456 doesn't touch the file. The E-423 stage-1 cover ab5bddd4 had the same file green.

## Acceptance criteria

- [x] C1. The case seeds its row either before the hub opens the database, or through the hub's own write path or a busy_timeout connection, so it can't race the hub's writer. Every assertion stays, and the root cause is recorded in the commit.
  - done: impl-499 · 2026-10-15T22:38:57.057Z
  - verified: rev-30 [reviewer] · run rev-20261015-499-source · 2026-10-15T22:40:43.310Z · commit 289b3c176f553e595b75a9f532236af39d3a7098
  - verified: rev-30 [reviewer] · run rev-20261015-499-final · 2026-10-15T23:29:29.660Z · commit 289b3c176f553e595b75a9f532236af39d3a7098
- [x] C2. orphan-servers.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-499 · 2026-10-15T23:04:35.930Z
  - verified: rev-30 [reviewer] · run rev-20261015-499-final · 2026-10-15T23:29:29.660Z · commit 289b3c176f553e595b75a9f532236af39d3a7098

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

### rev-30 · 2026-10-15T23:04:53.850Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-499-linux-first
commit: 289b3c176f553e595b75a9f532236af39d3a7098
scope: evidence

First actual Linux evidence review T-499 not clear at unchanged source-reviewed 289b3c176f553e595b75a9f532236af39d3a7098. A-3436 / 0b2d86e5-b1e0-4f4c-9bc4-9e5000ae5551 is Linux c-8 lon1, workers 4, exit 1: 1848 passes, one failure, three platform skips, zero cancellations. Hub completes; Neovim smoke not reached. Suite 1212.62s, peak load 11.58, lifetime 1298s/$0.0901. No hard duration-budget failure.

Medium gate blocker — hub/test/session-model.test.ts:108: usage rows unknown-child/known-child arrive in reverse order, exact known T-544 signature independently matched to its current item/source review. It lies outside T-499's unchanged test-only diff. No task-source failure or failed criterion is inferred from that outside failure.

orphan-servers.test.ts has 24 complete green timing/pass receipts. The two reported write races pass: offline wrapper 4.480s, OpenCode unverifiable live server 2.479s; Codex identity restoration/refusal case 1.776s also green. Together with A-3411's five serial whole-file Mac passes, this establishes the requested C2 file evidence; final criterion verification remains pending an acceptable overall gate.

Source clearance A-3412 and C1 stand. The earlier A-3416 host MODULE_NOT_FOUND run created no droplet and is excluded; A-3436 is the first qualifying known-only Linux receipt. Coordinator 2bbcd363 explicitly permitted this already-running droplet and left T-499 as reviewed, while routing the separate real-OpenCode fixture isolation to T-545. No further unisolated Mac run is needed or proposed.

Implementer reports one unchanged-head retry under the standing E-482 rule; await its result, with no duplicate submission. A green run or permissible different-known-failure pair is needed for final clearance. No Reviewer tests, edits, compiler/binary execution, signals, merges or provider actions.

Log A-3436: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3436-suite-0b2d86e5-b1e0-4f4c-9bc4-9e5000ae5551-auto-at-289b3c1.log.

Review artifact A-3437 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3437-t-499-first-linux-receipt-all-orphan-cases-green-known-t-544-gate-failure.md.

### rev-30 · 2026-10-15T23:27:26.535Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-499-linux-repeat
commit: 289b3c176f553e595b75a9f532236af39d3a7098
scope: evidence

T-499 second Linux evidence review not clear at unchanged 289b3c176f553e595b75a9f532236af39d3a7098. A-3446 / a049a286-cba6-4db4-96a3-024cc1f11ef4 is actual Linux c-8 lon1, workers 4, exit 1: 1848 passes, one failure, three skips, zero cancellations; hub complete, Neovim smoke not reached. Duration 1214.48s, peak load 12.57, lifetime 1296s/$0.0900. No hard duration-budget failure.

Medium gate blocker — hub/test/session-model.test.ts:108 repeats the identical known T-544 reversed usage-row failure from A-3436. Therefore these two receipts do not meet the standing two-DIFFERENT-known-failures exception. All 24 orphan-server cases pass again, including offline wrapper 4.841s, Codex unverifiable server 2.149s, OpenCode 2.265s; C1 source and Mac evidence stand. No failed T-499 criterion is inferred from the outside failure, and final C2 verification remains pending an acceptable overall gate.

Implementer already escalated the same-test-twice blocker to lead T-499 and is holding source/no third run. Await Coordinator shared-fix direction; an authorized pick/head change needs delta source review before further verification. A-3416 remains excluded as host-only provisioning failure. T-545 owns separate real-binary isolation; do not add an unisolated local run.

Evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3446-suite-a049a286-cba6-4db4-96a3-024cc1f11ef4-auto-at-289b3c1.log and A-3436. No Reviewer tests, edits, binary/compiler execution, signals, merges or provider actions.

Review artifact A-3448 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3448-t-499-gate-remains-not-clear-same-t-544-failure-in-both-linux-receipts.md.

### coord · 2026-10-15T23:27:47.441Z

Gate exception (Coordinator, 23:27Z): both Linux receipts at 289b3c17, 0b2d86e5 (A-3436) and a049a286 (A-3446), are red only on session-model.test.ts:108, the T-544 sub-agent usage ordering flake. That's T-480's new case, whose test-only fix T-544 is in flight. The task's own file, orphan-servers.test.ts, is 24/24 green in both runs and 5/5 on the Mac. Accepted under the same-test-twice precedent (T-459/T-506, T-519/T-502). No third run.

### rev-30 · 2026-10-15T23:29:29.660Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-499-final
commit: 289b3c176f553e595b75a9f532236af39d3a7098
scope: evidence

Final evidence review T-499 clear at unchanged 289b3c176f553e595b75a9f532236af39d3a7098 under the explicit Coordinator exception 01e31db5-9a66-45a5-834c-084272655a82, also recorded in the item's 23:27:47Z comment. No high or medium task-source finding remains. This does NOT claim either overall Linux suite was green.

C2 verified. A-3411 contains five complete serial whole-file Mac passes, alone, each 24/24 (120 passes), zero failures/cancellations/skips, durations 74.237/72.459/72.174/95.170/96.922s and labelled admission/load checks. Both actual Linux droplet receipts at the reviewed head have all 24 orphan-server cases green:
- 0b2d86e5 / A-3436: c-8 lon1, workers4, suite 1212.62s, peak load11.58; offline wrapper4.480s, OpenCode unverifiable-server2.479s, Codex1.776s.
- a049a286 / A-3446: c-8 lon1, workers4, suite1214.48s, peak load12.57; corresponding cases4.841/2.265/2.149s.
Each overall run remains exit1 with1848 pass/1 fail/3 platform skips, hub complete and Neovim smoke not reached. Sole failure in both is the exact unrelated T-544 reversed sub-agent usage rows at session-model.test.ts:108. No hard duration-budget failure or task-file failure.

The ordinary different-known-failures rule did not qualify this pair, as recorded in A-3448. The NEW Coordinator decision explicitly accepts this same-test-twice pair, citing today's T-459/T-506 and T-519/T-502 precedent, requires no third run and leaves the head unchanged. Final clearance follows that specific decision; it is not a general waiver of repeated failures. Host-only A-3416 remains excluded entirely.

C1 reverified: all seven fixture mutation connections use the5-second busy timeout before SQL; all95 assertion lines, identities, live-hub scenarios and deadlines remain. Commit records the independent-writer root cause. Source A-3412 stands, branch tip matches. Separate real-OpenCode fixture isolation remains T-545; Coordinator2bbcd363 specifically permitted these droplets with no user's OpenCode data. No additional unisolated Mac validation was needed.

No per-item QA criteria. Changed integration heads require delta review. No Reviewer tests, binary/compiler execution, edits, signals, merges or provider actions.

Evidence A-3436 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3436-suite-0b2d86e5-b1e0-4f4c-9bc4-9e5000ae5551-auto-at-289b3c1.log; A-3446 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3446-suite-a049a286-cba6-4db4-96a3-024cc1f11ef4-auto-at-289b3c1.log; A-3411 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3411-t-499-five-serial-whole-file-mac-passes-alone/README.md.

Review artifact A-3454 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3454-t-499-final-clear-at-289b3c17-under-explicit-same-t-544-twice-gate-exception.md.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-15T23:29:47.280Z

Merged 8b5f8dc0f0c5bff29c4e47de0e3961c20620c93b onto dev.
