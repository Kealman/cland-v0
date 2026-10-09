---
id: T-93
kind: question
title: Structured acceptance criteria
state: closed
labels:
  - wayfinder:grilling
assignee: human
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:46.164Z
updated: 2026-10-09T19:45:42.492Z
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

## Comments

### human · 2026-10-09T19:45:35.092Z

Resolution (2026-10-09, the human accepted every point).

- Criteria stay a list under "## Acceptance criteria" but become structured: a stable id per criterion (C1, C2, …) and marks as sub-items (done, verified, failed, each with who and when, verified with the run). The hub parses the section, exposes `criteria` in view --json and writes the marks; the checkbox mirrors done; the file stays the source of truth.
- done: the Implementer holding the claim, or the Coordinator, the human or an Aide. verified: a Reviewer or QA, standalone (task.criterion verify) or inside a verdict (--verified C1,C3 or all). failed: a verifier with a note; it clears done and returns the task to in progress. Criteria are added, edited and removed by the Coordinator, the human or an Aide; ids are never reused.
- The merge gate refuses while any criterion is not done or not verified by at least one verdict; the epic plan may require QA verification for specific criteria.
- Item view: glyphs ○ open, ◐ done, ● verified, ✗ failed with marks; panel rows and board cards show verified/total for tasks in work.
- Migration: existing checkboxes read as unmarked criteria; ids assigned when the hub first touches the section.
- GLOSSARY: Criterion. No ADR.

Recorded in docs/spec/v0.1.md §3.4 and GLOSSARY.md.

### human · 2026-10-09T19:45:42.492Z

Resolved: see the resolution comment; spec v0.1 §3.4
