---
id: T-1726
kind: task
title: The Lead role clause names automatic host pushes, as E-1532's Contents promise
state: open
status: review
size: XS
criterion_seq: 1
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1572
branch: t/T-1726-the-lead-role-clause-names-automatic
created: 2026-11-06T16:26:33.070Z
updated: 2026-11-16T22:20:39.734Z
---

## Summary

E-1532's Contents say that both the Implementer and the Lead clause tell sessions that commits on a host are pushed automatically, so a session doesn't push by hand. qa-678's Definition-of-done run (E1532D-02 at 6f0cf6ae) found the Implementer clause says it, but the Lead clause in `hub/src/roles/default-roles.ts` has no line about it. It's low severity: C7 is met by the product behaviour and the tests.

## What to build

One line in the Lead role clause stating that commits on a host reach the territory without a manual push, and that `verify` and `ready` flush first. Role clauses are near their byte reserve, so tighten an existing line rather than adding one if needed. Update any clause snapshot or byte-budget test.

## Acceptance criteria

- [x] C1. The Lead clause in default-roles.ts states that host commits are pushed automatically, and the clause byte-budget test passes (test).
  - done: impl-1726 · 2026-11-16T22:17:08.668Z

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
