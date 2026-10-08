---
id: T-48
kind: task
title: "QA on Codex: the sandbox refuses the hub socket and the tests' sockets, so every check needs an approval"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-08T19:48:52.717Z
updated: 2026-10-08T19:49:00.416Z
---

## Parent

Part of T-19. Found in the T-42 dogfooding run on 2026-10-08 (QA `qa-43`, Codex 0.160.0, gpt-6-astra, in `.cland/worktrees/T-43`).

## Problem

The QA clause tells the holder to run the tests, the `cland task` CLI and the CLI under test. In the Codex app-server's default sandbox every one of them that opens a Unix socket fails: `cland inbox` with `connect EPERM …/.cland/hub.sock`, and `npm test` (it starts temporary hubs). QA asked the human for four separate approvals (`cland inbox`, `npm run typecheck && npm test`, `cland topic answer no-such-ask 1`, `cland topic answer`), each surfacing as `waiting for approval` in the inbox. The human cannot safely approve a prefix: `cland topic answer` with other arguments answers real asks. The run took 15 minutes, most of it waiting on approvals. A rescue run, which declines every approval (spec 4.10), would fail the same checks.

## What to build

One of these, decided and documented in `docs/review-and-qa.md`:

- The Codex adapter launches QA (and Reviewer, read-only) with a sandbox policy that allows Unix sockets under the project and the system temp dir (the app-server's `sandboxPolicy` / `-c sandbox_workspace_write.*` overrides at `thread/start`), keeping the network closed; or
- the QA clause names the read-only spoke tools (`task.view`, `task.list`) for the tracker and states that the test suite runs once with one approval, and `roles.toml` documents the trade-off.

## Acceptance criteria

- [ ] A QA session launched by the hub runs `npm test` of this repo and `cland inbox` against the project's hub without an approval (or the documented single approval), shown with the real Codex once and with the fake in a test
- [ ] `docs/review-and-qa.md` says what the QA sandbox allows
- [ ] `npm run typecheck && npm test` pass

## Comments

### human · 2026-10-08T19:49:00.416Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/47 (filed during the T-42 run; the numbers differ, the item is the source of truth).
