---
id: T-1726
kind: task
title: The Lead role clause names automatic host pushes, as E-1532's Contents promise
state: closed
status: done
size: XS
criterion_seq: 1
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1572
branch: t/T-1726-the-lead-role-clause-names-automatic
created: 2026-11-06T16:26:33.070Z
updated: 2026-11-17T00:32:28.404Z
closed: 2026-11-17T00:32:28.404Z
---

## Summary

E-1532's Contents say that both the Implementer and the Lead clause tell sessions that commits on a host are pushed automatically, so a session doesn't push by hand. qa-678's Definition-of-done run (E1532D-02 at 6f0cf6ae) found the Implementer clause says it, but the Lead clause in `hub/src/roles/default-roles.ts` has no line about it. It's low severity: C7 is met by the product behaviour and the tests.

## What to build

One line in the Lead role clause stating that commits on a host reach the territory without a manual push, and that `verify` and `ready` flush first. Role clauses are near their byte reserve, so tighten an existing line rather than adding one if needed. Update any clause snapshot or byte-budget test.

## Acceptance criteria

- [x] C1. The Lead clause in default-roles.ts states that host commits are pushed automatically, and the clause byte-budget test passes (test).
  - done: impl-1726 · 2026-11-16T22:17:08.668Z
  - verified: rev-35 [reviewer] · run rev-35-1726-final-1 · 2026-11-16T23:29:00.555Z · commit 0633c4d7ad382e15e11bc564b7c16987efb2b6be

## Comments

### impl-1726 · 2026-11-16T22:16:21.832Z

Consumer inventory before edits (rule 20): searched exact Lead work-location line, host push/flush wording, default-roles/DEFAULT_ROLES_TOML and roleClauseSections across hub, nvim, web, shared, docs, shipped skills and qa (all tiers included). Production: roles/config.ts parses defaults; roles/template.ts generates new projects; roles/clause.ts renders; hub/core.ts delivers. Tests: roles-clauses T1 pins wording/budget for defaults and retained project roles; roles-template, roles-snapshot, roles-snapshot-cli, roles-component, roles T3, lead-handover, roles-launch-permissions and permission/adaptor consumers use generated definitions, not the missing line. QA: E-1532.md E1532D-02 counts the exact phrase 'On hosts cland pushes' in Lead; preserve it. host-agent.md Publication admission and implement SKILL.md already describe automatic push/flush correctly. Other QA/default-role readers retain shape/permissions; no wire/schema/persisted shape changes. Existing .cland/roles.toml is deliberately retained project configuration; document opt-in clause edit rather than changing project policy. Coordinator resolved launch wording conflict in favor of tracker scope.

### rev-36 · 2026-11-16T22:20:39.734Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1726-source-1
commit: 8eace093aac73f8807c8c19cceb7e55fadd3f56e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 8eace093aac73f8807c8c19cceb7e55fadd3f56e. Standards: no remaining findings; pure T1 wording and unchanged default/project byte-reserve checks are appropriate, and the replacement per-test guide resolves the default-only adoption clarification. Spec: automatic host commit publication, no manual push and verify/ready flush are present while root/container semantics remain; retained project roles are opt-in as documented. Full review A-20410; local parent-source summaries/excerpts A-20407/A-20408 retain their provenance limits and are not full verification. C1 wording/test design established by source; its run-dependent confirmation remains unverified pending same-head evidence or an explicit Coordinator waiver disposition. No tests/probes run by Reviewer.

### impl-1726 · 2026-11-16T22:42:33.928Z

Verification 1bc2a3c8 at reviewed 8eace093a failed solely inherited hub-priority.test.ts test attributed by Coordinator to T-1923; A-20430. Actual assertion: no check named hub priority (doctor-fixture.ts:74; hub-priority.test.ts:41). T0/T1 completed exit0; T2 exit1; T3/Web did not execute. Linux x64 droplet c-8 sfo2 Node24.21.0, lifetime1108s $0.0770. Partial failure is not readiness evidence. Holding head unchanged until Coordinator authorizes one dev merge after shared fix, delta review and retry.

### rev-35 · 2026-11-16T22:45:18.320Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1726-delta-1
commit: 0633c4d7ad382e15e11bc564b7c16987efb2b6be
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Shared-fix delta source clear A-20437. Coordinator8276be9b exact cherry-pick authorization checked; independent full diff equality confirms only the3-file15757e4d4 patch, no dev merge/unrelated edit. Priority fixture shares native identity before sealed environment replacement, preserves all warnings and adds local-holder check; guide/index match posted fix. Original Lead automatic publication/flush/no-manual-push wording, role byte-budget/growth assertions and opt-in retained-project docs unchanged from rev-36's A-20410 full source clear; ownership handoff94e8f7cf retained. A-20433 original localMac1/1/exit0 and typecheck0 excerpts qualified; old1bc2a3c8/A-20430 remains failed/incomplete, not0633runtime evidence. C1done/unverified, no final criteria mark. No docs-only waiver per Coordinator777d66db. Hold released; obtain new Coordinator window for one mode-free verify at0633 then same-head evidence settlement. No Reviewer runtime.

### impl-1726 · 2026-11-16T23:25:22.226Z

Exact reviewed head 0633c4d7ad382e15e11bc564b7c16987efb2b6be remains clean. Retry e1aeac7c / A-20456 exited0: 6523/6523 pass, no fail/cancel/skip. T0, T1, fallback all T2, mapped hub/test/roles.test.ts T3 (4 identities), Web completed. No remaining T3/T4 or stage QA claim. Required generated cases `defaults lead: clause reply keeps the byte reserve` and `defaults lead: shipped clause wording` have recorded pass finish receipts (A-20456 lines5974/5979), beyond aggregate exit status. Linux x64 droplet c-8 sfo2 Node24.21.0/Neovim0.12.5, Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4. Noncached; timing budgets/test lint/T3 ratchet report-only, 7 missing duration baselines retained. Truncated delivered summary omits droplet lifetime/cost, unavailable here rather than inferred. Reviewer receives same-head result for final evidence settlement.

### rev-35 · 2026-11-16T23:29:00.555Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1726-final-1
commit: 0633c4d7ad382e15e11bc564b7c16987efb2b6be
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear A-20458. A-20456 independently records6523 ordinary test passes/708 file passes,0fail/cancel/skip; separate240 load passes. Required defaults Lead byte-reserve and shipped-wording cases5974/5979 pass, as do project Lead6069/6074 and all39 roles-clauses cases; unchanged source assertions retain reserve/growth limits. Source basis A-20410+A-20437 preserves automatic host push/no manual push/verify-ready flush and retained-project opt-in scope. T0/T1/fallback allT2/selected rolesT3 (4 identities once)/Web complete; remaining268T3/17T4 unexecuted. Exact0633 head and normalized runner tree/provenance checked; Linuxx64 droplet Node24.21/Nvim0.12.5, actual isolated HeadlessShell1248/CfT156.0.8078.4. Report-only budgets/lint/ratchet and original source-linkage/raw-stream limits retained; old1bc2a3c8/A-20430 stays failed/incomplete. No additional host publication runtime proof or completeT3 claim. C1verified, no findings; hold released. No Reviewer runtime.

Criteria: C1 verified.

### coord · 2026-11-17T00:32:28.404Z

Merged 5657450ed04a2cacc84e386a9d50f3e7f6b20ae5 onto dev.
