---
id: T-791
kind: task
title: A verify submitter that disconnects during admission loses its run without any durable receipt
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-770
topic: topic-500
branch: t/T-791-a-verify-submitter-that-disconnects
created: 2026-10-18T09:26:02.167Z
updated: 2026-10-18T09:31:01.390Z
---

## Summary

Found by impl-788 on 2026-10-18. Suite admission calls `authorize()` again after candidate inspection. For a CLI or MCP submitter it uses `callerNow()`, which is tied to the live connection, and the socket's `closed()` clears that connection. When admission outlasts the client (the 15 s CLI deadline, a busy hub), the second check refuses with "suite caller identity is unavailable". The refusal goes only as a result frame to the closed peer, so no run and no receipt exist anywhere. impl-642 lost two T-642 submissions this way at 09:23Z and 09:25Z, and T-634 at about 09:24Z. An identical timeout at 09:04Z (T-787) still produced a run.

## Acceptance criteria

- [ ] C1. A T2 test closes the submitting connection mid-inspection. Admission then either completes, with its receipt posted to the requested report topic, or refuses, with the refusal posted durably to that topic and journaled. The run never vanishes silently. The test fails before the fix.
- [ ] C2. Identity for the post-inspection check comes from the identity captured at submission. A session whose role or claim was revoked during admission is still refused, durably.
- [ ] C3. The "connection closed before the answer" audit line and the admission outcome line are distinguishable in the journal.

## Comments

### impl-791 · 2026-10-18T09:31:01.390Z

Implemented captured-identity reauthorization in dispatch.ts without changing Suites or SuiteCandidate. Added hub-authored verification-submission receipts/refusals to the report topic and journal, distinct from the transport-close audit. T2 suite-admission-close.test.ts was red before the fix on both CLI and MCP missing-receipt assertions; green afterward (5 cases, 1.293 s): disconnect admission on both paths, revoked role, revoked claim/assignee, candidate refusal. Reopens the Store to prove message persistence. Initial fetch/test:lint/typecheck passed; final checks underway. No per-item QA scope/brief required by task view.
