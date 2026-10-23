---
id: T-1113
kind: task
title: The first answer wins against the harness and across hub restarts
state: open
status: review
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by:
  - T-1111
  - T-1112
topic: topic-888
branch: t/T-1113-the-first-answer-wins-against-the
created: 2026-10-22T15:16:11.772Z
updated: 2026-10-23T03:42:27.388Z
---

## Summary

Make the gate hold when the harness's own TUI answers while a hub answer is on its way, and rebuild pending records with their ids after a hub restart, so no approval is lost to a restart.

## Parent

E-414 (§3.4 "One gate for answers"; "Losing the race" and "Restarts"; tracer step 4).

## What to build

A harness can resolve a request while the hub's answer is on its way: an attached TUI answered first, or the harness withdrew the request. Then exactly one outcome is recorded, the harness's. The human's answer is refused with who answered and when, and no client reads the hub's choice as the outcome. A Deny that loses this race never ends as an approval.

When the hub restarts, the records of pending requests come back with the same ids as each adapter reconnects: from Codex's replay of pending requests, from OpenCode's snapshot of pending permissions, and from Claude Code's waiting state. A request answered in the harness while the hub was down reads as closed with the harness's outcome. An answer given after the restart reaches the harness. Closed records keep their outcomes in the inbox archive.

## Acceptance criteria

- [x] C1. When another client resolves a Codex request while the hub's Deny to it is in flight, only the harness's outcome is recorded, and the human's answer is refused naming the harness (test).
  - done: impl-1113 · 2026-10-23T02:47:21.688Z
- [x] C2. When an OpenCode reply is refused as not found because the TUI answered first, the record closes with the TUI's reply, never with the hub's choice (test).
  - done: impl-1113 · 2026-10-23T02:47:21.782Z
- [x] C3. A hub restarted with one pending Codex request, one OpenCode request and one Claude Code request serves the three records with their ids, and an Approve once after the restart reaches the Codex request (test).
  - done: impl-1113 · 2026-10-23T03:29:51.111Z
- [x] C4. After a restart, a request answered in the harness while the hub was down reads as closed with the harness's outcome (test).
  - done: impl-1113 · 2026-10-23T02:58:12.995Z
- [x] C5. A closed record's outcome is in the inbox archive after a restart (test).
  - done: impl-1113 · 2026-10-23T02:47:22.102Z
- [x] C6. `hub/README.md` describes the race with a harness's TUI and how records are rebuilt after a restart (docs).
  - done: impl-1113 · 2026-10-23T02:47:22.174Z
  - verified: rev-23 [reviewer] · run rev-20261023-1113-source-3 · 2026-10-23T03:31:39.526Z · commit f9e3a8f518e971c012d91e31e1dcba8e8eee569c

## Comments

### impl-1113 · 2026-10-23T02:47:22.251Z

Implemented at 6a075553581045a715c4fb94ffe156d95045e656 on t/T-1113-the-first-answer-wins-against-the, pre-review origin/dev e2b22f2f merged (T-1159 retained). A-9775 records red/green boundaries and Coordinator decision 9a8ec668. Native winner attribution now survives a losing in-flight answer; OpenCode reject-vs-reject requires its HTTP receipt. Pending allowlisted metadata/id/subject survives hub restart and native reconciliation; closed outcomes remain archived. C3–C5 T3 scratch-process test passed at exact head on local Darwin arm64, 5.918327 s, no skip/fail/cancel, with all process teardown observed. npm run check passed (lint report-only 132 findings/59 files, 0 refusals). Exact-head targeted native/record files and Codex contract passed; final OpenCode contract receipt collection remains running. No configured suite evidence claimed yet. QA policy affected/after-stage, no per-item brief/QA criteria. All six implementation criteria done; source review requested next.

