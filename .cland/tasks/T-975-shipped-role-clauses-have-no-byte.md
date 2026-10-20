---
id: T-975
kind: task
title: "Shipped role clauses have no byte headroom: trim them to pointers (or re-derive the reserve) before v0.2 adds clause lines"
state: open
status: backlog
size: S
labels:
  - needs-triage
  - tech-debt
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: null
created: 2026-10-20T15:38:57.185Z
updated: 2026-10-20T15:38:57.185Z
---

## Summary

T-955's T1 guard holds each shipped role clause to a 7680-byte reserve (512 bytes below the 8192-byte send cap). During the v0.1.5 sweep, T-561, T-794, T-956, T-957, T-958 and T-962 each had to shorten clause lines, and two merge batches went red on the reserve. The Coordinator and QA clauses are now near the reserve, and the Implementer clause has 373 bytes of headroom. v0.2's epics will need clause lines too.

## What to build

Move procedural detail out of the shipped clauses into the skills and docs they already point to, so each clause keeps at least 15 % headroom under the reserve. Keep every rule and permission statement the clause owns. Alternatively, re-derive the reserve from the actual send cap and envelope size if 512 bytes of slack is more than needed, with the reasoning in the evidence.

## Acceptance criteria

- [ ] C1. Every shipped clause (defaults and project) has at least 15 % headroom under its reserve in roles-clauses.test.ts, or the reserve change is reasoned and tested against the send cap.
- [ ] C2. Each removed line is either a pointer kept in the clause or text moved verbatim into the skill or doc it now lives in (assertion map in the evidence).
