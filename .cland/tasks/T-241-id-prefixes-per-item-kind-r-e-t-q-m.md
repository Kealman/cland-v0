---
id: T-241
kind: task
title: Id prefixes per item kind (R-, E-, T-, Q-, M-)
state: closed
status: done
labels:
  - v0.1.2
  - ready-for-human
assignee: null
parent: R-228
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:49:01.834Z
updated: 2026-10-12T11:35:33.697Z
closed: 2026-10-12T11:35:33.731Z
---

## Open question

Every id starts with T-, so an epic prefix on a task row reads like another task (observation 6). To decide: per-kind prefixes with one shared counter or with per-kind counters, plus a migration rule for files, the CLI, gi targets and existing ids.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.

## Comments

### human · 2026-10-12T08:59:32.334Z

Decided (2026-10-12, round 2 of the v0.1.2 grilling): the number is the identity, the prefix follows the kind (R- release, E- epic, T- task, Q- question, M- map, S- spec, C- category once it is a kind); one shared counter; the hub resolves any prefix with a number, so old ids stay valid everywhere; migration is one command that renames the item files and rewrites parent and blocked_by in frontmatter, nothing else. Recorded in docs/spec/v0.1.2.md §3.1.

### human · 2026-10-12T11:35:33.697Z

Decided on 2026-10-12: recorded in docs/spec/v0.1.2.md §3.1; built by T-269 Prefixes and categories
