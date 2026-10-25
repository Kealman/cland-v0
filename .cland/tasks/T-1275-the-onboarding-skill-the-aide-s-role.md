---
id: T-1275
kind: task
title: The onboarding skill, the Aide's role clause and hub/README still have the Aide commit at the root, which the default workspace-write Codex Aide cannot do
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1283
blocked_by: []
topic: topic-1036
branch: t/T-1275-the-onboarding-skill-the-aide-s-role
created: 2026-10-25T08:28:46.609Z
updated: 2026-10-25T10:41:24.680Z
---

## Summary

oc-1274 found this aside while fixing T-1274. These places say the Aide commits and pushes the onboarding's work at the root:
- .agents/skills/onboarding/SKILL.md:113 and :117 (the start question and the commit step);
- hub/src/roles/default-roles.ts:299 and hub/src/roles/editor.ts:39 ("After committing the onboarding's work on root dev, publish it with cland push");
- hub/README.md:102 and :2066.

That contradicts SKILL.md:94 and T-1222's human decision: the default Aide on Codex runs workspace-write with no extra writable roots and cannot commit at the root; the Coordinator commits.

## What to build

One consistent rule. The skill gets a branch for when the Aide's harness cannot write the project root (the Coordinator commits), or says the Aide commits only when it can. The role clause and README follow it. Changing the shipped role clause is a shared contract (rule 20): list the clause snapshot tests and the roles-clauses consumers, and mind the clause byte reserve.

## Acceptance criteria

- [x] C1. The onboarding skill, the Aide role clause and hub/README.md agree with SKILL.md:94 and T-1222 on who commits at the root under the generated defaults; the clause tests cover the new wording (test).
  - done: impl-1275 · 2026-10-25T10:40:42.069Z

## Comments

### impl-1275 · 2026-10-25T10:35:14.633Z

Rule 20 consumer inventory before clause edits (C1): generated text: hub/src/roles/default-roles.ts -> config.ts, template.ts -> init/provision.ts and setup/steps/harnesses.ts; legacy migration: roles/editor.ts migrateAideTools -> hub/configuration.ts (marked/custom clauses remain preserved); project clause .cland/roles.toml; assembly/delivery: roles/clause.ts -> hub/core.ts and adapters/sessions.ts -> spoke/hub-client.ts, spoke/spoke.ts and harness adapters. Wire RoleClause and snapshots remain unchanged, arbitrary/older clause strings still accepted; existing roles-component, roles.test, roles-snapshot[-cli], config-reload-component, adapter and launch/lifecycle tests retain that compatibility. T1 wording/reserve consumers: roles-clauses.test.ts; migration regression roles-editor.test.ts; T2 aide-migration.test.ts; template/config consumers roles-template[-component], roles-harnesses, roles-launch-permissions, setup-favourite/setup-flow, permissions, aide-permissions, tool-arguments, review-qa-component, skills-qa-catalogue, session-credential-io; T3/T4 search includes skills-onboarding, codex-workspace-git, codex-adapter, claude-code-environment, lead-handover, task-prefixes, doctor, and launch/resume/native lifecycle tests. These consume clauses structurally or test launch/permissions, unchanged. Shipped prose: onboarding/SKILL.md, hub/README.md, GLOSSARY.md, docs/agents/session-permissions.md and docs/review-and-qa.md. CLI PUSH_USAGE already states role grants without commit ownership, unchanged. QA brief matches E-617/E-616/E-611/E-423/T-111/T-117: frozen historical releases or role/permission/byte-for-byte skill-copy checks; none parses the replaced commit sentence. Historical specs and launch-claims-audit record earlier policy and remain historical. New regression at existing criterion-authorized T1 clause seam covers both defaults/project wording and old-role migration; no protocol/schema/permission/default changes, so no added wire fields or new wire migration.

### rev-26 · 2026-10-25T10:39:19.675Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1275-source-1
commit: 2e87a4e6fcdfc03de2efc3e0a29907786789bebb
scope: full
findings: [{"severity":"medium","text":"M1: active Aide overview still prohibits `cland push` and says grants cannot override that boundary, contradicting the updated capable-Aide publication branch and C1's required README consistency. Correct this overview to actual role/tool and current-policy access boundaries; retain generated Codex delegation and add existing-seam prose red/green without relaxing production authorization.","file":"hub/README.md","line":1059}]
finding_counts: {"high":0,"medium":1,"low":0}

Full audit complete; A-11740. Standards0/Spec1medium M1 only. Skill handles current policy, human approval, existing/new Coordinator, publication receipt, release/map branches and staging safety; default/project/migration wording agrees, grants/wire/sandbox settings and reserve/custom-clause assertions unchanged. Consumer inventory and neighboring/public/historical prose checked; no additional findings. Hold verify, correct M1 through existing T1 seam, retain original command/stdout/exits/source/timing capture limits without transcription reruns, restore C1 done and request fresh pushed-head full review.

Criteria: C1 failed (M1: active hub README Aide overview still contradicts the required conditional root publication policy.).

### rev-26 · 2026-10-25T10:41:24.680Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1275-source-2
commit: 73d5f067321b568eda433b6b56b340b3f95f1c03
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-11744 carries A-11740 full audit. M1 resolved: active README overview now agrees on capable-Aide publication subject to current launch-fixed push grant and generated-Codex Coordinator delegation, preserving actual role prohibitions. Existing T1 defaults/project cases pin both paths and reject old unconditional prohibition; no production permissions/policy/wire changes. A-11742 independently read original M1 red 37/39 exit1 /124.356584ms then green39/39 exit0 /108.686541ms, with exact precommit source attribution and partial initial-TDD limits. Actual artifact A-11742, not A-11741. Standards0/Spec0; diff check0; C1 done restored. Runtime unverified pending ordinary mode-free configured verify at this unchanged head; no live onboarding/integration/QA claim.
