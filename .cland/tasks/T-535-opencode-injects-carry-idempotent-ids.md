---
id: T-535
kind: task
title: OpenCode injects carry idempotent ids, and child sessions feed the instrumentation
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-424
blocked_by: []
topic: topic-498
branch: t/T-535-opencode-injects-carry-idempotent-ids
created: 2026-10-15T20:59:19.616Z
updated: 2026-10-18T10:01:59.102Z
---

## Summary

E-424 slice 5 (tracer step 5). OpenCode injects carry caller-chosen idempotent ids, so a retried inject is admitted once. Child sessions feed the instrumentation of v0.1.2 §3.12: their model, their usage and their pending approvals.

## What to build

See E-424's "Idempotent ids" and "Child sessions" bullets.

- **Idempotent ids.** Each inject carries `msg_` plus a hash of the cland message id and the session. A retried inject returns the first admission, and a broadcast gets one id per recipient. This stays inside the adapter, with no contract change.
- **Child sessions.** A `session.created` with a `parentID` becomes the existing sub-agent signal (`SubagentLaunch`), carrying the child's model. A child's steps add to the parent's usage. A child waiting for approval shows its parent as waiting.

Code: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/client.ts`, `hub/src/adapters/opencode/state.ts`.

## Acceptance criteria

- [x] C1. A timed-out inject retried at the next idle reaches the fake server once, and a broadcast's recipients each get their own id.
  - done: impl-535 · 2026-10-18T09:26:27.059Z
  - verified: rev-31 [reviewer] · run rev-20261018-535-final · 2026-10-18T10:01:57.277Z · commit 71bef41d2809d7e5abc91c71922b98fd990367eb
- [x] C2. A child session's model appears in the sub-agent launch record and its usage adds to the parent's usage record.
  - done: impl-535 · 2026-10-18T09:26:28.464Z
  - verified: rev-31 [reviewer] · run rev-20261018-535-final · 2026-10-18T10:01:57.277Z · commit 71bef41d2809d7e5abc91c71922b98fd990367eb
- [x] C3. A child waiting for approval shows its parent session as waiting.
  - done: impl-535 · 2026-10-18T09:33:49.423Z
  - verified: rev-31 [reviewer] · run rev-20261018-535-final · 2026-10-18T10:01:57.277Z · commit 71bef41d2809d7e5abc91c71922b98fd990367eb

## Comments

### impl-535 · 2026-10-18T09:23:48.807Z

TDD progress: lost-response admission regression failed with two native admissions and now passes with stable per-message/per-session msg_ ids. Child usage regression failed with parent-only totals and now passes; child-approval aggregation regression failed with parent busy and now passes at the existing T2 scripted transport seam. Adding recipient isolation and reconnect coverage before review.

### rev-31 · 2026-10-18T09:31:20.899Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-535-source-1
commit: 5ba696ca58f06bb4a498d02a3a443b7648459b31
scope: full
findings: [{"severity":"medium","text":"Unconditional family snapshot resets overwrite newer child SSE approval/reply events; preserve event ordering and add held-response controls.","file":"hub/src/adapters/opencode.ts","line":428}]
finding_counts: {"high":0,"medium":1,"low":0}

Source review at 5ba696ca58f06bb4a498d02a3a443b7648459b31, fixed base 226bd904a90b269e80b3faa5b514a0ea2f367fff. Scope full; read-only review without running tests.

## Standards
No findings. Five new controls use the existing T2 scripted HTTP/SSE boundary, in-process hub/spokes and FakeClock, with 2s test deadlines. No added processes, wall-clock sleeps, allowances or shared contract changes.

## Spec
Medium M1 — hub/src/adapters/opencode.ts:423–429 (C3): family snapshot application can overwrite newer child SSE state. The subscription starts asynchronous snapshots while its onEvent callback continues mutating the same trackers. After all responses resolve, tracker.reset(snapshot) unconditionally replaces those mutations. A known child's snapshot can capture no approvals, then permission.asked marks it waiting, then release of an older held response clears the pending approval and signals busy/idle. Watch/abort checks at line 425 do not establish event ordering. The symmetric stale-pending snapshot can restore an approval already answered. The new reconnect test uses immediate snapshots and does not cover either ordering.

Preserve events received after snapshot admission (or otherwise establish an explicit reconciliation boundary), and add a held-response control retaining both the newer approval and its later reply. A new source review is required before verification.

C1 source path uses stable SHA-256 ids over message id and cland session identity, including rename-stable recipient isolation; its lost-response test retains one admission and two attempts. C2 routes known-child usage into parent totals while keeping child model/execution boundaries separate, with unrelated-child exclusion. Neither establishes a final runtime verdict without post-clear verification. A-5119 targeted results inspected.

Standards: 0 findings. Spec: 1 medium finding.
Artifact A-5131.

Criteria: C3 failed (An older held reconnect snapshot can overwrite a newer child permission event and falsely unblock the parent.).

### rev-31 · 2026-10-18T09:35:01.605Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-535-source-2
commit: 71bef41d2809d7e5abc91c71922b98fd990367eb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review at 71bef41d2809d7e5abc91c71922b98fd990367eb, fixed base 226bd904a90b269e80b3faa5b514a0ea2f367fff; correction diff against 5ba696ca independently inspected. No dev merge and no Reviewer test execution.

## Standards
No findings. The correction stays at the existing T2 scripted transport boundary with a bounded 2s test. It observes captured/held snapshot admission, releases the response, joins its completion, then separately waits for family reconciliation. No native process or wall-clock wait added.

## Spec
Prior M1/C3 resolved. Events received while the family snapshots are pending continue through live handling and are retained. After atomic family reset, tracker state alone is replayed before publishing aggregate state; usage, launch and turn-completion effects are not republished. Ended-stream snapshots are fenced with streamCurrent plus current-watch/abort checks. Permission descriptions use the reconciled pending requests, not the stale snapshot list.

The held-response regression covers both empty snapshot → newer approval and pending snapshot → newer reply. A-5138 records the exact pre-fix red (parent busy instead of waiting) and corrected 14/14 whole-file pass in 3.126s, new case 0.455s, with typecheck/lint/diff checks green. C1 stable per-message/per-recipient admission IDs and C2 separate child model plus additive parent usage remain unchanged from the first source review. No remaining findings.

All C1–C3 execution criteria remain pending exact-head post-source-clear mode-free task verification; this is a source clearance only. No per-item QA required.

Standards: 0 findings. Spec: 0 findings.
Artifact A-5143.

### rev-31 · 2026-10-18T10:01:57.277Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-535-final
commit: 71bef41d2809d7e5abc91c71922b98fd990367eb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review at unchanged 71bef41d2809d7e5abc91c71922b98fd990367eb, matching origin and source-2 / A-5143.

Independently audited A-5174 / b6754a4a-c366-4e59-91bc-aa74d25443f8: auto hub-only, exit0, 2158 total / 2153 pass / 0 fail / 0 cancelled / 5 prerequisite skips. Hub-free224/224, hub-machine1924 pass+5 skips, Neovim smoke5/5 completed3.52s. This is hub plus smoke coverage, not full Neovim. All phase failure identity arrays are empty; no owned quarantine or runtime tier-mismatch receipts.

All14 opencode-native ordinary cases have positive timing receipts. All6 added identities pass5/5 load repetitions,30/30. Owned controls cover lost-response retry with one native admission, stable per-recipient IDs across rename, child model/additive usage with unrelated-child exclusion, aggregate approvals/forms, reconnect restoration, and held snapshot versus newer approval/reply ordering. Main new cases0.182–0.454s; whole owned file3.242s. Prior M1 correction remains unchanged.

Linux x64 c-8 lon1, Node24.21.0/Neovim0.12.5, workers2, lifetime1457s, cost$0.1012, peak load6.87. Report-only diagnostics leave raw exit0 unchanged. C1–C3 verified. No known-red exception, extra run or per-item QA required. Standards: no new findings. Spec: final clear.
Artifact A-5176.

Criteria: C1 verified, C2 verified, C3 verified.
