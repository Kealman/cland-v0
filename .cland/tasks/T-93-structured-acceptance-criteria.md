---
id: T-93
kind: question
title: Structured acceptance criteria
state: open
labels:
  - wayfinder:grilling
assignee: null
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:46.164Z
updated: 2026-10-09T19:09:46.164Z
---

## Question

How do acceptance criteria become structured and alive: a format the hub parses, per-criterion marks by the implementer and confirmations by the reviewer or QA, shown in the item view and read by the gate?

## Context

Acceptance criteria are Markdown checkboxes in the item body under "## Acceptance criteria": 275 across 58 items in v0, none ever ticked; verdicts are comment blocks with `verdict:`, `result:`, `by:`, `run:`. The human wants criteria that live: the implementer marks one done, the reviewer or QA confirms it, and the state is visible, not a checkbox nobody touches. ADR 0002 keeps the item file the source of truth, so the marks must be in the file.

## To decide

- The format in the file: a criteria section the hub parses, each criterion with an id, the mark "done by whom and when", the mark "verified by whom and when", and free notes.
- The tools: a `task.criterion` tool, or marks inside `task.comment --verdict`; who may set which mark (role-based); what `cland task view` and the UI show.
- How the merge gate reads them (all verified, or the epic plan's QA policy decides which need QA verification), and how an unverified criterion blocks or warns.
- The GLOSSARY entry (Criterion) and the spec section.

Record the resolution as a comment, the spec section and the GLOSSARY entry.
