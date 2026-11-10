---
id: T-1777
kind: task
title: "`cland login add` for disk logins, signed in from the terminal"
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1772
  - T-1773
  - T-1774
  - T-1776
topic: topic-1460
branch: t/T-1777-cland-login-add-for-disk-logins-signed
created: 2026-11-09T12:44:09.265Z
updated: 2026-11-10T05:21:40.133Z
---

## Summary

`cland login add <harness> [--name <n>] [--pool <pool>] [--account <a>]` reuses a ready host of the pool or boots one. It creates an empty 1 GiB volume in the pool's region, attaches it and mounts it at `/cland/auth/<harness>-<login>`, then opens the harness's own sign-in over `ssh -t` in the human's terminal, with the disk as the harness home. On success the hub unmounts the disk, snapshots it, detaches it and marks the login `ready` with its last sign-in. On failure the login is `signed-out`, with its empty volume detached and kept.

## What to build

Two frames around a terminal step:
- **`login.add`.** The hub writes the row as `creating`, picks or creates the host, creates, attaches and mounts the volume, and answers with the host and a sign-in plan. The plan holds no credential.
- **The terminal step.** The CLI runs `ssh -t`, built the way `terminalAttachCommand` builds its command, with the home variable set to the mount:
  - Claude Code: `CLAUDE_CONFIG_DIR=<mount> claude auth login`.
  - Codex: the hub first writes `config.toml` with `cli_auth_credentials_store = "file"` into the empty `CODEX_HOME=<mount>`, then the CLI runs `codex login --device-auth`.
  - OpenCode: `OPENCODE_DB=<mount>/opencode.db opencode auth login`.
- **`login.signed-in`.** The CLI reports the sign-in's exit status. On exit 0, the hub unmounts, takes one snapshot, detaches and marks the login `ready`. Retention and the rate limit belong to T-1781.

Defaults and limits:
- `--pool` defaults to `agents`, or to the only pool.
- `--name` defaults to `<harness>-<n>`, with the lowest free n.
- The volume name is derived from the project tag and the login name, within the helper's pattern.
- **The host.** Any ready host of the pool is used, even a full one. Without one, the hub creates a host through the same path as `cland host create`, counted toward `max_hosts`; at `max_hosts` with no host ready or booting, the add is refused naming `max_hosts`.

cland never reads the disk. Success is the sign-in's own exit status, and no step runs a logout.

## Acceptance criteria

- [ ] C1. With a ready fake host in `agents`, `cland login add codex` creates an empty 1 GiB fake volume in the pool's region, mounts it at `/cland/auth/codex-<name>`, and runs the fake `codex login --device-auth` over `ssh -t` with `CODEX_HOME` at the mount and a `config.toml` there holding `cli_auth_credentials_store = "file"` (test).
- [ ] C2. `cland login add claude-code` runs the fake `claude auth login` with `CLAUDE_CONFIG_DIR` at its mount, and the login then reads `ready`, detached, with one snapshot id and its last sign-in (test).
- [ ] C3. With no host in the pool, `cland login add` creates one and signs in on it once it is ready (test).
- [ ] C4. A sign-in that exits nonzero, or a CLI that disconnects before reporting, leaves the login `signed-out` with its volume unmounted, detached and kept (test).
- [ ] C5. While the sign-in runs, the login reads `creating` and is neither free nor bound (test).
- [ ] C6. The fake login file's token appears in no argv, frame, log line or journal record of the flow, and the fake's calls file records no logout (test).
- [ ] C7. A source check finds no logout command (`codex logout`, `claude auth logout`, `/logout`) in any command cland builds for a harness (test).

## Blocked by

- T-1772
- T-1773
- T-1774
- T-1776

## Notes

