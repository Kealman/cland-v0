---
id: T-718
kind: task
title: Docs, glossary and role clauses describe tiers, the merge queue and the end of manual covers
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-713
topic: topic-547
branch: t/T-718-docs-glossary-and-role-clauses-describe
created: 2026-10-16T19:59:44.511Z
updated: 2026-10-19T04:46:35.307Z
closed: 2026-10-19T04:46:35.307Z
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

- [x] C1. `docs/agents/tests.md` has the "Tiers and the merge queue" section, and no passage in it still requires covers per batch or `all` for a second receipt.
  - done: impl-718 · 2026-10-19T03:27:19.106Z
  - verified: rev-30 [reviewer] · run rev-20261019-718-final · 2026-10-19T04:25:09.467Z · commit db2e5373a0614d6dedebdafd5be7d806cbbde2c8
- [x] C2. The merge skill describes enqueue, the queue listing, cancel and each queue refusal with who acts on it.
  - done: impl-718 · 2026-10-19T03:24:54.795Z
  - verified: rev-30 [reviewer] · run rev-20261019-718-final · 2026-10-19T04:25:09.467Z · commit db2e5373a0614d6dedebdafd5be7d806cbbde2c8
- [x] C3. `GLOSSARY.md` defines the six terms with _Avoid_ lines.
  - done: impl-718 · 2026-10-19T03:24:55.144Z
  - verified: rev-30 [reviewer] · run rev-20261019-718-final · 2026-10-19T04:25:09.467Z · commit db2e5373a0614d6dedebdafd5be7d806cbbde2c8
- [x] C4. The Coordinator, Implementer and Lead clauses carry the new lines, and `roles.test.ts` passes its byte-headroom check for every role.
  - done: impl-718 · 2026-10-19T03:57:48.160Z
  - verified: rev-30 [reviewer] · run rev-20261019-718-final · 2026-10-19T04:25:09.467Z · commit db2e5373a0614d6dedebdafd5be7d806cbbde2c8

## Comments

### impl-718 · 2026-10-19T03:24:47.529Z

Implemented the live queue/tier protocol across test guidance, merge skill, glossary, README and default/project role clauses. Host lint and typecheck pass; roles.test.ts passes 4/4 in 5.97 s, including every role's 512-byte reply headroom. The first local attempt caught an oversized Coordinator line; shortened it before review. No new process tests or waits added. QA policy is none/after-stage, so requesting source review then the required mode-free droplet verify.

### rev-30 · 2026-10-19T03:26:57.024Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-718-source
commit: 1c53237f2d67b9cb12f1339a2f26c3cd6adaf740
scope: full
findings: [{"severity":"medium","text":"M1: scenario instructions still require one task droplet execution, but queue-enabled task verification excludes every T3 scenario. Route that Linux evidence through an executing merge-batch or integrated-occasion receipt; retain any required isolated Mac repetitions and avoid implying a task pass proved excluded process behavior.","file":"docs/agents/tests.md","line":177}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. M1: scenario guidance at docs/agents/tests.md:177 still requires a T3 scenario to execute through task droplet verification, contradicting the new task tier cap and paragraph at 162. A mode-free task receipt cannot supply that process/Linux proof. Replace the superseded requirement with the actual batch/integrated-occasion evidence route while preserving applicable isolated Mac proof. A-5747 records both axes and otherwise positive protocol/clause/term audit. No criteria verified; fresh source review before verification.

Criteria: C1 failed (The guide retains a superseded per-task T3 scenario execution requirement incompatible with the documented task tier cap.).

### rev-30 · 2026-10-19T03:27:53.282Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-718-corrected-source
commit: eafa876f84042ce8ee4a165948a7cb1f0faef108
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M1 resolved. A-5749 supplements full audit A-5747: the one-sentence correction requires an executing Linux merge-batch/integrated-occasion receipt with file/head/tree/log attribution while retaining isolated Mac proof. No executable/test changes or dev merge; no remaining findings on either axis. C1–C4 await the accepted exact-head final evidence pass, including delivered clause byte-headroom checks; QA scope none.

### rev-30 · 2026-10-19T03:57:31.141Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-718-runtime
commit: eafa876f84042ce8ee4a165948a7cb1f0faef108
scope: evidence
findings: [{"severity":"medium","text":"M2: shortened Lead merge clause and its project counterpart no longer satisfy the category/unscheduled Coordinator ownership contract; roles-snapshot.test.ts:45 fails deterministically on the removed boundary wording. Preserve that boundary alongside queue guidance and retain its default/project regression controls.","file":"hub/src/roles/default-roles.ts","line":130}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear. A-5759 exit 1 has one task-owned clause snapshot failure; audit A-5760. M2: shortened Lead merge line drops the explicit category/unscheduled ownership wording pinned by roles-snapshot.test.ts:45. Restore the Coordinator boundary while retaining queue guidance and meaningful default/project assertions; audit other clause consumers. roles.test 4/4/headroom passes but does not override the failed gate. M1 remains resolved. No criteria verified; fresh source review before replacement verification.

Criteria: C4 failed (Exact-head gate fails the existing Lead category/unscheduled ownership snapshot after the task's clause rewrite.).

### impl-718 · 2026-10-19T03:57:33.583Z

Droplet a5eea758/A-5759 exposed the existing role snapshot's exact category/unscheduled merge-ownership guard. Reproduced with node --test --test-name-pattern='default and project clauses pin category filing' hub/test/roles-snapshot.test.ts (red in 0.32 s). Restored 'merges outside any Lead’s subtree, including categories and unscheduled items' in both default/project Lead clauses, preserving queue wording and the existing assertion. roles-snapshot.test.ts now 10/10 in 0.95 s; roles.test.ts 4/4 in 6.30 s including 512-byte headroom; npm run check and git diff --check pass. No dev merge after source review; fresh review before retry.

### rev-30 · 2026-10-19T03:58:18.853Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-718-ownership-source
commit: db2e5373a0614d6dedebdafd5be7d806cbbde2c8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Replacement source clear; M2 resolved, M1 remains resolved. A-5762 records both restored Lead ownership lines and pinned clause-reader audit. Existing roles-snapshot category/grant assertions unchanged; raw A-5761 has roles-snapshot 10/10 and roles 4/4 with delivered-clause headroom. No dev merge or other changes; no remaining findings. Previous failed gate A-5759 retained. C1–C4 await accepted exact-head replacement runtime; QA scope none.

### rev-30 · 2026-10-19T04:25:09.467Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-718-final
commit: db2e5373a0614d6dedebdafd5be7d806cbbde2c8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear from source A-5747/A-5749/A-5762 and accepted replacement gate a42107e7/A-5768; audit A-5770. M1/M2 resolved, failed A-5759 retained. Actual hub-only plus Neovim smoke: 2398 pass, 5 skip, zero fail/cancel. roles.test 4/4 with delivered default/project clause headroom and roles-snapshot 10/10 including formerly failing ownership/grant assertion. Source establishes protocol plans/refusal ownership and all six glossary terms. No role repetition group is claimed. Three known T-803 report-only trips and other diagnostics disclosed. No findings; C1–C4 verified; QA scope none.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-19T04:46:35.307Z

Merged 7582d5e61f0ed28f775e549b2bffdfe1ad0935bd onto dev.
