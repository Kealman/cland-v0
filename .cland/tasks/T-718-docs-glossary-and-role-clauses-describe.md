---
id: T-718
kind: task
title: Docs, glossary and role clauses describe tiers, the merge queue and the end of manual covers
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-713
topic: null
branch: null
created: 2026-10-16T19:59:44.511Z
updated: 2026-10-16T20:00:13.501Z
---

## Summary

Once T-713 switches the protocol, the crew's instructions must match it. Covers per three merges, verify before merge as the gate, and `all` for a second receipt all change. Role clauses have a tight byte budget (`roles.test.ts` keeps 512 bytes of headroom below the send cap), so the clauses get one line each and the detail goes to `docs/agents/tests.md` and the merge skill. The Implementer and Reviewer skill rules (memo §5.3–5.4) are the Coordinator's and are not part of this ticket.

## What to build

- **`docs/agents/tests.md`** gets a "Tiers and the merge queue" section ahead of today's run mechanics: the four tiers with their isolation and budgets, what each run kind plans, the merge queue, batch, bisection and its refusals, and the nightly soak. Superseded passages go: covers per batch, `all` for the flaky gate, the per-task Neovim smoke.
- **The merge skill** (`.agents/skills/merge/SKILL.md`) describes the mechanics: enqueue and `queued <n>`, `cland merge queue`, `--cancel`, what `merge-bisected`, `merge-bisect-unresolved`, `merge-conflict` and `merge-budget` mean, and who acts on each.
- **`GLOSSARY.md`** gains Tier, Merge queue, Batch, Scenario, Contract file and Soak, each with an _Avoid_ line in the file's style.
- **Role clauses** (`hub/src/roles/default-roles.ts`). The Coordinator's cover-per-batch line becomes one line on the queue. The Implementer's verify line says task runs are T0–T2 and T3 lands in the batch. The Lead's merge line says merges enqueue.
- **`hub/README.md`** (Tests) is updated to match.

## Acceptance criteria

- [ ] C1. `docs/agents/tests.md` has the "Tiers and the merge queue" section, and no passage in it still requires covers per batch or `all` for a second receipt.
- [ ] C2. The merge skill describes enqueue, the queue listing, cancel and each queue refusal with who acts on it.
- [ ] C3. `GLOSSARY.md` defines the six terms with _Avoid_ lines.
- [ ] C4. The Coordinator, Implementer and Lead clauses carry the new lines, and `roles.test.ts` passes its byte-headroom check for every role.
