---
id: T-1109
kind: task
title: One approval record in the hub, in the snapshot and the deltas
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by: []
topic: topic-851
branch: t/T-1109-one-approval-record-in-the-hub-in-the
created: 2026-10-22T15:16:11.019Z
updated: 2026-10-22T15:28:57.466Z
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

- [ ] C1. A frame client that connects while a fake Claude Code session waits for approval reads exactly one record in the snapshot: the session, the harness, the command in full, `answerIn: tui`, no choices and `pending` (test).
- [ ] C2. A request raised by a fake adapter through the contract reaches a connected frame client as one `approval` delta and one inbox row with its choices. Its close reaches the client as a delta with the outcome and `closed` (test).
- [ ] C3. Two pending requests of one session are two records, and needs-you counts each once (test).
- [ ] C4. A closed record leaves the inbox for the inbox archive with its outcome, who answered and when (test).
- [ ] C5. The fake harnesses' private tool input never reaches a frame through a record (test).
- [ ] C6. `cland inbox` prints each approval's state and either its choices or "answer in Neovim", and `cland inbox --archive` prints a closed record's outcome (test).
- [ ] C7. In headless Neovim on recorded frames, ↵ on a Claude Code approval row still attaches the session (test).
- [ ] C8. The Neovim recordings that carry the inbox are refreshed with `npm run test:nvim-fixtures`, and each file's frame count change is listed in the item topic (test).
- [ ] C9. `hub/README.md` describes the approval record. Its Claude Code capability row says approvals stay in the TUI and their records are marked to answer in Neovim (docs).

## Comments

### impl-1109 · 2026-10-22T15:28:57.466Z

Implemented test-first at the epic's frame/recorded-client seams: explicit native request/close callbacks, scoped request records and deltas, TUI fallback, needs-you per request, allowlisted 64 KiB UTF-8 subjects, durable archived outcome, CLI state/choices/outcomes, and recorded Neovim Enter attachment. Coordinator confirmed sessionId:nativeRequestId (6b74c26b); reconnect mapping belongs to T-1113. Targeted T2 frame tests 7/7 and snapshot tests 12/12, existing inbox component tests 10/10 on macOS working tree. Recording refresh counts posted in the item topic. Final check/review preparation underway; no full verification yet.
