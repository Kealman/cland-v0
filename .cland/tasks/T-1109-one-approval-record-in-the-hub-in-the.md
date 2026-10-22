---
id: T-1109
kind: task
title: One approval record in the hub, in the snapshot and the deltas
state: closed
status: done
size: M
criterion_seq: 9
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by: []
topic: topic-851
branch: t/T-1109-one-approval-record-in-the-hub-in-the
created: 2026-10-22T15:16:11.019Z
updated: 2026-10-22T15:55:59.715Z
closed: 2026-10-22T15:55:59.715Z
---

## Summary

Give every pending command approval one record in the hub, carried in the snapshot and the deltas. Claude Code's records are marked to be answered in its TUI, and `cland inbox` prints the records.

## Parent

E-414 (§3.4 "One gate for answers", §3.8; tracer step 1).

## What to build

An approval becomes a record the hub holds, one per pending harness request: a Codex server request, an OpenCode permission, or a Claude Code permission prompt. Its id stays the same for the life of the request. The id is the harness's own request id, or for Claude Code, which has none, the session and its waiting episode. Today's inbox rows are one per session, derived from `waiting for approval`. They become these records, and they keep their present fields (id, session, label, harness, since, attach, command), so the Neovim and web clients keep working. The record's shape (a decision, trimmed):

```ts
type ApprovalChoice = 'once' | 'always' | 'deny';
type ApprovalOutcome = { choice: ApprovalChoice | 'answered in the harness' | 'withdrawn'; note?: string; by: string; via: 'neovim' | 'web' | 'harness'; at: string };
type ApprovalRecord = {
  id: string; session: string; sessionId: string; role?: string; label: string; harness: string | null;
  kind: 'command' | 'file change' | 'other';
  subject: { command?: string; cwd?: string; reason?: string; files?: string[]; change?: string };
  choices: ApprovalChoice[];   // what the harness offers; empty when answerIn is 'tui'
  answerIn: 'hub' | 'tui';     // 'tui': Claude Code, or a relay that fell back to none
  attach: string | null; since: string; topic?: string;
  state: 'pending' | 'answering' | 'closed';
  outcome?: ApprovalOutcome;
};
```

The adapter contract gains two host callbacks: one through which an adapter reports a request, and one through which it reports the request's close with the outcome the harness gave. An adapter that reports no requests gets one record per waiting session, built from its `waiting for approval` state and approval command, with `answerIn: 'tui'` and no choices. This fallback covers Claude Code always, and Codex and OpenCode until their relays land. The in-process fake adapter gains a way to raise and close a request, so tests can drive both paths without a harness.

The records ride in the snapshot's inbox section. Each change pushes an `approval` delta carrying the record, beside the inbox delta, so the cards of E-417 and E-418 can follow one record. The needs-you count counts each pending record once. A closed record folds to its outcome and leaves the inbox for the inbox archive by the answered ask's rule, with its outcome stored. The subject carries only the command, cwd, reason and file change, never other tool input. `cland inbox` prints each approval with its state and either its choices or "answer in Neovim", and a closed one with its outcome. Neovim's approval row keeps ↵ to attach. Refresh the Neovim recordings that carry the inbox.

## Acceptance criteria

- [x] C1. A frame client that connects while a fake Claude Code session waits for approval reads exactly one record in the snapshot: the session, the harness, the command in full, `answerIn: tui`, no choices and `pending` (test).
  - done: impl-1109 · 2026-10-22T15:43:40.745Z
  - verified: rev-31 [reviewer] · run rev-20261022-1109-final · 2026-10-22T15:49:45.223Z · commit 1114749545a2f400a65822f0994528a33e4d9d3b
- [x] C2. A request raised by a fake adapter through the contract reaches a connected frame client as one `approval` delta and one inbox row with its choices. Its close reaches the client as a delta with the outcome and `closed` (test).
  - done: impl-1109 · 2026-10-22T15:30:52.403Z
  - verified: rev-31 [reviewer] · run rev-20261022-1109-final · 2026-10-22T15:49:45.223Z · commit 1114749545a2f400a65822f0994528a33e4d9d3b
- [x] C3. Two pending requests of one session are two records, and needs-you counts each once (test).
  - done: impl-1109 · 2026-10-22T15:30:52.638Z
  - verified: rev-31 [reviewer] · run rev-20261022-1109-final · 2026-10-22T15:49:45.223Z · commit 1114749545a2f400a65822f0994528a33e4d9d3b
- [x] C4. A closed record leaves the inbox for the inbox archive with its outcome, who answered and when (test).
  - done: impl-1109 · 2026-10-22T15:30:52.748Z
  - verified: rev-31 [reviewer] · run rev-20261022-1109-final · 2026-10-22T15:49:45.223Z · commit 1114749545a2f400a65822f0994528a33e4d9d3b
- [x] C5. The fake harnesses' private tool input never reaches a frame through a record (test).
  - done: impl-1109 · 2026-10-22T15:30:52.875Z
  - verified: rev-31 [reviewer] · run rev-20261022-1109-final · 2026-10-22T15:49:45.224Z · commit 1114749545a2f400a65822f0994528a33e4d9d3b
- [x] C6. `cland inbox` prints each approval's state and either its choices or "answer in Neovim", and `cland inbox --archive` prints a closed record's outcome (test).
  - done: impl-1109 · 2026-10-22T15:30:53.137Z
  - verified: rev-31 [reviewer] · run rev-20261022-1109-final · 2026-10-22T15:49:45.224Z · commit 1114749545a2f400a65822f0994528a33e4d9d3b
