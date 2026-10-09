---
id: T-48
kind: task
title: "Codex sessions launched by cland: approvals auto-approved and a per-role sandbox, so no check or commit waits on the human"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: impl-48
parent: T-19
blocked_by: []
topic: topic-2
branch: t/T-48-codex-qa-sandbox
created: 2026-10-08T19:48:52.717Z
updated: 2026-10-09T06:25:39.258Z
---

## Parent

Part of T-19. Found in the T-42 dogfooding run on 2026-10-08 (QA `qa-43`, Codex 0.160.0, gpt-6-astra, in `.cland/worktrees/T-43`).

## Problem

The QA clause tells the holder to run the tests, the `cland task` CLI and the CLI under test. In the Codex app-server's default sandbox every one of them that opens a Unix socket fails: `cland inbox` with `connect EPERM …/.cland/hub.sock`, and `npm test` (it starts temporary hubs). QA asked the human for four separate approvals (`cland inbox`, `npm run typecheck && npm test`, `cland topic answer no-such-ask 1`, `cland topic answer`), each surfacing as `waiting for approval` in the inbox. The human cannot safely approve a prefix: `cland topic answer` with other arguments answers real asks. The run took 15 minutes, most of it waiting on approvals. A rescue run, which declines every approval (spec 4.10), would fail the same checks.

Seen again in the real run of 2026-10-09 with Codex Implementers (impl-44, impl-45): every socket-opening command and every `git commit` from a worktree (its `.git` lives under the root's `.git/worktrees/`, outside the session's cwd) stops the session in `waiting for approval`. The adapter passes no approval policy and no sandbox to `thread/start`, so a launched session runs on Codex's defaults.

## Decision (the human, 2026-10-09)

Codex sessions launched by cland run with approvals auto-approved by default, not asking, inside a sandbox chosen per role.

## What to build

- `[<role>.launch]` in roles.toml gains `approval` and `sandbox` (with writable roots). The Codex adapter passes them to `thread/start`: `approvalPolicy` `never` by default; Implementer: workspace-write with the repo root (the main worktree) and `.cland/` as writable roots, and network or Unix sockets as the investigation finds; Reviewer: read-only; QA: workspace-write or read-only as its checks need. Defaults in `default-roles.ts` (what `cland init` writes) and in this repo's `.cland/roles.toml`.
- The investigation, recorded on the item with the exact parameters and overrides: what the installed app-server (0.160.0) offers for sockets (Unix sockets under the project and the temp dir with the network otherwise closed, or only the whole network) and for extra writable roots; the trade-off taken, documented.
- Docs: `docs/review-and-qa.md` says what each role's sandbox allows and why; `hub/README.md` documents the launch keys.

## Acceptance criteria

- [ ] A test against the fake app-server asserts the `thread/start` params (approval policy, sandbox, writable roots) the adapter sends for each role's launch defaults
- [ ] A session launched by the hub with the Implementer or QA defaults runs `npm test` of this repo, `cland inbox` against the project's hub and `git commit` inside a worktree without an approval, shown with the real Codex once
- [ ] `docs/review-and-qa.md` says what each role's sandbox allows; `hub/README.md` documents the keys
- [ ] `npm run typecheck && npm test` pass

## Comments

### human · 2026-10-08T19:49:00.416Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/47 (filed during the T-42 run; the numbers differ, the item is the source of truth).
