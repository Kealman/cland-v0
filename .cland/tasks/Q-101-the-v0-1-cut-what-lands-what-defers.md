---
id: Q-101
kind: question
title: "The v0.1 cut: what lands, what defers"
state: closed
labels:
  - wayfinder:grilling
assignee: null
parent: M-81
blocked_by:
  - Q-82
  - Q-83
  - Q-84
  - Q-85
  - Q-86
  - Q-87
  - Q-88
  - Q-89
  - Q-90
  - Q-91
  - Q-92
  - Q-93
  - Q-94
  - Q-95
  - Q-96
  - Q-97
  - Q-98
  - Q-99
  - Q-100
topic: null
branch: null
created: 2026-10-09T19:09:52.491Z
updated: 2026-10-09T21:52:31.447Z
---

## Question

With every theme decided and its cost visible, what does the v0.1 release contain, in which order, and what defers to v0.2?

## Context

The map's scope is the whole of the human's notes: five large themes (session hierarchy, crew configuration and session reuse, epic planning, item hierarchy, visibility levels) and the improvements settled while charting or decided by their own tickets. The small improvements are in v0.1 by default. The v0.1 epics carry the label `v0.1` and move under the release item once the release kind exists.

## To decide

- Which large themes land whole, which land as a first slice, which defer; the tracer-bullet order of epics and what each must demonstrate.
- The dogfooding rule for v0.1: the release item, epic plans for the v0.1 epics, the human's own session used for planning, the crew configuration used for the build.
- The definition of done for v0.1 and the release checklist.

Then turn `docs/spec/v0.1.md` to status complete and publish the epics with `/to-spec` (label `v0.1`, parent the release item when it exists). Record the resolution as a comment and close the map.

## Comments

### human · 2026-10-09T21:52:27.092Z

Resolution (2026-10-09, the human decided).

- Scope: everything in the spec is in v0.1; nothing is deferred (the sizing memo offered three cuts; the human took the whole, about 49 sessions on the v0 scale).
- Epics, published as items labelled v0.1 with blocking edges:
  - E01 → T-107 → Epic: v0.1 release and status
  - E02 → T-108 → Epic: A quiet Coordinator
  - E03 → T-109 → Epic: Workbench basics
  - E04 → T-110 → Epic: Threads that read
  - E05 → T-111 → Epic: The human's own session
  - E06 → T-112 → Epic: Criteria that live
  - E07 → T-113 → Epic: Leads and the crew
  - E08 → T-114 → Epic: The epic plan
  - E09 → T-115 → Epic: Visibility and artifacts
  - E10 → T-116 → Epic: The task graph
  - E11 → T-117 → Epic: Release from the item
- Order: hub lane 1 → 2 → 6 → 7 → 8 → 11; Neovim lane 3 → 4 → 5 → 10 → 9; 5 also after 2; 11 after all.
- The v0 tail: not a prerequisite; taken first only when it blocks the work; the rest labelled tech-debt and done with the v0.1 tail.
- Dogfooding: the release item from the first ticket; item leads after epic 2; an Aide after 5; crew.toml after 7; plan-epic for epics 8 to 11 after 8 with approval = none while the human is away.
- Definition of done: each epic's demo run by the human on v0.1; v0.1.0 released with cland release --item; a retrospective artifact.

Recorded in docs/spec/v0.1.md §4 (status complete).

### human · 2026-10-09T21:52:31.447Z

Resolved: see the resolution comment; spec v0.1 §4; epics published
