---
id: T-620
kind: task
title: The curated set drops 23 skills, and nothing names them any more
state: open
status: review
size: S
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by: []
topic: topic-384
branch: t/T-620-the-curated-set-drops-23-skills-and
created: 2026-10-16T15:57:48.576Z
updated: 2026-10-16T16:01:32.011Z
---

## Summary

Remove the 23 dropped skills from the curated set, so `cland init` provisions the 15 kept upstream skills and cland's own five, and clear every remaining pointer to a dropped skill: the `/setup-matt-pocock-skills` fallback lines, the domain doc and its template, and the tests that sample `grill-me`.

## What to build

The 23 skills Q-598 dropped (chief-of-staff, claude-handoff, git-guardrails-claude-code, handoff, implement-spec, pr, setup-matt-pocock-skills, ask-matt, grill-me, teach, to-questionnaire, wait-what, wizard, migrate-to-shoehorn, scaffold-exercises, setup-pre-commit, setup-ts-deep-modules, loop-me, writing-beats, writing-fragments, writing-shape, grill-with-docs, improve-codebase-architecture) leave this repository's `.agents/skills/`, which is the set cland ships, together with their links in this repository's `.claude/skills/`, so no link dangles. A fresh `cland init` then provisions exactly 20 skills: code-review, codebase-design, diagnosing-bugs, domain-modeling, grilling, implement, prototype, research, retro, tdd, to-spec, to-tickets, triage, wayfinder, writing-for-agents, handover, merge, plan-epic, qa and release.

The five kept skills that tell the user to run `/setup-matt-pocock-skills` when the tracker docs are missing (code-review, to-spec, to-tickets, triage, wayfinder) point at `cland update` instead, which provisions `docs/agents/`; to-tickets' second mention ("the tracker `/setup-matt-pocock-skills` configured") names the tracker doc `cland init` provisions. The provisioned domain doc and its template stop routing through `/grill-with-docs` and `/improve-codebase-architecture` and name `domain-modeling` directly. The init and doctor tests that use `grill-me` as their sample shipped skill take `grilling`.

Because `.agents/skills/` is also the copy this repository's own sessions read, the dropped skills disappear from cland's own sessions on merge; that is intended (E-615, Risks).

## Acceptance criteria

- [ ] C1. This repository's `.agents/skills/` holds exactly the 15 kept upstream skills and handover, merge, plan-epic, qa and release, and none of the 23 dropped folders.
- [ ] C2. This repository's `.claude/skills/` holds no link to a dropped skill and no dangling link.
- [ ] C3. A new test in the init tests runs `cland init` in an empty temporary project and asserts that the manifest and `.agents/skills/` list exactly the 20 names above.
- [ ] C4. code-review, to-spec, to-tickets, triage and wayfinder point their missing-tracker fallback at `cland update`, and no kept skill names `/setup-matt-pocock-skills`.
- [ ] C5. `docs/agents/domain.md` and its template under `skills/templates/` name neither grill-with-docs nor improve-codebase-architecture, and `cland update` in a scratch project writes the new template.
- [ ] C6. The init and doctor tests that sampled `grill-me` sample `grilling`, and both test files pass.
- [ ] C7. A grep for each of the 23 names over the role clauses and skill lists (`hub/src/roles/default-roles.ts`, `.cland/roles.toml`), `skills/templates/`, `docs/agents/`, `AGENTS.md`, `GLOSSARY.md`, `hub/README.md`, `hub/src/` and the 20 kept skill folders finds no reference to the skill.

## Comments

### impl-620 · 2026-10-16T15:59:11.593Z

Implementation started: using the ticket's public CLI seam for a literal 20-name fresh-init regression, then updating active skill/domain pointers and init/doctor samples. Exempt record documents and the repository's per-skill Claude link layout remain preserved.

### impl-620 · 2026-10-16T16:01:32.011Z

Source committed and pushed at d147e3d660d36b9e16c7a543a27c4cce49d16d79 after fetching/merging origin/dev. Typecheck exit 0; targeted init.test.ts 17/17 and doctor.test.ts 22/22 passed, one file at a time. Literal 20-name init and update domain assertions proved red before edits and green after. C1/C2 inventory and C7 skill-pointer audit clear; no per-item QA required (scope none / after-stage). Evidence published in this item's topic.
