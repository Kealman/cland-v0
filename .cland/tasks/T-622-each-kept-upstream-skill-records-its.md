---
id: T-622
kind: task
title: Each kept upstream skill records its origin and changes in its header; skills-lock.json and PATCHES.md go
state: open
status: review
size: S
criterion_seq: 7
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by:
  - T-620
  - T-621
topic: topic-524
branch: t/T-622-each-kept-upstream-skill-records-its
created: 2026-10-16T15:57:48.844Z
updated: 2026-10-18T16:25:48.972Z
---

## Summary

Replace `skills-lock.json` and `skills/PATCHES.md` with a metadata header in the frontmatter of each of the 15 kept upstream skills: the origin commit in `mattpocock/skills`, the MIT notice, and one line of cland's changes, including the ones PATCHES.md never recorded.

## What to build

Each kept upstream skill's `SKILL.md` frontmatter gains a `metadata` block with two plain strings: `origin`, naming the upstream path and commit the copy was taken from with the MIT notice ("MIT, Copyright (c) 2026 Matt Pocock"), and `changes`, one line listing cland's changes with their tickets. The origins and changes are those of Q-595's table (`docs/research/skills-triage.md` on research/skills-triage, section 2.3), restricted to the 15 kept skills and extended with this epic's own changes: the fallback line pointing at `cland update` (01) and the Codex flag following the frontmatter (02). Skills cland never changed say `none`. The details stay in git history.

`skills-lock.json` and `skills/PATCHES.md` are deleted. `skills/README.md` describes the curated set instead: cland's own skills and the kept upstream ones, edited in place, each upstream skill's origin in its header, and how to take an upstream improvement (a diff of the upstream folder from the origin commit). Claude Code and Codex still load every kept skill with the new frontmatter.

## Acceptance criteria

- [x] C1. Each of the 15 kept upstream skills carries `metadata.origin` with its upstream path, its origin commit and the MIT notice, and `metadata.changes` with one line of cland's changes or `none`.
  - done: impl-622 · 2026-10-18T16:25:23.696Z
- [x] C2. The changes lines include every change Q-595 found unrecorded: T-156, T-178, T-108 C9 and T-477 in code-review, T-226 in implement, T-335 and T-473 in to-tickets, and the model-invocable change of implement, retro, to-spec, to-tickets, triage and wayfinder.
  - done: impl-622 · 2026-10-18T16:25:25.583Z
- [x] C3. The changes lines of code-review, to-spec, to-tickets, triage and wayfinder name the fallback pointing at `cland update`.
  - done: impl-622 · 2026-10-18T16:25:29.384Z
- [x] C4. A new test parses the frontmatter of every kept upstream skill and fails when `metadata.origin` lacks a commit hash or the MIT notice, or when `metadata.changes` is empty.
  - done: impl-622 · 2026-10-18T16:25:30.583Z
- [x] C5. `skills-lock.json` and `skills/PATCHES.md` no longer exist, and neither `skills/README.md` nor `docs/agents/` names them (the comment in the init code that names them is rewritten by the manifest ticket, 04).
  - done: impl-622 · 2026-10-18T16:25:31.689Z
- [x] C7. Each kept upstream skill folder also carries the upstream LICENSE file, so the full MIT notice travels with the copies, and the C4 test checks it is present.
  - done: impl-622 · 2026-10-18T16:25:32.739Z

## Comments

### coord · 2026-10-16T16:00:48.514Z

Coordinator, 2026-10-16: C6 (Claude Code and Codex sessions listing every kept skill after a fresh init) was removed from this ticket. It's verified at E-615's epic demo (DoD C2/C3, read by QA). This ticket's C4 test guards the headers.

### impl-622 · 2026-10-18T16:25:35.039Z

Implemented and pushed 561d52760b33b9d7b95e62a604d42c0757db10dd. Evidence: A-5423 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5423-t-622-provenance-headers-and-validation.md). T0 guard red/green plus four mutation probes; test:lint and typecheck passed. origin/dev merged before first source review (tracker-only changes). No per-item QA required by qaPolicy. Awaiting source review before mode-free droplet verification.
