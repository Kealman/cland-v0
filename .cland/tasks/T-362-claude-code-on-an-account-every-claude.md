---
id: T-362
kind: task
title: "Claude Code on an account: every claude command for a session runs under its account's CLAUDE_CONFIG_DIR, and agents --json is polled once per config directory that has live sessions"
state: open
status: review
size: M
criterion_seq: 9
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
updated: 2026-10-14T02:28:11.579Z
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

- [x] C1. Sessions launched on claude-a and claude-b: the fake's invocation log shows each session's `--bg`, `agents --json` and `stop` under its own account's `CLAUDE_CONFIG_DIR`, and each job record shows that directory.
  - done: impl-362 · 2026-10-14T01:46:28.722Z
- [x] C2. With sessions live under two directories and a short `CLAND_ADAPTER_POLL_MS`, the log has at most one `agents --json` per directory per interval, launch discovery included. It has none for a registered directory with no session, and none for a directory after its last session stopped.
  - done: impl-362 · 2026-10-14T01:46:29.369Z
- [x] C3. After a hub restart with sessions under two directories, resume makes one `agents --json` per directory and re-finds every session, and a relaunch runs `--bg --resume` under the row's directory.
  - done: impl-362 · 2026-10-14T01:46:30.117Z
- [x] C4. The row's `attach` for a claude-b session is `CLAUDE_CONFIG_DIR=<dir> claude attach <id>`, and running it attaches to that directory's session in the fake. A default session's attach command is unchanged.
  - done: impl-362 · 2026-10-14T01:46:30.968Z
- [x] C5. A session on a named Claude Code account does not receive `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or `CLAUDE_CODE_OAUTH_TOKEN` from the hub's environment (the fake records the names it saw), and a default session still does.
  - done: impl-362 · 2026-10-14T01:46:31.745Z
- [x] C6. A hub started with `CLAUDE_CONFIG_DIR` set polls that directory for default sessions and records it on their rows.
  - done: impl-362 · 2026-10-14T01:46:32.373Z
- [x] C7. A logged-out claude-b directory gives one event and one message naming account claude-b and its directory, while claude-a sessions keep working and their poll is unchanged.
  - done: impl-362 · 2026-10-14T01:51:01.020Z
- [x] C8. A failed `--bg` on an account names the account, the directory and the sign-in or trust remedy, and is not retried.
  - done: impl-362 · 2026-10-14T01:46:34.011Z
- [x] C9. `hub/README.md` describes the overlay per command, the per-directory polling and its interval, and the removed variables.
  - done: impl-362 · 2026-10-14T01:46:34.696Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-362-2 · 2026-10-14T01:51:54.279Z · commit b9c38b66a08e4994e812b17f41653b66fcf3b698
  - verified: rev-23 [reviewer] · run rev-2026-10-14-362-3 · 2026-10-14T02:28:11.579Z · commit d8690923d4858beba892430e7bf6d47eb53b782b

## Comments

### impl-362 · 2026-10-14T01:42:09.010Z

Implementation now supports named Claude accounts, saves the default effective directory, scopes polling/signed-out latches by directory, and removes the three inherited auth variables for named accounts. New frame/fake tests cover command overlays, attach quoting, auth isolation, per-directory budgets, restart/relaunch retention, and independent signed-out recovery. Initial targeted account test passes; existing Claude and registry regressions are being checked before review.

### rev-23 · 2026-10-14T01:49:37.884Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-362-1
commit: 308d1754176f49f2ee0617ed04a9dd5df0f22046
scope: full

Medium — hub/test/claude-code-accounts.test.ts:126–129: a fixed 900ms sleep precedes the positive claude-a poll-count assertion, so slow CLI/scheduler work can fail correct account isolation. Use eventual readiness for the new a invocation and retain all signed-out b/count/state/event/notice/no-probe assertions. Complete source review found no additional high/medium production issue. C7 failed; C1–C6/C8 await corrected source and exact-head full evidence; C9 docs checked. A-2167: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2167-t-362-full-source-review-account-overlay-clear-c7-timing-blocker.md.

Criteria: C7 failed (The new signed-out isolation test requires a claude-a invocation after a fixed 900ms sleep; delayed CLI/scheduler work can fail correct behavior. Wait for the observed invocation while retaining all b/count/event/notice assertions.).

### rev-23 · 2026-10-14T01:51:54.279Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-362-2
commit: b9c38b66a08e4994e812b17f41653b66fcf3b698
scope: full

No high/medium findings remain. The C7 test now waits for the observed claude-a agents invocation; all b-count/a-growth/state/journal/notice/no-probe assertions remain unchanged. Only test readiness changed; complete account/environment/polling source review A-2167 remains applicable. C9 docs verified; C1–C8 await exact-head ordinary full cland verify evidence. A-2170: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2170-t-362-corrected-full-source-clear-at-b9c38b66.md. This is source clear, not final readiness.

Criteria: C9 verified.

### rev-23 · 2026-10-14T02:28:11.579Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-362-3
commit: d8690923d4858beba892430e7bf6d47eb53b782b
scope: delta

No high/medium findings. The 16-file test-only delta exactly equals shared T-371 8fe4c02d and its reviewed 8ed38949 patch (source A-2180/full evidence A-2190). No T-362 production/account test/docs delta; original full source review retained. C9 documentation refreshed; C1–C8 await ordinary full cland verify at this exact head. Old queued cancellation A-2181 supplies no execution evidence. A-2194: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2194-t-362-shared-t-371-delta-source-clear-at-d8690923.md. Source clear only.

Criteria: C9 verified.
