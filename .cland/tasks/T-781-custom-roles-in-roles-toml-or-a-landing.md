---
id: T-781
kind: task
title: Custom roles in roles.toml, or a landing card that claims none
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: topic-956
branch: t/T-781-custom-roles-in-roles-toml-or-a-landing
created: 2026-10-18T06:04:23.355Z
updated: 2026-10-24T09:42:35.349Z
---

## Summary

The landing's crew section ends with a card "+ your own role: a docs writer, a security reviewer, an epic lead. A role is a few lines in `.cland/roles.toml`". Today `roles.toml` refuses unknown roles, and no spec covers custom roles. The human chose to ship custom roles (option a, General 2026-10-24 09:40Z, answer to ask 2e5b9645); the card stays as written.

## What to build

A custom role is a `roles.toml` table with its own clause, hub tool grants, launch harness, model and effort, and skills, launched like a built-in role. Tool grants are validated against the known tool table and default to deny. A custom role can never hold Coordinator-only tools, the human's authority, or the review and QA verdict authority unless the design agreed with the Coordinator says otherwise.

## Acceptance criteria

- [ ] C1. A role named in roles.toml but not built in launches with its own clause, tools, harness and model, and its clause reaches the session on launch and on reconnect (test).
- [ ] C2. An unknown tool, a forbidden grant, or a name that clashes with a built-in role is refused when roles.toml loads, with an error naming the field (test).
- [ ] C3. site/src/content/docs/docs/crew.md and the landing card describe custom roles as they ship, with one worked example (docs).

## Comments

### coord · 2026-10-24T09:40:49.155Z

Decision (human, General 2026-10-24 09:40Z, answer to ask 2e5b9645): (a) custom roles ship. A role is a roles.toml table with its own clause, tools, harness and model, launched like the built-in roles. The landing card stays as written.

### impl-781 · 2026-10-24T09:42:35.349Z

Design-first exploration complete; proposed namespaced custom roles, deny-by-default grants with an immutable advisory-role ceiling, loaded-role launch/reconnect/client rows and T1/T2/client test seams. Design submitted to Coordinator in topic-956; production code waits for approval.
