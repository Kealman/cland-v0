---
id: Q-595
kind: question
title: "The skill set: keep or drop each of the 38 vendored skills"
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-591
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:26:11.426Z
updated: 2026-10-16T11:26:12.428Z
---

## Question

Which of the 38 vendored skills stay in cland's curated set? For each Matt Pocock skill in `.agents/skills/` (the entries of skills-lock.json): what it does, where cland's flows reference it (role clauses, docs/agents, templates, other skills, the human's practice in this repository: wayfinder, grilling, domain-modeling, to-spec, to-tickets, research, prototype, triage, code-review, implement, tdd and the rest), and a keep or drop recommendation with one line of reason. Add what removing `skills-lock.json` and `skills/PATCHES.md` entails (which patches live in which skills, so each skill records its own origin and changes), and how `cland init` and `cland update` could tell a project-edited skill from an untouched copy (the manifest's hashes). Deliver `docs/research/skills-triage.md` on research/skills-triage with the table and the resolution comment here; the human decides in the grilling.
