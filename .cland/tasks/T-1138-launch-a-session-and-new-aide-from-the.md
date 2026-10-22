---
id: T-1138
kind: task
title: Launch a session and New Aide from the header
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1132
topic: null
branch: null
created: 2026-10-22T15:16:16.038Z
updated: 2026-10-22T15:16:16.038Z
---

## Summary

Launch a session (`l`) and New Aide (`a`) open a small form with the role's defaults from `roles.toml`, the item and the brief, as Neovim's launcher does; the directory is always the project's.

## Parent

E-418 (§3.2 the header; v0.1 §3.3 the Aide; tracer step 3).

## What to build

The header's Launch a session and New Aide buttons, `l` and `a` in the Sessions area, and two palette actions open an in-place form: name, role (from the hub's roles), harness, model (the harness's models, fetched with `models.list` when the field is focused), account (from the registry), effort, item and brief (text or an artifact id). Choosing a role fills the harness, model, account and effort from its launch defaults; changing the harness clears the model and effort meant for the other one. New Aide preselects the Aide role with `[roles.aide]`'s defaults.

The form has no directory: the hub starts the session in the project root, or with an item in that item's task worktree, and refuses a directory from the web (the hub slice). Enter launches and Esc cancels. The hub's refusals (a name in use, the Coordinator held, a limited account with its reset, an unknown harness) show under the fields. The new session appears in its group as its row arrives. Neovim's `launcher.lua` defines the behaviour.

## Acceptance criteria

- [ ] C1. `a` in Sessions opens the form with the Aide role's defaults, Enter launches it, and the new Aide appears under Yours and in `cland session list` with the project root as its directory (Web test with the fake harness).
- [ ] C2. Choosing a role in `l`'s form fills harness, model, account and effort from `roles.toml`, and changing the harness clears the model and effort (Web test).
- [ ] C3. A launch on a limited fake account shows the hub's refusal with the account's reset under the form, and nothing launches (Web test).
- [ ] C4. The form has no directory field, and its `session.launch` frame carries no directory (Web test).
- [ ] C5. `web/README.md` describes the launch form and its keys (docs).
