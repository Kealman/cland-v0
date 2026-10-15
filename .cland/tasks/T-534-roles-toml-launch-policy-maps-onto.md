---
id: T-534
kind: task
title: "roles.toml launch policy maps onto OpenCode session rules, with #variant, effort and the session.moved watch"
state: open
status: planned
size: M
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-424
blocked_by: []
topic: null
branch: null
created: 2026-10-15T20:59:19.230Z
updated: 2026-10-15T20:59:36.657Z
---

## Summary

E-424 slice 4 (tracer step 4). roles.toml's launch policy reaches OpenCode sessions. Approval, sandbox, permissions, the item rule (D8) and effort map onto OpenCode's per-session rules at creation, and `provider/model#variant` is parsed. A Code Mode `session.moved` out of the item's worktree raises a warn-level event to the lead.

## What to build

The table and the watch are specified in E-424's "The policy table" and "D8 and Code Mode" bullets.

- **approval.**
  - `never` allows what the sandbox permits and denies the rest.
  - `on-request` asks for the rest.
  - `untrusted` asks for every shell command.
- **sandbox.**
  - `read-only` denies every edit and write tool.
  - `workspace-write` allows edits inside the cwd and `writable_roots`, and denies the rest through `external_directory` rules.
  - `danger-full-access` allows everything.
  - `""` leaves OpenCode's own rules.
- **network.** It has no counterpart, and the launch record says so.
- **permissions.** `permissions = "skip"` allows everything.
- **item.** It denies edits outside the item's worktree.
- **effort.** It selects the model's variant of that name from `GET /api/model`, or none with a warning. An explicit `#variant` wins.
- **Launch record.** It lists the rules applied and each field without a counterpart. The capability declaration says "rules, not a sandbox".
- **Moves.** The adapter watches `session.moved`, and a move out of the item's worktree is a warn-level event to the session's lead.

Code: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/client.ts`; the table also goes in hub/README.md's OpenCode section.

## Acceptance criteria

- [ ] C1. A launch for each row of the policy table creates a session whose rules, read back from the fake server, match the table in hub/README.md.
- [ ] C2. `provider/model#variant` reaches the server as the model and the variant, effort selects a matching variant or warns, and an explicit variant wins over effort.
- [ ] C3. The launch record lists the rules applied and every field without a counterpart, network included.
- [ ] C4. A planted `session.moved` out of the item's worktree raises a warn-level event to the session's lead.
