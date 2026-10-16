---
id: Q-598
kind: question
title: The skill set and the skills policy
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-591
blocked_by:
  - Q-595
topic: null
branch: null
created: 2026-10-16T11:26:11.785Z
updated: 2026-10-16T12:07:08.207Z
closed: 2026-10-16T12:07:08.207Z
---

## Question

The skill set and the skills policy, decided on the skills triage: which skills stay in the curated set and which go; the removal of skills-lock.json and skills/PATCHES.md with each skill's origin recorded in the skill; in-place edits; the rule `cland update` follows for a project-edited skill, for a skill new to the set and for a dropped one; and the `.claude/skills` link.

## Comments

### human · 2026-10-16T12:07:08.105Z

## Resolution

Decided with the human on 2026-10-16 ("все да" to the five questions):

1. The curated set keeps 15 vendored skills: code-review, codebase-design, diagnosing-bugs, domain-modeling, grilling, implement, prototype, research, retro, tdd, to-spec, to-tickets, triage, wayfinder, writing-for-agents; with cland's own five (handover, merge, plan-epic, qa, release) and the new onboarding skill the set holds 21.
2. Dropped (23): chief-of-staff, claude-handoff, git-guardrails-claude-code, handoff, implement-spec, pr, setup-matt-pocock-skills, ask-matt, grill-me, teach, to-questionnaire, wait-what, wizard, migrate-to-shoehorn, scaffold-exercises, setup-pre-commit, setup-ts-deep-modules, loop-me, writing-beats, writing-fragments, writing-shape, grill-with-docs, improve-codebase-architecture.
3. `skills-lock.json` and `skills/PATCHES.md` are deleted. Each kept vendored skill carries in its frontmatter a metadata header: the origin commit, the MIT notice, one line of changes. The five skills that point at `/setup-matt-pocock-skills` point at `cland update`. The Codex listing is fixed: the `agents/openai.yaml` flag follows the removed `disable-model-invocation`, so Codex lists implement, to-spec, to-tickets, triage and wayfinder.
4. `cland update` keeps a SHA-256 per file in the manifest as cland wrote it and decides per skill: an untouched copy is refreshed; a copy edited in the project is kept and reported "edited in the project"; a skill new to the set is added unless the project already has a folder of that name; a dropped skill is removed when untouched and handed to the project when edited. The `.claude/skills` link to `.agents/skills` stays.
5. Manifests written before the hashes: the first `cland update` of 0.1.4 does one last overwrite with a warning line; no shipped table of past hashes.
