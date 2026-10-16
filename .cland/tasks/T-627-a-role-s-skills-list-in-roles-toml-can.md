---
id: T-627
kind: task
title: A role's skills list in roles.toml can name a skill cland no longer ships, and nothing reports it
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - skills
assignee: null
parent: R-577
blocked_by: []
topic: null
branch: null
created: 2026-10-16T15:58:21.960Z
updated: 2026-10-16T15:58:21.960Z
---

## Summary

E-615 drops 23 skills from the curated set (T-620). A project's `.cland/roles.toml` can still list a dropped or unknown skill for a role, and neither `cland doctor` nor the clause builder says so. Found while cutting E-615 (the ticket drafter's question 5); kept outside that epic.

## Acceptance criteria

- [ ] C1. `cland doctor` warns for each role whose skills list names a skill that isn't in the project's skill set, naming the role and the skill, proved by a doctor test.
- [ ] C2. The role's clause and launch brief leave out an unknown skill instead of listing it, proved by a clause test.
