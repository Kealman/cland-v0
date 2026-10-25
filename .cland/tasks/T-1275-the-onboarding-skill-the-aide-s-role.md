---
id: T-1275
kind: task
title: The onboarding skill, the Aide's role clause and hub/README still have the Aide commit at the root, which the default workspace-write Codex Aide cannot do
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1283
blocked_by: []
topic: null
branch: null
created: 2026-10-25T08:28:46.609Z
updated: 2026-10-25T09:53:55.814Z
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

- [ ] C1. The onboarding skill, the Aide role clause and hub/README.md agree with SKILL.md:94 and T-1222 on who commits at the root under the generated defaults; the clause tests cover the new wording (test).
