---
id: T-30
kind: task
title: Hub permissions by role and the audit log
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: E-19
blocked_by:
  - T-29
topic: null
branch: null
created: 2026-10-08T11:54:27Z
updated: 2026-10-10T00:58:17.373Z
github:
  repo: Kealman/cland-v0
  number: 30
  url: https://github.com/Kealman/cland-v0/issues/30
---

## Parent

Part of #19. Spec section 4.4 (permissions table) and 4.2; decision https://github.com/Kealman/cland-v0/issues/10 with its addendum; https://github.com/Kealman/cland-v0/issues/13 (audit log).

## What to build

The hub enforces the permission table on every tool call by the calling session's role: the Coordinator may send to anyone, ask the human, create topics, claim and assign items, request session launches, hand over its role and resolve; the Implementer may send, create topics bound to its own item, comment on and claim its own item; Reviewer and QA may send, read history and who, and write verdict comments on items; a session without a role has no tools. Tools that do not exist yet (asks, items) get their checks when they arrive, through the same table. Every tool call is written to the audit part of the journal with the session name, the role and the outcome, which is the v0 answer to sub-agents calling tools through their parent's spoke (the clause forbids it; the log makes violations visible).

## Acceptance criteria

- [ ] A refused call returns a typed error naming the missing permission; the UI shows it in the Agents topic
- [ ] Every call, allowed or refused, appears in the journal with session, role, tool and outcome
- [ ] Changing a session's role changes its permissions on the next call without a reconnect
- [ ] Tests exercise every row of the table for every role with a real hub and scripted spokes

## Comments

### Kealman · 2026-10-08T15:36:47Z

<!-- github-comment: 6063463188 -->

Done on main (6347ce9..6c6e3fb, merged at 38afe0b): the permission table per role with scopes (send:agents/human, task.claim:own, task.comment:own/verdict, topic.create:own), overridable from roles.toml, enforced at the dispatcher on every spoke call by the live role; typed forbidden results with a notice in Agents; audit records for every call in the hub log and cland hub audit; table-driven tests per role. Open: a session the human @mentions cannot reply to the human (decision pending: allow a reply-to-mention grant); existing roles.toml files keep the pre-#30 lists; Agents notices for refusals are not rate-limited.
