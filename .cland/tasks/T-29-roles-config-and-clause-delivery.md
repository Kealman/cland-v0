---
id: T-29
kind: task
title: Roles config and clause delivery
state: closed
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: T-19
blocked_by:
  - T-28
topic: null
branch: null
created: 2026-10-08T11:54:20Z
updated: 2026-10-08T18:56:26.192Z
github:
  repo: Kealman/cland-v0
  number: 29
  url: https://github.com/Kealman/cland-v0/issues/29
---

## Parent

Part of #19. Spec section 4.4; ADR 0001; decision https://github.com/Kealman/cland-v0/issues/10 (and its addendum).

## What to build

`.cland/roles.toml` defines the four roles (Coordinator, Implementer, Reviewer, QA) with, per role, a clause, a skill list, launch defaults (harness, model, effort: Coordinator Claude Code and Fable at max, Implementer OpenCode with a free model, Reviewer Codex and gpt-6.1-sol, QA Codex and gpt-6-astra, all editable). The human assigns and revokes a role on a session from the UI and the CLI (`cland role set <session> <role>`, `cland role clear <session>`); launching a session for a role uses the role's defaults. The hub delivers the clause as an event on assignment and on every reconnect of that session (replacing the placeholder first turn of the Codex adapter), never through harness-native instruction pins. Coordinator is exclusive: assigning it to a second session is refused; when no session holds it, the top bar and the inbox show a "no coordinator" warning. The role is shown with the session name everywhere (`rev-1 [Reviewer]`). Sessions without a role are not connected to the hub.

## Acceptance criteria

- [ ] Assigning a role delivers its clause to the session as a hub event; the journal shows the delivery; a reconnect of the session delivers it again
- [ ] A second Coordinator assignment is refused with a reason; revoking the only Coordinator shows the vacancy warning within one event
- [ ] A session launched for a role uses the role's launch defaults from `roles.toml`; editing the file changes the next launch
- [ ] The sessions panel, the picker and the top bar show the role with the name
- [ ] Tests cover assignment, exclusivity, clause redelivery on reconnect and the vacancy warning against fake harnesses

## Comments

### Kealman · 2026-10-08T14:45:53Z

<!-- github-comment: 6062429036 -->

Done on main (4aa29d3..3bcb9d3 plus the UI wiring in 3a16ec3): .cland/roles.toml with clauses, skills, launch defaults and permission lists (smol-toml, reloaded on edit), hub-held roles (role.set/clear/list frames and cland role CLI), the clause delivered as a hub notice on assignment and every hello, Coordinator exclusivity, role.vacant/role.filled events and the coordinator field in hub.status, roleless hellos refused, name shown with role; the shell's chip shows 'no coordinator' on the event (stub-hub test). Open: effort not stored for relaunch; clearing a role leaves the live session connected until its next reconnect; roles enforced only on a project hub.
