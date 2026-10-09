---
id: T-101
kind: question
title: "The v0.1 cut: what lands, what defers"
state: open
labels:
  - wayfinder:grilling
assignee: null
parent: T-81
blocked_by:
  - T-82
  - T-83
  - T-84
  - T-85
  - T-86
  - T-87
  - T-88
  - T-89
  - T-90
  - T-91
  - T-92
  - T-93
  - T-94
  - T-95
  - T-96
  - T-97
  - T-98
  - T-99
  - T-100
topic: null
branch: null
created: 2026-10-09T19:09:52.491Z
updated: 2026-10-09T19:10:35.827Z
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
