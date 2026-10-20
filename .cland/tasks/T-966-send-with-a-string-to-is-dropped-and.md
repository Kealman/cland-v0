---
id: T-966
kind: task
title: send with a string `to` is dropped and refused as a human send; accept a single recipient string or refuse with "to must be an array"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
  - bug
assignee: null
parent: E-952
blocked_by: []
topic: topic-742
branch: t/T-966-send-with-a-string-to-is-dropped-and
created: 2026-10-20T11:58:34.363Z
updated: 2026-10-20T12:16:02.095Z
closed: 2026-10-20T12:16:02.095Z
---

## Summary

On 2026-10-20 at least six Implementer sessions (impl-954, impl-959, impl-950, impl-961, impl-965 and one more) called `send` with `to` as a string, for example `"coordinator"`, instead of an array. The MCP layer dropped the field. The hub then treated the call as a send to the human and refused it as `send:human`. Each session had to stop, diagnose and resend, and every refusal shows up in the human's Agents topic as a permission event.

## What to build

`send` accepts `to` as a single string and normalizes it to a one-element array, matching how a single recipient is usually written. Any other wrong shape is refused with a clear validation error naming the field, never reinterpreted as a human-directed send. The tool schema and its description say `string | string[]`.

## Acceptance criteria

- [x] C1. A `send` with `to: "coordinator"` delivers to the Coordinator exactly as `to: ["coordinator"]` does (T1 test at the MCP/schema seam).
  - done: impl-966 · 2026-10-20T12:04:29.772Z
  - verified: rev-23 [reviewer] · run rev-20261020-966-final · 2026-10-20T12:13:09.915Z · commit f70fa266f4f3bcdae8ece7b78a9dbcaacb46b717
- [x] C2. A `send` with a malformed `to` (number, object) is refused with "to must be a string or an array of strings", not as send:human.
  - done: impl-966 · 2026-10-20T12:04:30.554Z
  - verified: rev-23 [reviewer] · run rev-20261020-966-final · 2026-10-20T12:13:09.915Z · commit f70fa266f4f3bcdae8ece7b78a9dbcaacb46b717

## Comments

### impl-966 · 2026-10-20T12:04:29.752Z

Implemented recipient normalization shared by MCP, authorization and core. The published send.to schema accepts string | string[]; malformed shapes return the exact field validation error before permission classification. Added T1 schema/input/core routing tests and T2 MCP/direct-dispatch regressions; docs, instructions, implement skill metadata and role clauses updated. Merged freshly fetched origin/dev (T-950) before review; pushed head f70fa266f4f3bcdae8ece7b78a9dbcaacb46b717. Targeted T1/T2 files: 33/33 passed on Darwin local at that head; these are targeted receipts, not full verification. npm run check pending completion.

### rev-23 · 2026-10-20T12:05:55.898Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-966-source
commit: f70fa266f4f3bcdae8ece7b78a9dbcaacb46b717
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Shared string|array schema and normalizer preserve recipient semantics; spoke and raw dispatcher validate before permission classification, and core defends direct callers. Malformed values return exact field error, omitted/[] retain send:human permission. T1/T2 regression seams compare delivery, exact invalid-shape errors and no stored invalid message. Docs/instructions/skill/clauses match. A-7600 records full source review; A-7598 local33/check are supplemental, not task gate/load evidence. C1/C2 verification pending normal mode-free same-head run. No item QA. Reviewer ran no tests.

### rev-23 · 2026-10-20T12:13:09.915Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-966-final
commit: f70fa266f4f3bcdae8ece7b78a9dbcaacb46b717
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7613 audits exact-head A-7612/run d58e790a: 2060/2060 ordinary tests; all three new recipient validation identities pass 5/5 load repetitions. C1 string/array Coordinator delivery and C2 exact malformed-shape errors before human-send permissions established at schema/core/MCP/direct dispatcher seams. Omitted/[] permission semantics retained. Linux T1/all-T2 includes Neovim; T3/T4 deferred. Host check 7393936b not repeated; lint/budgets/ratchet report-only, twelve missing baselines/incomplete timing not passes. No item QA.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T12:16:02.095Z

Merged c57a2c4e0f8c5c8d145642cb6e2de18f5bfa7c2a onto dev.
