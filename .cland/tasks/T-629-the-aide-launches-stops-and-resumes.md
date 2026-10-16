---
id: T-629
kind: task
title: The Aide launches, stops and resumes sessions of any role on the human's word
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by: []
topic: topic-388
branch: t/T-629-the-aide-launches-stops-and-resumes
created: 2026-10-16T16:04:11.671Z
updated: 2026-10-16T16:05:28.718Z
---

## Summary

The Aide's fixed tool boundary and its default grants gain `session.launch`, `session.stop` and `session.resume` for any role, the Coordinator and Leads included, from its spoke tool and from `cland` in its shell. Its clause limits these to the human's word and leaves the crew's staffing to the Coordinator during a build; every other role keeps its refusals (spec v0.1.4 §3.5, amending v0.1 §3.3).

## What to build

In both live onboarding runs (Q-596) the Aide could not start the Coordinator: the hub's Aide rule refused `session.launch` from its tool, and since a `cland` call from a session's shell is checked as that session's own (prototype/onboarding 36c09717), `cland session launch`, `stop` and `resume` in its terminal were refused too. After this ticket:

- The permission table's fixed Aide boundary admits the three session tools, and the Aide's built-in grant list and the shipped `[aide.permissions] tools` list name them. Grants stay hub permissions (ADR 0001), never a harness setting.
- The rule that only the Coordinator launches Leads admits an Aide as well; an Aide may stop and resume any session, the Coordinator's included.
- From the Aide's shell, `cland session launch`, `cland session stop` and `cland session resume` are decided by the table as the Aide's own calls and audited as the Aide; nothing in them is the human's alone any more for an Aide.
- A refusal of a tool still outside the Aide's boundary names the new boundary (tracker, artifacts, named sends, topics, history, who, status, and sessions on the human's word).
- The shipped Aide clause drops launching, stopping and resuming from what it cannot do and says: on the human's word it launches, stops and resumes sessions of any role, the Coordinator first of all, with `session.launch` or `cland session launch | stop | resume` from its shell; it says what it will launch before doing it; during a build the Coordinator keeps the crew's staffing, so the Aide launches only when the human asks. It still never asks, resolves, merges, hands over, releases or syncs.
- The hub README's Aide section and permission table say the same.

Existing projects, whose `roles.toml` lists the Aide's tools explicitly, get the grants through the one-time migration ticket, not here. A running Aide gets new tools only after a hub restart and its relaunch (role tools are fixed at launch).

## Acceptance criteria

- [ ] C1. An Aide launches a Coordinator through its `session.launch` tool in a scratch project with the fake harnesses, in a new frame-protocol test.
- [ ] C2. In the same test the Aide launches an Implementer with `cland session launch` from its shell, then stops and resumes it with `cland session stop` and `cland session resume`, each audited as the Aide.
- [ ] C3. An Aide may launch a Lead and stop the Coordinator, while an Implementer, Reviewer and QA are still refused `session.launch`, `session.stop` and `session.resume` from their tools and their shells (permission tests).
- [ ] C4. A Lead keeps its subtree limits and its refusal of `session.resume`, and an Aide is still refused `merge`, `ask`, `resolve`, `role.handover`, `release` and `sync` even when its roles.toml list grants them (existing permission tests extended).
- [ ] C5. The shipped Aide clause says it launches, stops and resumes sessions only on the human's word and that the Coordinator keeps the staffing during a build, and no longer lists those three among what it cannot do.
- [ ] C6. The hub README's Aide section and permission table list the three grants and the limit to the human's word.

## Comments

### impl-629 · 2026-10-16T16:05:28.718Z

Implementation started. Read E-611 Coordinator decisions (2026-10-16). Testing at the specified frame-protocol seam with fake harnesses and session-identity CLI calls; existing project migration is out of scope (T-636).
