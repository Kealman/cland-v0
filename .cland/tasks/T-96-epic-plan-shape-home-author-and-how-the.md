---
id: T-96
kind: question
title: "Epic plan: shape, home, author and how the merge gate reads it"
state: open
labels:
  - wayfinder:grilling
assignee: null
parent: T-81
blocked_by:
  - T-88
  - T-90
  - T-93
topic: null
branch: null
created: 2026-10-09T19:09:48.358Z
updated: 2026-10-09T19:10:30.939Z
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
