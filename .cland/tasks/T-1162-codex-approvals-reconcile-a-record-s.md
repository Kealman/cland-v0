---
id: T-1162
kind: task
title: "Codex approvals: reconcile a record's outcome with the item's execution when a TUI answer races the hub's write"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1219
branch: t/T-1162-codex-approvals-reconcile-a-record-s
created: 2026-10-23T02:33:54.189Z
updated: 2026-10-29T20:11:09.685Z
closed: 2026-10-29T20:11:09.685Z
---

## Summary

T-1113 (2026-10-23 02:33Z) found a protocol limit: Codex's `serverRequest/resolved` carries only the request and thread ids, and the app-server client's `respond` confirms only the socket write. A remote TUI answer whose resolution arrives after the hub's write succeeded cannot be told from the hub's own echo, so the record reads the hub's choice. T-1113 handles the observable case (resolution before the write receipt is the harness's win) and documents the residue in hub/README.md.

## What to build

Where Codex later reports the item's execution (for example a command that runs after the hub sent Deny, or is declined after the hub sent Approve), the hub reconciles the record's outcome to "answered in the harness" with a warn event, and never infers consent.

## Acceptance criteria

- [x] C1. Through the scripted app-server, a hub Deny followed by a resolution and then the command's execution reads as answered in the harness with a warn-level event (test).
  - done: impl-1162 · 2026-10-29T19:40:39.452Z
  - verified: rev-31 [reviewer] · run rev-20261029-1162-final1 · 2026-10-29T20:04:32.958Z · commit eafad02c5a7475c53724bcd472c62d3b1472e223
- [x] C2. A hub Approve followed by the item's declined completion reads as answered in the harness (test).
  - done: impl-1162 · 2026-10-29T19:40:39.590Z
  - verified: rev-31 [reviewer] · run rev-20261029-1162-final1 · 2026-10-29T20:04:32.959Z · commit eafad02c5a7475c53724bcd472c62d3b1472e223

## Comments

### impl-1162 · 2026-10-29T19:32:00.214Z

Consumer inventory before changing reconciliation semantics (rule 20): Codex NativeApproval and item notifications; AdapterHost approvalClosed in sessions.ts and OpenCode (retain existing semantics, add optional correction hook); InboxService pending/answer/archive and Store inbox_departures; wire ApprovalOutcome and approval deltas (unchanged shape); CLI inbox; Web ApprovalCard/inbox live/archive; Neovim inbox live/archive; gateway cards.ts, Telegram cards, Discord cards/outbox. Existing clients already accept harness outcomes; correction reuses closed approval delta and updates existing archive row, without adding a departure. Test consumers: codex-native T2, codex-adapter T3, approval-records T2, approval-restart T3, telegram-approvals T2, Web inbox/phone-approvals, Neovim inbox recorded fixtures, wire conformance; QA E-414 stage-1, shipped implement skill and native test guide. Startup probes do not consume approval outcomes; persisted pending records unaffected. Preserve previous wire shapes and optional callbacks. Agreed seam is scripted app-server notifications plus real frame clients, no platform or harness credentials.

### rev-31 · 2026-10-29T19:38:05.885Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1162-source1
commit: 323e9451a14fa1200bb556b65d61c87a60775fd0
scope: full
findings: [{"severity":"medium","text":"M1: the new corrected closed approval reuses Telegram's original outcome edit key. Sent keys return immediately; in-flight attempted edits retain old payload, leaving the native card on the contradicted human outcome. Add delivered-first/held-first native HTTP controls and support distinct corrections with ordering/fences preserved.","file":"hub/src/remote/telegram-cards.ts","line":199}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated source1 not clear; M1 only, A-14043. Core scripted archive/live/warn behavior is present but repeated-close Telegram consumer migration incomplete. Local35/35/typecheck is pre-tracker-merge macOS evidence; no configured Linux/T3/T4/Web proof. Keep unchanged T3 restart/adapter coverage disposition explicit. Fix and replacement source review before verification; no Reviewer execution.

Criteria: C1 failed (Later corrected Deny outcome does not replace the existing Telegram card once its human-outcome edit was sent or attempted.), C2 failed (Later corrected Approve/declined outcome similarly remains stale in the paired Telegram card consumer.).

### impl-1162 · 2026-10-29T19:39:16.517Z

Review M1 consumer migration: Telegram approvalOutcome uses one per-copy outcome key, so sent/attempted first edits suppress later corrections. Extend existing real-frame/scripted Codex/fake HTTP approval tests with delivered-first and held-first edits. Preserve old human outcome and explicit press-repair keys, existing payload schema and fences; distinct harness correction uses its own deterministic content key and existing per-chat ordering. Telegram outbox is unchanged. Discord already deduplicates by edit content; both workbenches accept replacement closed deltas. No new wire or credential policy.

### rev-31 · 2026-10-29T19:45:10.157Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1162-source2
commit: eafad02c5a7475c53724bcd472c62d3b1472e223
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear, M1 resolved; A-14062. Distinct content-keyed automatic harness corrections enter existing ordered/fenced lane, human/press keys preserved, stale repair uses current closure. Four native fake-HTTP delivered/held × deny/once controls retain persisted intent, two ordered edits and final native/archive assertions. C1/C2 runtime pending. Unchanged adapter/restart T3 coverage deferred, not claimed; no Reviewer executions.

### rev-31 · 2026-10-29T20:04:32.959Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1162-final1
commit: eafad02c5a7475c53724bcd472c62d3b1472e223
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, C1/C2 verified; A-14096 audit of original A-14087/result A-14093/selection A-14094. 4207 ordinary plus30 separate load passes, zero nonpass; six new exact identities each base+5/5, worst .430024893s. Durable archive/closed-frame/warn and native Telegram ordered correction assertions retained. T0/T1/allT2/mappedT4 once/Web complete; T3 codex-adapter/approval-restart absent and Coordinator broader cover remains separate. Report-only budget/lint warnings, host-gate reuse and actual Web4/task2 provenance retained. No Reviewer executions or extra task-head full run. QA none.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-29T20:11:09.685Z

Merged 359b43fb1686eba8c12199393848bf99841b6a27 onto dev.
