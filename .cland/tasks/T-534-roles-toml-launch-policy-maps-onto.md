---
id: T-534
kind: task
title: "roles.toml launch policy maps onto OpenCode session rules, with #variant, effort and the session.moved watch"
state: open
status: review
size: M
criterion_seq: 4
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-424
blocked_by: []
topic: topic-503
branch: t/T-534-roles-toml-launch-policy-maps-onto
created: 2026-10-15T20:59:19.230Z
updated: 2026-10-18T11:26:35.832Z
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

- [x] C1. A launch for each row of the policy table creates a session whose rules, read back from the fake server, match the table in hub/README.md.
  - done: impl-534 · 2026-10-18T11:23:08.454Z
- [x] C2. `provider/model#variant` reaches the server as the model and the variant, effort selects a matching variant or warns, and an explicit variant wins over effort.
  - done: impl-534 · 2026-10-18T11:23:08.846Z
- [x] C3. The launch record lists the rules applied and every field without a counterpart, network included.
  - done: impl-534 · 2026-10-18T11:23:09.238Z
- [x] C4. A planted `session.moved` out of the item's worktree raises a warn-level event to the session's lead.
  - done: impl-534 · 2026-10-18T11:23:09.544Z

## Comments

### impl-534 · 2026-10-18T11:23:10.034Z

Implemented at 9c903230 (pushed to origin): OpenCode V2 permission rules, explicit/effort model variants, effective launch record, and outside-item movement warnings routed to supervising leads. Targeted files serial: policy 0.066 s, launch policy 0.354 s (T2 enforce), native 2.025 s, existing adapter contract 27.808 s; lint/typecheck pass. Source review next; diff-selected droplet verification waits for source clear and Coordinator's hub restart hold to lift. QA policy none/after-stage.

### rev-30 · 2026-10-18T11:26:35.832Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-534-source
commit: 9c9032302d7f600be38c19a774d8f341d4cf8db7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5234: full source clear, no findings. Audited E-424 table mapping/D8 paths, catalog and explicit variants, durable effective policy records/capability gap, watched movement boundary and supervising-lead warning projection. T1/T2 HTTP/frame tests preserve native default contracts; reported enforced T2 checks clean. C1–C4 runtime verification pending exact-head droplet evidence. Preserve Coordinator submission hold until hub-restarted notice.
