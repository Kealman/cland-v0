---
id: T-632
kind: task
title: cland role launch sets a role's launch fields, and cland role list shows them all
state: open
status: in progress
size: M
criterion_seq: 7
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by:
  - T-628
topic: topic-492
branch: t/T-632-cland-role-launch-sets-a-role-s-launch
created: 2026-10-16T16:04:12.070Z
updated: 2026-10-18T09:26:03.657Z
---

## Summary

`cland role launch <role> [--harness …] [--model …] [--effort …] [--account …] [--permissions …]` sets that role's `[<role>.launch]` fields in `.cland/roles.toml` through the hub and refuses a value the hub cannot read, so the onboarding's crew round and the human never edit launch fields by hand. `cland role list` shows every launch field, and `cland role set` keeps its meaning (spec v0.1.4 §3.5).

## What to build

- **The command.** Each flag sets one key with the roles.toml editor; flags given together land in one write. `--model ""` and `--account ""` clear the key to the harness's default. `--json` prints the role's launch fields as the hub reads them after the write.
- **Through the hub.** The CLI sends a request the hub serves, like `cland crew set`: the human, the Coordinator and an Aide may run it from their shells; a Lead, an Implementer, a Reviewer and QA are refused with a reason and the refusal shows in Agents. The hub checks the caller again just before it writes.
- **Refusals.** A value the hub cannot read is refused with its reason and the file stays as it was: an unknown role or harness, a `permissions` value the roles parser does not take, an account name the user-level accounts registry does not hold for that harness.
- **A harness change.** Changing `--harness` without `--model` and `--effort` resets the model to the harness's default and the effort to one the new harness takes (Claude Code `max`, Codex `high`, OpenCode none, as setup's prototype does), and the output names both changes.
- **When it applies.** The output says the fields apply from the role's next launch; when the caller holds that role, it adds that its own session keeps its settings until its next launch (the auto-mode classifier risk of §3.5: the Aide applies its own change last).
- **`cland role list`** shows, per role, the harness, model, effort, account, permissions, approval and sandbox as the hub reads them.
- The usage text lists `role launch` with its flags; `role set` still assigns a role to a session.

## Acceptance criteria

- [x] C1. `cland role launch implementer --harness codex --model gpt-6.1-sol --effort high` writes those keys into `[implementer.launch]`, keeps every other line of roles.toml, and `cland role list` shows them (new CLI test against a temporary project's hub).
  - done: impl-632 · 2026-10-18T09:26:03.657Z
- [ ] C2. `--permissions` writes any value the roles parser takes and `--account <name>` a registered account, and `cland role list` shows each role's account and permissions.
- [ ] C3. A harness change without `--model` and `--effort` resets the model to the harness's default and the effort to one the new harness takes, and the output names both changes.
- [ ] C4. An unknown role, an unknown harness, a permissions value the parser refuses and an account not registered for that harness are each refused with their reason, roles.toml unchanged (one test per case).
- [ ] C5. The human, the Coordinator and an Aide may run it from their shells, while a Lead, an Implementer, a Reviewer and QA are refused and the refusal shows in Agents (frame-protocol test).
- [ ] C6. The next `cland session launch --role <role>` uses the new fields without a hub restart, and the output says they apply from the role's next launch (test with the fake harnesses).
- [ ] C7. `cland role set` still assigns roles to sessions, and the usage text lists `role launch` with its five flags.

## Comments

### impl-632 · 2026-10-18T09:24:39.973Z

Implemented role.launch CLI/frame and serialized source-preserving roles editor updates. T2 red proof initially failed with unknown role command launch; current 13 role-launch tests cover combined flags, accounts/permissions, reset/default output, unchanged-file refusals, shell roles/Agents notices, next-launch settings, legacy role set, and authorization revoked while queued. Host lint/typecheck in progress; pre-review origin/dev merged at 226bd904.
