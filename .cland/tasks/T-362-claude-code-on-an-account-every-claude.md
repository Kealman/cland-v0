---
id: T-362
kind: task
title: "Claude Code on an account: every claude command for a session runs under its account's CLAUDE_CONFIG_DIR, and agents --json is polled once per config directory that has live sessions"
state: open
status: in progress
size: M
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-272
blocked_by:
  - T-265
  - T-361
topic: topic-228
branch: t/T-362-claude-code-on-an-account-every-claude
created: 2026-10-13T23:42:53.650Z
updated: 2026-10-14T01:36:21.102Z
---

## Summary

Claude Code sessions can launch on a named account. Every `claude` command the adapter runs for a session runs under that account's `CLAUDE_CONFIG_DIR`: `--bg`, `agents --json`, `stop`, a relaunch's `--resume`, and the attach command. T-265's polling budget becomes one schedule per config directory that has live cland sessions, so an idle directory is never polled with `agents --json`.

## Parent

E-272: Accounts and limits, tracer bullet 2 of 6, the Claude Code half. Ticket T-361 has the registry and the Codex and OpenCode adapters. Spec: `docs/spec/v0.1.2.md` §3.13 ("every process the adapter starts or queries for a session, `agents --json` included, runs in the account's environment"). The epic's choices say the Claude adapter polls `claude agents --json` once per config directory with live cland sessions, never in an idle one, and never runs `claude auth status` or `claude doctor` on a timer. Research: `docs/research/account-limits.md` sections 1.2 and 5.2:

- the background supervisor is "a separate instance with its own sessions" per directory;
- `ANTHROPIC_API_KEY` beats a subscription login once approved, and always beats it in `-p`;
- each directory keeps its own trust and MCP state.

Upstream: anthropics/claude-code#95822, open on 2026-10-14.

## What to build

**The overlay on every command.** `hub/src/adapters/claude-code.ts`:

- `#run` takes the session's `accountEnv` (ticket T-361's row field) for `--bg` (a launch, and a relaunch with `--resume`), `stop` and `agents --json`.
- `attachCommand` returns `CLAUDE_CONFIG_DIR=<dir> claude attach <id>` for a session on an account, and the same command as today for a default session.
- Ticket T-361's refusal of Claude Code accounts is removed.

**The polling directory.** T-265 keys its schedule by the effective config directory. That directory is the account's `config_dir`, else the hub's own `CLAUDE_CONFIG_DIR`, else `~/.claude`. The row records it even for a default launch, so a hub started from a shell that sets `CLAUDE_CONFIG_DIR` polls the right supervisor.

- One `agents --json` per directory per interval, only for directories with at least one watched session. The watch poll, the launch's pid discovery and a hub-restart resume share that one schedule.
- A directory whose last session stops is no longer polled.
- A registered directory with no session is never polled.
- The pid liveness check (`process.kill(pid, 0)`) stays on its short tick, because it runs no `claude` command.

**The environment of an account's session.** A session on a named Claude Code account starts with `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN` removed from the environment the hub passes on. Otherwise a stray key in the hub's shell would silently move the work onto API billing, or onto another login (research 1.2). Removing them reads none of their values. A default session keeps today's environment.

**Failures.**

- A `--bg` that fails on an account names the account, its directory and the remedy, with no retry. The remedy is to sign in (`CLAUDE_CONFIG_DIR=<dir> claude auth login`) or to trust the project once under that directory (`CLAUDE_CONFIG_DIR=<dir> claude` in it), since each directory keeps its own trust state.
- T-265's logged-out event and message name the account as well as the directory.

**The fake.** `hub/test/fakes/claude-code/fake-claude.ts`:

- It partitions its sessions by `CLAUDE_CONFIG_DIR` (unset meaning the default), so `agents --json` lists only that directory's sessions, as the real per-directory supervisor does.
- It appends every CLI call (subcommand, `CLAUDE_CONFIG_DIR`, time in ms) to `invocations.jsonl` under `FAKE_CLAUDE_HOME`. Extend T-265's log if T-265 added one.
- A session's job record keeps its directory and the names (never the values) of the auth variables it saw.

**Docs.** In `hub/README.md`, the Claude Code adapter table covers the overlay on each command, the polling per directory and its interval, and the removed variables. The Accounts section covers `config_dir`.

**Demo.** A Claude session on claude-b and one on claude-a. The fake's invocation log shows each command under its directory, and one `agents --json` per directory per interval.

**Out of scope.** Limits from the mod (ticket T-363). Idle `claude -p "/usage"` polls (ticket T-364). The limited mark (ticket T-366). Moving a conversation between directories: a relaunch always stays on the row's directory.

**Constraints.**

- Tests go through the frame protocol first, with the fake Claude Code reached through `CLAND_CLAUDE_BIN` and its PATH, never a real `claude` and never a real config directory.
- Every directory is a scratch directory of the test's own.
- The interval is shortened through `CLAND_ADAPTER_POLL_MS`.
- Read `hub.log` and `journal.jsonl` only after the `flushLogs` barrier.
- No new seams inside the hub, and no helpers added to `hub/test/harness.ts`. Classify new test files in `hub/test/shards.json`.
- Suites run through `cland verify` after a clear review at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. Sessions launched on claude-a and claude-b: the fake's invocation log shows each session's `--bg`, `agents --json` and `stop` under its own account's `CLAUDE_CONFIG_DIR`, and each job record shows that directory.
- [ ] C2. With sessions live under two directories and a short `CLAND_ADAPTER_POLL_MS`, the log has at most one `agents --json` per directory per interval, launch discovery included. It has none for a registered directory with no session, and none for a directory after its last session stopped.
- [ ] C3. After a hub restart with sessions under two directories, resume makes one `agents --json` per directory and re-finds every session, and a relaunch runs `--bg --resume` under the row's directory.
- [ ] C4. The row's `attach` for a claude-b session is `CLAUDE_CONFIG_DIR=<dir> claude attach <id>`, and running it attaches to that directory's session in the fake. A default session's attach command is unchanged.
- [ ] C5. A session on a named Claude Code account does not receive `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or `CLAUDE_CODE_OAUTH_TOKEN` from the hub's environment (the fake records the names it saw), and a default session still does.
- [ ] C6. A hub started with `CLAUDE_CONFIG_DIR` set polls that directory for default sessions and records it on their rows.
- [ ] C7. A logged-out claude-b directory gives one event and one message naming account claude-b and its directory, while claude-a sessions keep working and their poll is unchanged.
- [ ] C8. A failed `--bg` on an account names the account, the directory and the sign-in or trust remedy, and is not retried.
- [ ] C9. `hub/README.md` describes the overlay per command, the per-directory polling and its interval, and the removed variables.
