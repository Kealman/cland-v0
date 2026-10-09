---
id: T-96
kind: question
title: "Epic plan: shape, home, author and how the merge gate reads it"
state: closed
labels:
  - wayfinder:grilling
assignee: human
parent: T-81
blocked_by:
  - T-88
  - T-90
  - T-93
topic: null
branch: null
created: 2026-10-09T19:09:48.358Z
updated: 2026-10-09T20:32:16.565Z
---

## Question

What is an epic plan: its shape, where it lives, who makes it, whether the human approves it, and how the merge gate reads it?

## Context

Before an epic starts, the human wants the Coordinator to plan it: which tasks get QA at all (every QA run costs money or time on some projects), full suite or affected tests per task, stages (these three tasks, then a QA pass, then the next three), parallel lanes, and which tasks one implementer takes together. The human must be able to see the plan in a convenient form; whether every plan is reviewed by the human is agreed with the Coordinator, not fixed. Today the merge gate requires a clear review and QA only when the item carries the label `qa-required`; grouping of items and the crew's policy come from the crew configuration ticket; criteria marks from the acceptance criteria ticket; status and rank from the status ticket.

## To decide

- The plan's shape: stages, lanes, per-task QA policy (none, affected, full), groups per implementer, the order within a stage.
- Its home: a section of the epic item file, a plan artifact, or fields on the tasks (ADR 0002: files are the source of truth either way).
- The author: a Coordinator skill run before the epic starts; human approval optional and configurable per project; what happens when the plan changes mid-epic.
- Enforcement: the merge gate reads the QA policy from the plan instead of the label; the Coordinator launches by stage; the items panel and the graph show the stage.
- GLOSSARY: Plan, Stage, Lane; the spec section.

Record the resolution as a comment, the spec section and the GLOSSARY entries.

## Comments

### human · 2026-10-09T20:32:11.636Z

Resolution (2026-10-09, the human accepted every point).

- Shape: ordered stages; a stage holds parallel lanes (an ordered list of items one session takes, or one session per item); QA policy per stage (scope none | affected | full; when per-item | after-stage) with per-item override; after-stage means items merge on review and one QA run on dev closes the stage; review is always required.
- Home: a "## Plan" section with a YAML block in the epic's file, parsed and validated by the hub; a broken plan is refused and the previous one stays in force (ADR 0002 holds).
- Author: a plan-epic skill run by the Coordinator or the epic's Lead before the epic starts; every epic has a plan; approval configured in config.toml ([plan] approval = none, the default with a watch-layer notification, or human, which blocks launches until the human approves).
- Tools: task.plan set | show | approve (approve by the human or an Aide only); CLI cland task plan; the qa-required label retires, QA policy comes from the plan or [plan] qa_default.
- Enforcement: the merge gate reads the item's QA policy from the plan; stage order guides launches through the clause, not blocked by the hub; criteria marked for QA need QA verification.
- Display and change: the plan view (T-100) opens from the epic, the graph and the palette; rows show the stage; mid-epic changes go through the same tool, journaled and notified at the watch layer.
- GLOSSARY: Plan, Stage, Lane. No ADR.

Recorded in docs/spec/v0.1.md §3.10 and GLOSSARY.md.

### human · 2026-10-09T20:32:16.565Z

Resolved: see the resolution comment; spec v0.1 §3.10
