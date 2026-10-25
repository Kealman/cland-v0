---
id: T-1230
kind: task
title: Role clause assembly scans skills with readdirSync on every hello
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - bug
  - needs-triage
  - qa-found
assignee: null
parent: E-1280
blocked_by: []
topic: topic-1030
branch: t/T-1230-role-clause-assembly-scans-skills-with
created: 2026-10-24T10:46:04.079Z
updated: 2026-10-25T10:22:14.037Z
---

## Summary

The hub scans role skills synchronously on every hello: `projectSkills` calls `readdirSync` (hub/src/roles/skills.ts) via `ProjectConfiguration.availableSkills` → `HubCore.roleInstructions` → `#recordClause`. A blocking directory scan sits on the connection path of every session. impl-1220 found it while writing T-1220's guard against synchronous filesystem calls (M2). The source is unchanged from dev.

## Acceptance criteria

- [x] C1. Role clause assembly on hello does no synchronous filesystem I/O; skills are scanned asynchronously or cached and invalidated on change (test).
  - done: impl-1230 · 2026-10-25T10:05:02.068Z
  - verified: rev-26 [reviewer] · run rev-20261025-1230-final-1 · 2026-10-25T10:22:13.916Z · commit f1b2c5de1b674b585bf99b775ae334ee795ec546
- [x] C2. The synchronous-filesystem guard from T-1220 covers the role-bearing hello path without exemptions (test).
  - done: impl-1230 · 2026-10-25T10:05:02.158Z
  - verified: rev-26 [reviewer] · run rev-20261025-1230-final-1 · 2026-10-25T10:22:13.916Z · commit f1b2c5de1b674b585bf99b775ae334ee795ec546

## Comments

### impl-1230 · 2026-10-25T10:02:31.255Z

Consumer inventory before caching: hub/core.ts roleInstructions consumes availableSkills for hello, role assignment/handover and adapter launch/brief construction; daemon.ts uses ProjectConfiguration; RolesFile is retained by roles-snapshot, roles-session-refresh, roles-snapshot-cli and roles-timing fixtures. doctor/project.ts consumes synchronous projectSkills/isSkill only outside serving. Existing role protocol frame and role.list definitions stay unchanged; no client wire migration. Searched hub/src/bin/test, web/test, nvim/test, docs, .agents/skills and qa: roles-component public clause/launch regression needs a published refresh receipt after inventory edits; session-credential-io must use production configuration; snapshot tests need cached source coverage. Other clients/briefs consume unchanged skill lists and require no migration. A-11669 confirms both configuration.ts and roles/config.ts paths. Red local macOS (no browser): session-credential-io 4/7 passed, 3 failed: guarded `readdirSync` stack runs projectSkills -> ProjectConfiguration.availableSkills -> HubCore.roleInstructions -> #recordClause -> hello; first clause lost all expected skills under the guard. This is the target defect, not a shared-defect candidate.

### rev-26 · 2026-10-25T10:07:31.608Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1230-source-1
commit: f1b2c5de1b674b585bf99b775ae334ee795ec546
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; A-11676, Standards0/Spec0 findings. Both serving sources initialize/refresh async skill inventory and availableSkills reads cache; updates replace snapshots, preserve usable-link semantics and doctor sync CLI path. ProjectConfiguration scans before unchanged-role shortcut; RolesFile scans before unchanged-text shortcut. Role-bearing credential hello uses real configuration/files with no fixedRoles under all-sync traps and exact role skills/text; existing lifecycle assertions retained. T2 refresh/link/clause/launch tests and inventory/docs/Implement CHANGES reviewed; no wire/permission/dependency change. C1/C2 await exact-head mode-free configured evidence. A-11672 local summaries are supplementary; retain original command/stdout/exits/source/timing limits without transcription reruns. No full integration/QA/native harness/doctor-run claim.

### rev-26 · 2026-10-25T10:22:13.917Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1230-final-1
commit: f1b2c5de1b674b585bf99b775ae334ee795ec546
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear; A-11709 audits original A-11707 / c1bf36f1. Carries A-11676 full source clearance. 3116 ordinary passes, 438 passing files; separately 25 actual load executions, including both new skill snapshot/refresh identities 5/5 (worst 0.153633239 s and 0.147080174 s). C1 verified by both serving-source refresh cases and public clause/launch regression; C2 verified by real-configuration role-bearing credential hello under all-sync traps, actual welcome/role assertions and retained lifecycle behavior (credential file 7/7). T0/all T1/fallback both-package T2/Web exit 0 on Linux c-8 lon1; no T3/T4 or stage QA claim. Host check tree a78238d4, not remote typecheck; report-only lint/budget diagnostics retained. A-11672 local summary limits remain explicit. Both criteria verified at unchanged head; Coordinator owns enqueue/merge/stage QA.

Criteria: C1 verified, C2 verified.
