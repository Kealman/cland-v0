---
id: T-41
kind: task
title: Review and QA through the roles
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-26
  - T-30
  - T-35
topic: null
branch: null
created: 2026-10-08T11:55:49Z
updated: 2026-10-08T13:17:15.607Z
github:
  repo: Kealman/cland-v0
  number: 41
  url: https://github.com/Kealman/cland-v0/issues/41
---

## Parent

Part of #19. Spec sections 4.10 and 6 (g); decisions https://github.com/Kealman/cland-v0/issues/10 (addendum), https://github.com/Kealman/cland-v0/issues/6 and https://github.com/Kealman/cland-v0/issues/16; research `docs/research/qa-astra.md` on branch `research/qa-astra`.

## What to build

The Coordinator requests a review or a QA pass through the hub: a message to the session holding the Reviewer role (Codex with gpt-6.1-sol by default) or the QA role (Codex with gpt-6-astra) naming the item and what to check; the role's clause tells it how to work and to record its verdict as a structured comment on the item (`verdict: review | qa`, `result: clear | not clear`, `by`, `run`), which the item view and the board show. QA in slice 1 checks what it can without the QA lane: shell-level checks, the `cland task` CLI, and a headless Neovim driven by `nvim_input` with `screenstring()`. `/codex:rescue` remains the documented fallback for both. The role clauses for Reviewer and QA are written and shipped in `roles.toml` defaults.

## Acceptance criteria

- [ ] A review request from the Coordinator reaches a real Codex session holding Reviewer; its verdict comment lands on the item with the structured header; the item view shows "review clear" or "not clear"
- [ ] The same for QA with astra, including one headless Neovim check in its run
- [ ] A verdict written by a session not holding the role is refused by the hub
- [ ] The fallback path through `/codex:rescue` is documented in the Reviewer and QA clauses and tried once
- [ ] The run is recorded in a comment on this ticket with the item used
