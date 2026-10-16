---
id: Q-595
kind: question
title: "The skill set: keep or drop each of the 38 vendored skills"
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-591
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:26:11.426Z
updated: 2026-10-16T12:00:37.792Z
closed: 2026-10-16T12:00:37.792Z
---

## Question

Which of the 38 vendored skills stay in cland's curated set? For each Matt Pocock skill in `.agents/skills/` (the entries of skills-lock.json): what it does, where cland's flows reference it (role clauses, docs/agents, templates, other skills, the human's practice in this repository: wayfinder, grilling, domain-modeling, to-spec, to-tickets, research, prototype, triage, code-review, implement, tdd and the rest), and a keep or drop recommendation with one line of reason. Add what removing `skills-lock.json` and `skills/PATCHES.md` entails (which patches live in which skills, so each skill records its own origin and changes), and how `cland init` and `cland update` could tell a project-edited skill from an untouched copy (the manifest's hashes). Deliver `docs/research/skills-triage.md` on research/skills-triage with the table and the resolution comment here; the human decides in the grilling.

## Comments

### human · 2026-10-16T12:00:37.701Z

## Resolution

Document: `docs/research/skills-triage.md` on research/skills-triage (b02343a9). The human decides the list in Q-598.

Keep 17: code-review, codebase-design, diagnosing-bugs, domain-modeling, grill-with-docs, grilling, implement, improve-codebase-architecture, prototype, research, retro, tdd, to-spec, to-tickets, triage, wayfinder, writing-for-agents (grill-with-docs, improve-codebase-architecture and retro were never run here: weak keeps). With cland's own five (handover, merge, plan-epic, qa, release) and the planned onboarding skill the set holds 23.

Drop 21: chief-of-staff and claude-handoff (run sessions or sub-agents outside the hub); git-guardrails-claude-code (blocks the push of task branches to the territory); handoff (duplicates cland's handover under a confusable name); implement-spec (its sub-agents merge without review, cland verify and cland merge); pr (cland has no pull requests); setup-matt-pocock-skills (writes tracker docs over the ones init provisions); ask-matt (routes Matt Pocock's own flow, mostly dropped routes); grill-me (only calls grilling); teach, to-questionnaire, wait-what (never used, not project flows); wizard (never used; the term was ruled out); migrate-to-shoehorn, scaffold-exercises, setup-pre-commit, setup-ts-deep-modules (one stack or one project each); loop-me, writing-beats, writing-fragments, writing-shape (upstream drafts outside engineering).

Patches: every lock hash matches an upstream commit, but 16 copies differ from upstream and PATCHES.md covers only 4. Init removed `disable-model-invocation: true` from 15 skills with nothing recording it (kept ones: grill-with-docs, implement, improve-codebase-architecture, retro, to-spec, to-tickets, triage, wayfinder); the Codex flag in agents/openai.yaml was not changed, so Codex still does not list implement, to-spec, to-tickets, triage or wayfinder. code-review records T-143, D25/T-322, T-332 but misses T-156, T-178, T-108 C9, T-477; implement records D25/T-322, misses T-226; to-tickets records b0c148a6, T-317, T-331, misses T-335 and T-473 (its T-331 entry still lists XL); triage records b0c148a6 and T-317. Proposal: a frontmatter metadata header per kept skill (origin commit, MIT notice, one line of changes); five kept skills point their `/setup-matt-pocock-skills` fallback line at `cland update`.

Edited-skill detection: today `cland update` cannot detect an edit; the manifest lists files without hashes, rewrites any listed file that differs and reports it as updated; a dropped skill is removed whether edited or not; ownership, new skills and dropped skills are already handled by the manifest. Proposal: record the SHA-256 of each file as cland wrote it and decide per skill: untouched refreshed; edited kept and reported "edited in the project"; new added unless the project already has a folder of that name; dropped removed if untouched, handed to the project if edited. Manifests written before the change carry no hashes: either a shipped table of every release's file hashes (139 file versions) or one last overwrite.
