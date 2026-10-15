---
id: T-474
kind: task
title: Merge override is limited to tracker and docs changes; a code diff needs review
state: open
status: in progress
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-423
blocked_by: []
topic: topic-315
branch: t/T-474-merge-override-is-limited-to-tracker-and
created: 2026-10-15T09:13:18.127Z
updated: 2026-10-15T18:21:43.603Z
---

## Summary

Retrospective A-2783, STOP 3: T-289 merged code by human override without review, and it was the run's one dev break. The override remains for tracker and docs diffs only.

## What to build

`cland merge --override` refuses when the branch's diff against dev touches a path outside `.cland/`, `docs/` and `*.md`, naming the paths. Tracker and docs diffs still merge by override.

## Acceptance criteria

- [ ] C1. An override merge of a branch that changes hub/src is refused, naming the files.
- [ ] C2. An override merge of a docs-only or tracker-only branch succeeds.
- [ ] C3. The merge skill and hub/README.md describe the scope.

## Comments

### impl-474 · 2026-10-15T18:20:56.063Z

Read task, E-423 decisions and v0.1.3 spec. Implementing immutable-candidate override path gate; extending merge-policy CLI integration coverage and documenting scope in merge skill, hub README and CLI help. No per-item QA required by resolved policy.

### impl-474 · 2026-10-15T18:21:43.603Z

Coordinator decision 6dbb6897 (topic-315) supersedes the original broad allowlist: permit only .cland/tasks/**, .cland/RULES.md, docs/**, GLOSSARY.md, README.md files, qa/briefs/**; reject everything else, including configuration and skill Markdown. Check both rename paths and deletions. Keep the list in one commented constant and document it.
