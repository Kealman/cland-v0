---
id: Q-89
kind: question
title: "Session hierarchy: levels, reporting, routing and names"
state: closed
labels:
  - wayfinder:grilling
assignee: human
parent: M-81
blocked_by:
  - Q-82
  - Q-84
topic: null
branch: null
created: 2026-10-09T19:09:42.721Z
updated: 2026-10-09T20:06:44.219Z
closed: 2026-10-09T20:06:44.221Z
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

## Comments

### human · 2026-10-09T20:06:39.347Z

Resolution (2026-10-09, the human accepted every point).

- The hierarchy is the item tree (release, epic, item), not a separate tree of sessions: sessions attach to nodes as leads. The Coordinator leads the root; a session of the new role Lead leads an epic or a release; an Implementer leads the item it claims, implicitly. No launched-by link; pooled Reviewers and QA serve many nodes.
- Routing: an event or report about an item goes to the nearest lead up the chain (item, epic, release, Coordinator, human); messages with no item go to the Coordinator; `@lead T-n` resolves to the node's current lead; the human writes to the Coordinator by default and may write to any lead.
- Asks go up one level; a lead answers or forwards unchanged with one call; only the root's lead asks the human.
- Permissions by level: a Lead plans its epic, launches and stops sessions for its items, requests review and QA from the pools, merges its epic's items; the Coordinator keeps release, sync, push, the merge of unscheduled items and the launch of Leads; an item's lead requests review and QA itself and reports ready or blocked; handover moves a node's lead with the note.
- Growth: the crew configuration names the levels with dedicated Leads (`leads = ["epic"]`; empty = flat as today); item leads are always implicit.
- Regardless of hierarchy (inputs to T-91): progress notes fold into the next turn; subscriptions replace polling and relays; idle and death notices reach the node's lead.
- Names: Lead (role and claim), Coordinator stays the root's lead, "lead chain" for the route; not manager, supervisor, commander.
- GLOSSARY: Lead added, Coordinator rewritten. ADR 0006 "The hierarchy is the item tree; leads are hub-held claims on nodes".

Recorded in docs/spec/v0.1.md §3.7, GLOSSARY.md and docs/adr/0006-the-hierarchy-is-the-item-tree.md.

### human · 2026-10-09T20:06:44.219Z

Resolved: see the resolution comment; spec v0.1 §3.7; ADR 0006
