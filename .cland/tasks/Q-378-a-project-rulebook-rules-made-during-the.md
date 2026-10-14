---
id: Q-378
kind: question
title: "A project rulebook: rules made during the work, kept with the project and fed into every harness's init prompts"
state: open
labels:
  - ready-for-human
assignee: null
parent: R-294
blocked_by: []
topic: null
branch: null
created: 2026-10-14T08:37:38.891Z
updated: 2026-10-14T08:37:38.891Z
---

## Open question

Observation from the human (2026-10-14, during the v0.1.2 build). The rules that come up while a project is built, the human's preferences for how the work is done (which model for which role, one suite at a time, how briefs address roles, when to merge, what never to do), live today in the Coordinator's own memory: the harness's auto-memory of that one session. That is not portable (switch the Coordinator's harness and the rules are gone) and not structured (one note per fact, no scope, no order, no way to see them all).

The human wants a project-level rulebook: rules created as the work goes, kept with the project, and referenced from the init prompts of the harnesses (the role clauses, the brief at launch, AGENTS.md) so that every session of every harness reads the same rules.

To decide: the shape of the rulebook (a file under .cland or docs with rules that carry an id, a scope such as all roles or one role, a date, the reason, and a status); how a rule is added (by the human in the workbench or the CLI, by the Coordinator when the human states one in a thread, through a `rule` tool so that recording a rule replaces writing it into a private memory); how the hub delivers it (the clause names the rulebook and its rules for the role; a changed rule reaches running sessions as a delivery; the brief at launch includes it); how it relates to AGENTS.md (static project instructions written by hand) and to the harness memories (they become caches or stay out of the loop); what the workbench shows (a rules view, the rule's origin message); and how the rules this project already accumulated in the Coordinator's memory are migrated as the seed. Relates to v0.1 §3.3 (the brief at launch), §3.9 (events as deliveries), the role clauses in roles.toml, and the hub's launch files.
