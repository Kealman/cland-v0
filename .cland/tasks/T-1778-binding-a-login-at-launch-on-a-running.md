---
id: T-1778
kind: task
title: Binding a login at launch on a running host
state: open
status: review
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1772
  - T-1773
  - T-1776
topic: topic-1461
branch: t/T-1778-binding-a-login-at-launch-on-a-running
created: 2026-11-09T12:44:09.501Z
updated: 2026-11-10T05:21:28.707Z
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

- [x] C1. A launch on a ready fake host with no binding attaches and mounts a ready login of its harness, starts the session with the harness home variable at the mount, and the login reads `in-use <host>` (test).
  - done: impl-1778 · 2026-11-10T05:21:15.830Z
- [x] C2. A second session of the same harness on that host reuses the binding with no attach (test).
  - done: impl-1778 · 2026-11-10T05:21:16.047Z
- [x] C3. A role with `account = "work"` binds only a login of account `work`, and the session row records the login name and the account (test).
  - done: impl-1778 · 2026-11-10T05:21:16.820Z
- [x] C4. The process row's account environment holds the mount path only, and the spawned environment holds none of the five stray auth variables (test).
  - done: impl-1778 · 2026-11-10T05:21:17.230Z
- [x] C5. A mount failure detaches the volume, leaves the login `ready`, and fails the launch naming the login (test).
  - done: impl-1778 · 2026-11-10T05:21:17.464Z
- [x] C6. A local launch reads no login and starts as before (test).
  - done: impl-1778 · 2026-11-10T05:21:17.807Z

## Blocked by

- T-1772
- T-1773
- T-1776

## Notes

- Hot files: `hub/src/host/login-binding.ts` (new), `hub/src/adapters/sessions.ts` (`withLaunchPlacement`), `hub/src/host/agent/command-environment.ts` (the stray variables), `hub/src/adapters/processes.ts` (the login on the row).
- Tests: new `hub/test/login-binding.test.ts` (T2, provided fake Hosts with a recording `loginDisk` and fake provider volumes); one case on the host-create fixture (T3).
- Serves epic C2.

## Comments

### impl-1778 · 2026-11-10T05:10:06.536Z

Rule 20 pre-change sweep: suite shared transitive importer graph over Sessions, HarnessProcess, ProcessTable and remoteCommandEnvironment reached 694 tests, plus 15 unknowns conservatively reached (full list in consumer artifact). Explicit consumers: adapters/index, session launch/resume/reuse/relaunch, accounts/registry, process persistence/pending-stop JSON, protocol HarnessProcessView and Sessions.view, CLI session lines, web/Neovim/session.list and startup discovery; shipped skills and QA docs use existing launch frames unchanged. Planned optional process login metadata is additive; older rows/replies remain accepted. Account registry lookup remains local only for pool binding. Existing provided-fixture pool tests without login disks need explicit fixture migration or a documented non-pool exemption; testing by changed paths alone is insufficient.

### impl-1778 · 2026-11-10T05:19:10.512Z

Rule-20 completion/update: binding phase consumers are LoginRecords.bindings/bind/transition/unbind/settleBinding, Dispatcher login.list, CLI ListedLogin/login rendering, login-records and login-list fixtures; unchanged legacy bindings omit phase. Session login consumers: ProcessTable row/JSON persistence, Sessions spawn/view/reuse, protocol.ts + shared/wire/index.ts, CLI/web/Neovim readers (optional additive key; old shape retained), fixture catalog/conformance tests. Explicit provider-ready sweep covered all 17 files: host-create-entry (T2, no session launch), host-provision-records (T1, store/runtime only), pool-spend-cap (T2, acquisition only), pool-scale (T2, scale only), host-restart-reconcile (T2, recovery only), login-binding (T2 new), waiting-launch (T2 migrated), host-unreachable (T2 retained process fixtures, no new launch), host-lease (T2, lease only), host-provision-recovery (T2, recovery only), pool-idle-stop (T2, lifecycle only), host-destroy (T2, destruction only), host-status (T2, projection only), pool-failures (T2 migrated), waiting-launch-restart (T2 migrated), host-stop (T2 migrated), session-pool-placement (T2 migrated). Shared helper settled-login-fixture.ts seeds explicit settled metadata; readyLogin seeds real directory-backed provider volumes for host-create-fixture.ts and host-create-ready.test.ts (T3 migrated). Only native file changed is host-create-ready; its fixture roots retain existing cleanup ownership. Pending binding phase is T-1793's reconciliation seam; T-1779 must skip it.
