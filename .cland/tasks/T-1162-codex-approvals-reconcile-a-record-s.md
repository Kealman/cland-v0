---
id: T-1162
kind: task
title: "Codex approvals: reconcile a record's outcome with the item's execution when a TUI answer races the hub's write"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1219
branch: t/T-1162-codex-approvals-reconcile-a-record-s
created: 2026-10-23T02:33:54.189Z
updated: 2026-10-29T19:32:00.214Z
---

## Summary

T-1113 (2026-10-23 02:33Z) found a protocol limit: Codex's `serverRequest/resolved` carries only the request and thread ids, and the app-server client's `respond` confirms only the socket write. A remote TUI answer whose resolution arrives after the hub's write succeeded cannot be told from the hub's own echo, so the record reads the hub's choice. T-1113 handles the observable case (resolution before the write receipt is the harness's win) and documents the residue in hub/README.md.

## What to build

Where Codex later reports the item's execution (for example a command that runs after the hub sent Deny, or is declined after the hub sent Approve), the hub reconciles the record's outcome to "answered in the harness" with a warn event, and never infers consent.

## Acceptance criteria

- [ ] C1. Through the scripted app-server, a hub Deny followed by a resolution and then the command's execution reads as answered in the harness with a warn-level event (test).
- [ ] C2. A hub Approve followed by the item's declined completion reads as answered in the harness (test).

## Comments

### impl-1162 · 2026-10-29T19:32:00.214Z

Consumer inventory before changing reconciliation semantics (rule 20): Codex NativeApproval and item notifications; AdapterHost approvalClosed in sessions.ts and OpenCode (retain existing semantics, add optional correction hook); InboxService pending/answer/archive and Store inbox_departures; wire ApprovalOutcome and approval deltas (unchanged shape); CLI inbox; Web ApprovalCard/inbox live/archive; Neovim inbox live/archive; gateway cards.ts, Telegram cards, Discord cards/outbox. Existing clients already accept harness outcomes; correction reuses closed approval delta and updates existing archive row, without adding a departure. Test consumers: codex-native T2, codex-adapter T3, approval-records T2, approval-restart T3, telegram-approvals T2, Web inbox/phone-approvals, Neovim inbox recorded fixtures, wire conformance; QA E-414 stage-1, shipped implement skill and native test guide. Startup probes do not consume approval outcomes; persisted pending records unaffected. Preserve previous wire shapes and optional callbacks. Agreed seam is scripted app-server notifications plus real frame clients, no platform or harness credentials.
