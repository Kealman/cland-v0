---
id: T-620
kind: task
title: The curated set drops 23 skills, and nothing names them any more
state: open
status: in progress
size: S
criterion_seq: 7
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by: []
topic: topic-384
branch: t/T-620-the-curated-set-drops-23-skills-and
created: 2026-10-16T15:57:48.576Z
updated: 2026-10-16T16:30:46.734Z
---

## Summary

Remove the 23 dropped skills from the curated set, so `cland init` provisions the 15 kept upstream skills and cland's own five, and clear every remaining pointer to a dropped skill: the `/setup-matt-pocock-skills` fallback lines, the domain doc and its template, and the tests that sample `grill-me`.

## What to build

The 23 skills Q-598 dropped (chief-of-staff, claude-handoff, git-guardrails-claude-code, handoff, implement-spec, pr, setup-matt-pocock-skills, ask-matt, grill-me, teach, to-questionnaire, wait-what, wizard, migrate-to-shoehorn, scaffold-exercises, setup-pre-commit, setup-ts-deep-modules, loop-me, writing-beats, writing-fragments, writing-shape, grill-with-docs, improve-codebase-architecture) leave this repository's `.agents/skills/`, which is the set cland ships, together with their links in this repository's `.claude/skills/`, so no link dangles. A fresh `cland init` then provisions exactly 20 skills: code-review, codebase-design, diagnosing-bugs, domain-modeling, grilling, implement, prototype, research, retro, tdd, to-spec, to-tickets, triage, wayfinder, writing-for-agents, handover, merge, plan-epic, qa and release.

The five kept skills that tell the user to run `/setup-matt-pocock-skills` when the tracker docs are missing (code-review, to-spec, to-tickets, triage, wayfinder) point at `cland update` instead, which provisions `docs/agents/`; to-tickets' second mention ("the tracker `/setup-matt-pocock-skills` configured") names the tracker doc `cland init` provisions. The provisioned domain doc and its template stop routing through `/grill-with-docs` and `/improve-codebase-architecture` and name `domain-modeling` directly. The init and doctor tests that use `grill-me` as their sample shipped skill take `grilling`.

Because `.agents/skills/` is also the copy this repository's own sessions read, the dropped skills disappear from cland's own sessions on merge; that is intended (E-615, Risks).

## Acceptance criteria

- [ ] C1. This repository's `.agents/skills/` holds exactly the 15 kept upstream skills and handover, merge, plan-epic, qa and release, and none of the 23 dropped folders.
  - verified: rev-31 [reviewer] · run rev-20261016-620-source · 2026-10-16T16:04:24.454Z · commit d147e3d660d36b9e16c7a543a27c4cce49d16d79
- [ ] C2. This repository's `.claude/skills/` holds no link to a dropped skill and no dangling link.
  - verified: rev-31 [reviewer] · run rev-20261016-620-source · 2026-10-16T16:04:24.454Z · commit d147e3d660d36b9e16c7a543a27c4cce49d16d79
- [ ] C3. A new test in the init tests runs `cland init` in an empty temporary project and asserts that the manifest and `.agents/skills/` list exactly the 20 names above.
  - verified: rev-31 [reviewer] · run rev-20261016-620-source · 2026-10-16T16:04:24.454Z · commit d147e3d660d36b9e16c7a543a27c4cce49d16d79
- [ ] C4. code-review, to-spec, to-tickets, triage and wayfinder point their missing-tracker fallback at `cland update`, and no kept skill names `/setup-matt-pocock-skills`.
  - verified: rev-31 [reviewer] · run rev-20261016-620-source · 2026-10-16T16:04:24.454Z · commit d147e3d660d36b9e16c7a543a27c4cce49d16d79
- [ ] C5. `docs/agents/domain.md` and its template under `skills/templates/` name neither grill-with-docs nor improve-codebase-architecture, and `cland update` in a scratch project writes the new template.
- [ ] C6. The init and doctor tests that sampled `grill-me` sample `grilling`, and both test files pass.
- [ ] C7. A grep for each of the 23 names over the role clauses and skill lists (`hub/src/roles/default-roles.ts`, `.cland/roles.toml`), `skills/templates/`, `docs/agents/`, `AGENTS.md`, `GLOSSARY.md`, `hub/README.md`, `hub/src/` and the 20 kept skill folders finds no reference to the skill.
  - verified: rev-31 [reviewer] · run rev-20261016-620-source · 2026-10-16T16:04:24.454Z · commit d147e3d660d36b9e16c7a543a27c4cce49d16d79

## Comments

### impl-620 · 2026-10-16T15:59:11.593Z

Implementation started: using the ticket's public CLI seam for a literal 20-name fresh-init regression, then updating active skill/domain pointers and init/doctor samples. Exempt record documents and the repository's per-skill Claude link layout remain preserved.

### impl-620 · 2026-10-16T16:01:32.011Z

Source committed and pushed at d147e3d660d36b9e16c7a543a27c4cce49d16d79 after fetching/merging origin/dev. Typecheck exit 0; targeted init.test.ts 17/17 and doctor.test.ts 22/22 passed, one file at a time. Literal 20-name init and update domain assertions proved red before edits and green after. C1/C2 inventory and C7 skill-pointer audit clear; no per-item QA required (scope none / after-stage). Evidence published in this item's topic.

### rev-31 · 2026-10-16T16:04:24.454Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-620-source
commit: d147e3d660d36b9e16c7a543a27c4cce49d16d79
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 findings, Spec 0 findings. A-3961 records independent committed-tree inventory and token audit. Exactly20 required source folders/SKILL.md and20 resolving unchanged-layout Claude links remain; all23 dropped sets removed. Public init regression asserts literal20 manifest/folder identities. Five fallback pointers and to-tickets tracker wording are correct. Domain doc/template and update output assertion use domain-modeling; grilling samples preserve existing safety assertions. C7 active-path audit has only existing handoff/wizard domain homonyms, no dropped skill references. Historical records preserved, no hub/src edits. A-3953 reports typecheck and sequential init17/17 doctor22/22, new case<1s. C1/C2/C3/C4/C7 source-verified; C5/C6 execution portions await fresh same-head post-review verification. Origin tip/diff check confirmed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C7 verified.

### rev-31 · 2026-10-16T16:30:46.734Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-620-evidence-1
commit: d147e3d660d36b9e16c7a543a27c4cce49d16d79
scope: evidence
findings: [{"severity":"medium","text":"External gate failure: process.kill receives null job.pid in borrowed-planned-root recovery; task tests pass but the Linux gate is exit1 and Neovim is not reached.","file":"hub/test/suite-recovery.test.ts","line":123}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear, A-4009. Exact reviewed-head Linux7820ca68/A-4007 exit1:1943pass/1fail/5skip; sole ordinary failure suite-recovery.ts123 ERR_INVALID_ARG_TYPE pid null. Outside T-620 diff; not classified as a known exception. Task init20-name ordinary+5/5, domain-update and grilling doctor cases green. Source0findings/C1C2C3C4C7 verification remains current; final C5/C6 execution marks withheld pending gate disposition. No task criterion failed. Aside Bugs/S for lead classification, no branch-local fix or unapproved retry. Raw receipt stopped before Neovim. No Reviewer edits/tests.