- Hot files: `hub/src/host/login-signin.ts` (new: the sign-in runner T-1790 and T-1791 reuse), `hub/src/host/logins.ts` (transitions), `hub/src/cli/login.ts` (`add`), `hub/src/cli/usage/login.ts`. Registration points: `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`. No `pool-runtime.ts` edit: the host is created through the `cland host create` path.
- Tests: new `hub/test/login-add.test.ts` (T3: CLI-started hub, fake provider, fake transport with `fake-ssh`, the fake binaries of T-1774); T2 cases for the failure paths with an injected sign-in runner.
- Serves epic C1 and C7.

## Comments

### impl-1777 · 2026-11-10T05:12:00.663Z

Rule-20 sweep: shared suite graph reached 678 tests and 16 unknowns (all counted reached), captured in topic artifact. Explicit consumers: cli/login.ts, protocol.ts, shared/wire/index.ts, hub/dispatch.ts, hub/web-authority.ts, host/logins.ts, login-list.test.ts (previous reply shape regression), login-records.test.ts, host-contract*.ts, host-attach*.test.ts, web-authority*.test.ts, cli usage commands.json, QA E-1535-stage-1, implement skill and session-permissions docs. Additive frames only; existing list/store records remain byte-shape compatible. New metadata mutation methods update creating rows only. No existing wire frame changes; catalog fixtures unaffected. CLI and permission docs receive additive add guidance.

### impl-1777 · 2026-11-10T05:15:54.771Z

Additional rule-20 sweep for approved fake-ssh seam: shared transitive graph captured in topic artifact (all unknowns counted reached). Explicit dynamic consumers include fake-ssh.test.ts and its per-file doc, host-create-fixture.ts, host-create-ready.test.ts, host-attach tests, host-login-disk tests, ssh transport tests and QA stage fixtures. Existing raw commands unchanged; only exact sign-in forms map under authenticated machine; other /cland/auth commands refuse. Native consumer checks will run in preservation slot.

### impl-1777 · 2026-11-10T05:17:05.280Z

Incident: red test used raw fake-ssh commands CLAUDE_CONFIG_DIR=/cland/auth/claude-code-work claude auth login; CODEX_HOME=/cland/auth/codex-work codex login --device-auth; OPENCODE_DB=/cland/auth/opencode-work/opencode.db opencode auth login. Only synthetic stdin was supplied. HOME was fixtureEnvironment(root) -> host.directory/home in disposable fs-* root/short ct-* alias; PATH was inherited safe base PATH, with installed harness locations (mistake). Native Claude output said Opening browser to sign in; actual open invocation is unknown, Coordinator observed no newly started browser. Fixture teardown removed scratch roots and joined children; no scratch credential is retained. Inspecting /cland paths for outside-root writes; output containing link was not exported. Post-fix routing already ran once before decision arrived (Claude/Codex green, OpenCode path failed); further runs stopped until incident and guard requirements complete.

### impl-1777 · 2026-11-10T05:17:33.488Z

Incident follow-up: read-only inspection found no /cland directory or files, hence no observed writes there. Cannot prove every possible outside-root write by installed binary; browser/open invocation remains unknown. No native output exported. All fake-ssh.test environments now prepend a scratch bin containing only fake harness wrappers and Node, with PATH limited to that bin:/usr/bin:/bin; installed harness locations removed. Exact sign-in dispatch uses absolute committed fake binaries; unknown /cland/auth forms refuse. Added planted PATH harness trap regression before rerunning.

### impl-1777 · 2026-11-10T05:21:40.133Z

Authorized prefactor: pure move of inline fake-login-disk validation into agent/fake-login-mount.ts; shared/fake-layout.ts adds only lexical join primitive, via exact agent owner. No tests edited in this commit. Follow-on feature reuses helper at publish/append/write boundaries. Rule-20 sweep extension: agent operations.ts, prepared.ts, files.ts, ssh-host.ts, local.ts, attach/launch-files callers, runtime delivery and host clone writers, host-contract tests, T-1776 host-login-disk/cland-auth tests, T-1778 login-binding loginDisk use, docs/hub/logins.md and QA stage briefs. Existing ordinary paths unchanged; generated closure updated.
