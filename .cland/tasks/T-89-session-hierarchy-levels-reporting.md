---
id: T-89
kind: question
title: "Session hierarchy: levels, reporting, routing and names"
state: open
labels:
  - wayfinder:grilling
assignee: human
parent: T-81
blocked_by:
  - T-82
  - T-84
topic: null
branch: null
created: 2026-10-09T19:09:42.721Z
updated: 2026-10-09T19:59:11.630Z
---

## Question

What is the model of a multi-level session hierarchy in cland: levels, who reports to whom, how messages route, who may launch and stop whom, how it is declared, and what the levels and roles are called?

## Context

Today one Coordinator sits over flat sessions: no launched-by link, every report, question and verdict reaches the Coordinator, and it drowns when many sessions run in parallel. The research "Where the Coordinator's time went in v0" quantifies the load and the lever each source suggests; "Hierarchical multi-agent orchestration: prior art and failure modes" offers three candidate shapes with vocabulary. The human wants a configurable management hierarchy that grows with the project: a strategic level over releases or epics, mid-level coordinators, task-level leads over implementer, reviewer and QA chains, reports flowing upward; not hard-coded, because a small project needs none of it. The human rejects taking military terms literally; the names are open. ADR 0001 makes roles hub-held state delivered as events; Coordinator is exclusive today.

## To decide

- The model: a session has a parent (launched-by or assigned); a role has a level; what a level owns (a release, an epic, an item).
- Routing: a report goes to the parent; the human addresses the top by default; how asks escalate; what reaches the top at all.
- Permissions: who may launch, stop, hand over, merge; what Coordinator exclusivity becomes.
- Declaration: in the crew file, per release or epic, or at launch; how the hierarchy shows in the sessions panel and the top bar.
- Names for the top, the middle and the leads (domain modeling with the GLOSSARY).
- An ADR extending 0001 for hierarchy as hub-held state.

Record the resolution as a comment, the spec section, the GLOSSARY entries and the ADR.