- [x] C7. In headless Neovim on recorded frames, ↵ on a Claude Code approval row still attaches the session (test).
  - done: impl-1109 · 2026-10-22T15:30:53.298Z
  - verified: rev-31 [reviewer] · run rev-20261022-1109-final · 2026-10-22T15:49:45.224Z · commit 1114749545a2f400a65822f0994528a33e4d9d3b
- [x] C8. The Neovim recordings that carry the inbox are refreshed with `npm run test:nvim-fixtures`, and each file's frame count change is listed in the item topic (test).
  - done: impl-1109 · 2026-10-22T15:30:53.404Z
  - verified: rev-31 [reviewer] · run rev-20261022-1109-final · 2026-10-22T15:49:45.224Z · commit 1114749545a2f400a65822f0994528a33e4d9d3b
- [x] C9. `hub/README.md` describes the approval record. Its Claude Code capability row says approvals stay in the TUI and their records are marked to answer in Neovim (docs).
  - done: impl-1109 · 2026-10-22T15:30:53.652Z
  - verified: rev-26 [reviewer] · run rev-20261022-1109-source-1 · 2026-10-22T15:35:44.798Z · commit a08cf6c5fa70615ed4c435b49a9b09b6e2df95fe
  - verified: rev-31 [reviewer] · run rev-20261022-1109-delta · 2026-10-22T15:39:43.066Z · commit 1114749545a2f400a65822f0994528a33e4d9d3b
  - verified: rev-31 [reviewer] · run rev-20261022-1109-final · 2026-10-22T15:49:45.224Z · commit 1114749545a2f400a65822f0994528a33e4d9d3b

## Comments

### impl-1109 · 2026-10-22T15:28:57.466Z

Implemented test-first at the epic's frame/recorded-client seams: explicit native request/close callbacks, scoped request records and deltas, TUI fallback, needs-you per request, allowlisted 64 KiB UTF-8 subjects, durable archived outcome, CLI state/choices/outcomes, and recorded Neovim Enter attachment. Coordinator confirmed sessionId:nativeRequestId (6b74c26b); reconnect mapping belongs to T-1113. Targeted T2 frame tests 7/7 and snapshot tests 12/12, existing inbox component tests 10/10 on macOS working tree. Recording refresh counts posted in the item topic. Final check/review preparation underway; no full verification yet.

### rev-26 · 2026-10-22T15:35:44.798Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1109-source-1
commit: a08cf6c5fa70615ed4c435b49a9b09b6e2df95fe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; A-9227 audits fixedf35f5e2b→a08cf6c5/tree58710d5d. Standards0;Spec0. Request records, session-scoped native ids per Coordinator6b74c26b, state-only TUI fallback, duplicate suppression, exact close deltas/durable outcomes, counts,64KiB UTF-8 allowlisted subjects, CLI and recorded Enter→session.attach coexist at existing seams. Reconnect/race recovery remainsT-1113; no native relay/answer gate claim. C9 source verified: record and Claude capability docs match. Committed aggregate5659→5662/newinbox-actions0→61 independently counted; A-9208/A-9214 local working-tree execution narratives supporting only, raw receipts requested without reruns. C1–C8 remain run/evidence dependent. Submit mode-free verification at unchangeda08cf6c5, retain original recording/targeted receipts; changed head needs source review, after-stage QA separate.

Criteria: C9 verified.

### rev-31 · 2026-10-22T15:39:43.066Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1109-delta
commit: 1114749545a2f400a65822f0994528a33e4d9d3b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear, A-9238; no findings. Prior full source baseline is rev-26/A-9227 at a08cf6c5. Coordinator da3c70d4 authorizes merge; only non-tracker delta is web/test/items.test.ts, identical to shared eacb0e27. Seeded planned epic under current copied release preserves stage/meter/child/scope assertions after E-416 closure. T-1109 product/tests/recordings/docs unchanged; C9 carried forward. A-9232 local receipts retain working-tree/source and post-check-edit limits; they are not new-head configured evidence. C1–C8 await same-head mode-free verification; no merge authorization.

Criteria: C9 verified.

### rev-31 · 2026-10-22T15:42:21.538Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261022-1109-unavailable
commit: 1114749545a2f400a65822f0994528a33e4d9d3b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

9526c1e7/A-9243 not clear: c-8 unavailable in lon1/nyc1/sfo2, no behavioral phase, platform/counts unavailable. Source A-9238/C9 remains current; no code finding. A-9246 corrects A-9245's over-expanded authority id and is authoritative. Already admitted Coordinator-authorized local46db9b0c remains pending; no duplicate requested. Restore C1 claimant mark with evidence before final settlement; no merge authorization.

Criteria: C1 failed (Required configured gate incomplete: 9526c1e7 executed no phase because c-8 unavailable; no functional C1 failure established.).

### rev-31 · 2026-10-22T15:49:45.224Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1109-final
commit: 1114749545a2f400a65822f0994528a33e4d9d3b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear A-9257, all nine criteria verified, no findings. Unchanged reviewed11147495: authorized local46db9b0c/A-9256 exits0,2454/2454,zero fail/cancel/skip,T0/T1/all-T2/Web complete. Seven new approval identities plus recorded Neovim Enter each have five distinct raw load-gate passes and explicit5/5. C8 original maintenance exits/counts in A-9232/A-9208 qualified by working-tree provenance; committed counts independently checked. A-9247 is authoritative corrected capacity note, superseding A-9245/mistyped A-9246 reference. Local darwin arm64 workers4/Web2, no Linux claim; report-only diagnostics, deferred T3/T4 and separate stage QA retained. No merge enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified.

### coord · 2026-10-22T15:55:59.715Z

Merged 4ce407b95ff6a24e8d2c99f45f22d72b8fea7f0f onto dev.
