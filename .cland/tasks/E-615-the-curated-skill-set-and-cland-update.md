---
id: E-615
kind: epic
title: The curated skill set and cland update
state: open
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by: []
topic: null
branch: null
created: 2026-10-16T15:34:18.753Z
updated: 2026-10-16T15:34:18.753Z
---

## Summary

cland ships a curated skill set, edited in place: 15 vendored skills stay and 23 go, and each kept skill carries its origin and changes in its own header instead of `skills-lock.json` and `skills/PATCHES.md`. `cland update` keeps a hash per file, so it refreshes a skill the project never touched and keeps one the project edited.

## Goal

A project gets only skills that serve cland's flows, and owns the edits it makes to them. Today `.agents/skills/` holds 43 skills: 38 vendored ones and cland's own five. Some vendored skills work against cland: sub-agents that merge without review, a guard that blocks pushes to the territory, a pull-request skill where cland has no pull requests. Sixteen copies differ from upstream while `skills/PATCHES.md` records four, and Codex still hides implement, to-spec, to-tickets, triage and wayfinder. `cland update` cannot tell an edited skill from an untouched one: it rewrites any listed file that differs, and it removes a dropped skill even when the project edited it (Q-595).

## Contents

- **The set** (Q-598 resolution 1). The 15 kept vendored skills: code-review, codebase-design, diagnosing-bugs, domain-modeling, grilling, implement, prototype, research, retro, tdd, to-spec, to-tickets, triage, wayfinder, writing-for-agents. cland's own five: handover, merge, plan-epic, qa, release. The `onboarding` skill joins them in "The onboarding skill and the newcomer's first page", making 21.
- **The 23 dropped** (Q-598 resolution 2): chief-of-staff, claude-handoff, git-guardrails-claude-code, handoff, implement-spec, pr, setup-matt-pocock-skills, ask-matt, grill-me, teach, to-questionnaire, wait-what, wizard, migrate-to-shoehorn, scaffold-exercises, setup-pre-commit, setup-ts-deep-modules, loop-me, writing-beats, writing-fragments, writing-shape, grill-with-docs, improve-codebase-architecture. Afterwards no clause, template, doc or kept skill names a dropped one.
- **Origins in the skills** (Q-598 resolution 3). `skills-lock.json` and `skills/PATCHES.md` are deleted. Each kept vendored skill's frontmatter carries a metadata header: its origin commit, the MIT notice and one line of changes, including the changes PATCHES.md never recorded (Q-595 lists them per skill).
- **The fallback lines.** The five kept skills that point at `/setup-matt-pocock-skills` point at `cland update`.
- **The Codex listing.** The flag in each skill's `agents/openai.yaml` follows the removed `disable-model-invocation`, so Codex lists implement, to-spec, to-tickets, triage and wayfinder.
- **Hashes in the manifest** (Q-598 resolution 4). `.agents/skills/.cland-manifest.json` records the SHA-256 of each file as cland wrote it, and `cland update` decides per skill: an untouched copy is refreshed; an edited copy is kept and reported "edited in the project"; a skill new to the set is added unless the project already has a folder of that name; a dropped skill is removed when untouched and handed to the project when edited. The `.claude/skills` link to `.agents/skills` stays.
- **Old manifests** (Q-598 resolution 5). A manifest without hashes gets one last overwrite from the first `cland update` of 0.1.4, with a warning line; no table of past hashes ships.

Not in this epic: the `onboarding` skill itself; skills a project writes for itself, which the manifest never lists and `cland update` never writes.

## Tracer-bullet order

1. **The set.** Drop the 23, delete the lock and PATCHES.md, write the headers, fix the fallback lines and the Codex flags. Demo: a fresh `cland init` provisions the 20 skills, each kept vendored skill shows its header, and Codex lists the five skills it hid.
2. **Hashes and the update rules.** Demo: in a scratch project, with a newer set simulated (`CLAND_SKILLS_SOURCE_OVERRIDE`), `cland update` refreshes an untouched skill, keeps and reports an edited one, adds a new one, skips a new one whose folder exists, removes a dropped untouched one and hands a dropped edited one to the project.
3. **Old manifests.** Demo: a project initialised by v0.1.3 gets one overwrite with a warning on its first update, and hashes from then on.

## Definition of done

QA runs the demo below on `dev`, through the demo lease where no macOS is needed and with the Codex listing read on this Mac, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

QA reads this repository's `.agents/skills/` and a fresh scratch project's after `cland init`, the headers of the kept skills and Codex's list of skills. In a scratch project initialised by v0.1.3, QA runs `cland update` once and reads the warning; then, with a newer set simulated, it edits one skill and runs `cland update` again, reading each decision in the report.

- [ ] C1. `.agents/skills/` holds the 15 kept vendored skills and cland's own five, the 23 dropped skills, `skills-lock.json` and `skills/PATCHES.md` are gone, and no clause, template, doc or kept skill names a dropped one.
- [ ] C2. Each kept vendored skill's frontmatter carries its origin commit, the MIT notice and one line of changes, and the five fallback lines point at `cland update`.
- [ ] C3. Codex lists implement, to-spec, to-tickets, triage and wayfinder.
- [ ] C4. The manifest records a SHA-256 per file, and `cland update` refreshes an untouched skill, keeps an edited one reported "edited in the project", adds a new one unless its folder exists, and removes a dropped skill when untouched or hands it to the project when edited.
- [ ] C5. A manifest without hashes gets one last overwrite with a warning line on the first `cland update`.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The DigitalOcean token is never stored.
- **Tests.** The update rules are tested on temporary projects with a newer set simulated through `CLAND_SKILLS_SOURCE_OVERRIDE`, never on this repository's own skills.
- **Risks.** `.agents/skills/` is both the set cland ships and the copy this repository's own sessions use, so the dropped skills leave this project's sessions too when this epic merges.
- **Order.** First in the skills lane, with no blocker. "The onboarding skill and the newcomer's first page" waits for it.

## Links

- Spec: `docs/spec/v0.1.4.md`, §3.6 (The curated skill set) and §4 (The cut).
- Items: map M-591, decision 4; Q-595 (the triage: what each skill does, where cland names it, which patches it carries); Q-598 (the human's decisions).
- Research: `docs/research/skills-triage.md` on research/skills-triage (b02343a9).
- Code: `hub/src/init/skills.ts` (the manifest and the update rules), `hub/src/init/files.ts`, `skills-lock.json`, `skills/PATCHES.md`, `.agents/skills/*/agents/openai.yaml`.
