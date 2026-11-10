---
id: T-1778
kind: task
title: Binding a login at launch on a running host
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1772
  - T-1773
  - T-1776
topic: null
branch: null
created: 2026-11-09T12:44:09.501Z
updated: 2026-11-10T05:08:02.855Z
---

## Summary

A launch placed on a pool host binds a login of its harness when the host holds none. The hub picks a `ready` login of the pool's region, narrowed to the role's `account` when it has one, attaches and mounts its volume, and starts the session with the harness home at the mount. The login reads `in-use <host>`, later sessions of that harness on the host reuse the binding, and the session row records the login and its account.

## What to build

A login binding step inside the launch placement, after the host is reserved and before the spawn. A bind attaches and then mounts through `loginDisk`, and the binding is recorded in `login_bindings`. The spawn environment carries `CLAUDE_CONFIG_DIR`, `CODEX_HOME` or `OPENCODE_DB` at the mount, in place of any local account path. Account limits (spec v0.1.2 §3.13) keep applying by the login's account name.

Harness spawns on hosts carry none of the stray variables:
- `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`;
- `OPENAI_API_KEY`, `CODEX_API_KEY` and `CODEX_ACCESS_TOKEN`.

With no ready login, until T-1784 the launch is refused with "no login <harness> in pool <pool>". A failed bind detaches what it attached and returns the login to `ready`. Local launches are unchanged.

## Acceptance criteria

- [ ] C1. A launch on a ready fake host with no binding attaches and mounts a ready login of its harness, starts the session with the harness home variable at the mount, and the login reads `in-use <host>` (test).
- [ ] C2. A second session of the same harness on that host reuses the binding with no attach (test).
- [ ] C3. A role with `account = "work"` binds only a login of account `work`, and the session row records the login name and the account (test).
- [ ] C4. The process row's account environment holds the mount path only, and the spawned environment holds none of the five stray auth variables (test).
- [ ] C5. A mount failure detaches the volume, leaves the login `ready`, and fails the launch naming the login (test).
- [ ] C6. A local launch reads no login and starts as before (test).

## Blocked by

- T-1772
- T-1773
- T-1776

## Notes

- Hot files: `hub/src/host/login-binding.ts` (new), `hub/src/adapters/sessions.ts` (`withLaunchPlacement`), `hub/src/host/agent/command-environment.ts` (the stray variables), `hub/src/adapters/processes.ts` (the login on the row).
- Tests: new `hub/test/login-binding.test.ts` (T2, provided fake Hosts with a recording `loginDisk` and fake provider volumes); one case on the host-create fixture (T3).
- Serves epic C2.