### rev-23 · 2026-10-23T02:50:43.468Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1113-source
commit: 6a075553581045a715c4fb94ffe156d95045e656
scope: full
findings: [{"severity":"medium","text":"Fresh Watch starts with an empty children map, but approvalsReconciled treats only the parent/known-child snapshots as the complete pending inventory. After a hub restart, a still-pending pre-existing child permission is absent and permanently archived as answered in the harness. Rebuild/discover child ownership before reconciliation; retain exact id/subject and child reply routing with a restart/frame regression.","file":"hub/src/adapters/opencode.ts","line":560},{"severity":"medium","text":"Restored ids/subjects are loaded synchronously by InboxBoard before asynchronous resumeAll completes; this wait can pass without native Codex replay/readiness, so the following single approval.answer races reconnect. Bound setup on the exact native replay/ready receipt, test held recovery, and retain the one-shot answer plus command filesystem assertion.","file":"hub/test/approval-restart.test.ts","line":65}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear, complete finding set M1/M2 in A-9778: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9778-t-1113-source-findings-child-restart-inventory-and-replay-readiness.md. M1 fresh OpenCode Watch children map is empty, so reconciliation cannot classify absent pre-existing child permissions as closed. M2 restored SQLite ids/subjects do not prove native replay readiness before the single answer; bound setup on an exact ready receipt and hold recovery in regression. Other race/gate/store/docs/tier/allowance review complete; Coordinator-authorized Codex echo-boundary change accepted. A-9777's 101 local targeted passes are supporting evidence, not configured/Linux coverage. Fix and request fresh source review before verify; final criteria and after-stage QA remain separate.

Criteria: C3 failed (Restart reconciliation can lose a pending OpenCode child permission; replay test waits only for restored metadata, not native readiness.), C4 failed (Incomplete child inventory can falsely archive a still-pending child as answered off-stream.).

### impl-1113 · 2026-10-23T02:58:58.376Z

Corrected review findings M1/M2 at 8adff262 (pushed, clean, no dev merge after first review). A-9782 records red/green boundaries: child-permission restart ids [] vs expected id fixed by durable pending child ownership/rebuilt trackers before snapshots; held native resume now requires exact approval-rebuilt journal receipt after validation before the single answer/command filesystem receipt. Fresh source review requested. Corrected exact-head raw folder A-9783: local Darwin arm64 check exit0; 102/102 targeted tests, zero fail/cancel/skip; held-replay T3 identity 5.976381 s. Lint report-only 132 findings/59 files, 0 refusals. All C1–C6 claimant done. No configured verification, Linux or full-suite result claimed.

### rev-23 · 2026-10-23T03:00:34.303Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1113-source-2
commit: 8adff2621aac56b08be42af963364d08b6a6f3d6
scope: full
findings: [{"severity":"medium","text":"A replayed request finds the persisted previous record and returns without refreshing its subject/answerIn/choices. OpenCode.answerApproval only checks tracker.permissions, so restored old hub eligibility permits an endpoint reply while replay subject validation is held, or after validation reports TUI-only. Gate replay readiness and current answerability, refresh validated public authorization fields preserving id/since, and add held/malformed replay approval.answer regressions with no native endpoint calls.","file":"hub/src/hub/inbox.ts","line":361}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected source not clear: original M1 child-owner recovery and M2 exact native-ready setup receipt are addressed, but new M3 remains at InboxBoard.requestApproval previous-record return plus OpenCode reply path. Old persisted hub choices/subject are retained when native validation is held/fails; permission presence alone permits native replies. Require exact replay readiness/current answerability guards and refreshed validated public fields, preserving stable id/since; cover held and malformed/read-failed replays through approval.answer with no endpoint call. A-9784: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9784-t-1113-corrected-source-audit-stale-replay-authorization-remains.md. Complete finding set for this pass, remaining audit stands. Exact-head targeted collection pending at request; no configured pass. Fresh source review before verification.

Criteria: C3 failed (Restored OpenCode hub choices/subject remain answerable before replay validation and after a TUI-only fallback.).

### impl-1113 · 2026-10-23T03:07:46.981Z

M3 uncommitted correction in progress; native held/malformed/reconnect authorization regression red→green before cover-quiet, both native files and hub typecheck passed on working tree. One additional gate failure-reset/interleaving regression is written but unrun in approval-records.test.ts; implementation awaits its red receipt. Local tests paused under Coordinator 897deb12 (macOS E-417 stage cover), all had exited before notice. No configured verification/source re-request/new head. Resume after cover-quiet lifted, complete red/green, commit/push, fresh source review.

### impl-1113 · 2026-10-23T03:30:53.896Z

M3 final correction at f9e3a8f518e971c012d91e31e1dcba8e8eee569c (M3 commit 1b186a57 + Coordinator c3ee498d-authorized merge of origin/dev 4d6ab58c). A-9794 explains native validation, refreshed authorization at stable id/since and reservation-preserving failure reset. Exact-head local raw folder A-9796: check exit0; 104/104 targeted tests, zero fail/cancel/skip (T2 native28+30, records19, T3 restart1/contracts12+14); restart identity 5.964156 s on Darwin arm64. Lint report-only 132 findings/59 files, 0 refusals. No tests during cover-quiet. All criteria claimant done, fresh source review pending. No configured verification claimed.

### rev-23 · 2026-10-23T03:31:39.526Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1113-source-3
commit: f9e3a8f518e971c012d91e31e1dcba8e8eee569c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, C6 docs verified; C1–C5 runtime pending. A-9797: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9797-t-1113-corrected-source-clear-at-f9e3a8f5.md. M1/M2 child-owner recovery/exact native-ready receipt retained. M3 fixed by current reported/hub eligibility, invalidation per fresh lookup, superseded-generation guard and validated public-field rebuild preserving id/since/answering reservation. Failed answer resets to latest fields; public held/malformed/changed-valid replay and fake-adapter failure-reset regressions retain no-endpoint-call assertions. Accepted Codex observable boundary and explicit limitation unchanged. Directed dev merge adds tracker/duration only. Corrected exact-head local checks/targeted collection still pending at request, not claimed passing. After local check completes, proceed with exact-head mode-free run and authorized Coordinator T3 coverage; final evidence/after-stage QA separate.

Criteria: C6 verified.

### impl-1113 · 2026-10-23T03:42:27.388Z

Configured mode-free bbc3522f/A-9801 green at unchanged source-clear f9e3a8f5: Linux x64 c-8 lon1 droplet, Node24.21.0/Neovim0.12.5, T1/all-T2 both-package fallback/Web, 2645 pass, zero fail/cancel/skip. Host typecheck gate reused, not remotely repeated; lint/duration report-only and Web over-budget diagnostics retained. Machine lifetime537s/cost$0.0373; no projection substituted for wall time. This receipt supplies no T3. Coordinator 204ee629 schedules unchanged-head authorized all/T3 after T-1094's current run; head held, no new source edits. Final evidence/ready awaits that receipt and Reviewer settlement; after-stage QA separate.
